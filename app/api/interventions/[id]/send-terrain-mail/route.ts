import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { getSupabaseOrNull, patchClient, upsertClient } from "@/lib/supabase"
import { generateTerrainPdfsOnServer, terrainPdfsReady } from "@/lib/terrain-pdf-server"
import { resendErrorHint } from "@/lib/email-utils"

export const dynamic = "force-dynamic"
export const maxDuration = 120

type Params = { params: { id: string } }

function getBaseUrl(req: NextRequest): string {
  const configured = process.env.APP_BASE_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (configured) return configured.replace(/\/+$/, "")
  return req.nextUrl.origin.replace(/\/+$/, "")
}

/**
 * Génère les PDF si besoin puis déclenche l'envoi mail rapport+facture.
 * Tout côté serveur — évite les gros payloads base64 depuis l'iPhone.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { clientEmail?: string; nom?: string; ccEmail?: string; telephone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const clientEmail = (body.clientEmail || "").trim()
  const nom = (body.nom || "").trim()
  if (!clientEmail) {
    return NextResponse.json({ error: "Email client manquant" }, { status: 400 })
  }
  if (!nom) {
    return NextResponse.json({ error: "Nom client manquant" }, { status: 400 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })
  }

  const { data: interv } = await sb
    .from("interventions")
    .select("id, client_id, ville, code_postal, rapport_json")
    .eq("id", interventionId)
    .maybeSingle()

  if (!interv) {
    return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
  }
  if (!interv.rapport_json || Object.keys(interv.rapport_json as object).length === 0) {
    return NextResponse.json({ error: "Rapport non sauvegardé. Reviens à l'étape rapport." }, { status: 400 })
  }

  const telephone = (body.telephone || "").trim()
  if (interv.client_id) {
    await patchClient(interv.client_id as string, {
      nom,
      email: clientEmail,
      ...(telephone ? { telephone } : {}),
    })
  } else {
    const clientId = await upsertClient({
      nom,
      email: clientEmail,
      telephone: telephone || null,
      ville: (interv.ville as string) || null,
      code_postal: (interv.code_postal as string) || null,
    })
    if (clientId) {
      await sb.from("interventions").update({ client_id: clientId }).eq("id", interventionId)
    }
  }

  const ready = await terrainPdfsReady(sb, interventionId)
  if (!ready.ready) {
    try {
      await generateTerrainPdfsOnServer({
        interventionId,
        baseUrl: getBaseUrl(req),
        clientNom: nom,
        sb,
      })
    } catch (e) {
      return NextResponse.json(
        { error: `Génération PDF : ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 },
      )
    }
  }

  const notifyUrl = new URL("/api/notify-rapport-facture", req.nextUrl.origin)
  const cookie = req.headers.get("cookie")
  const internalAuth = req.headers.get("x-internal-auth")
  const notifyRes = await fetch(notifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(internalAuth ? { "x-internal-auth": internalAuth } : {}),
    },
    body: JSON.stringify({
      interventionId,
      clientEmail,
      ccEmail: (body.ccEmail || "").trim() || undefined,
    }),
  })

  let notifyData: Record<string, unknown> = {}
  try {
    notifyData = await notifyRes.json()
  } catch {
    notifyData = {}
  }

  if (!notifyRes.ok) {
    const errMsg = typeof notifyData.error === "string" ? notifyData.error : `HTTP ${notifyRes.status}`
    const hint = resendErrorHint(notifyData)
    return NextResponse.json({ error: hint ? `${errMsg} — ${hint}` : errMsg }, { status: notifyRes.status })
  }

  return NextResponse.json(notifyData)
}

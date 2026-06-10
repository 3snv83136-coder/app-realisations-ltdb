import { NextRequest, NextResponse } from "next/server"
import { generateTerrainPdfsOnServer, terrainPdfsReady } from "@/lib/terrain-pdf-server"
import { getSupabaseOrNull, patchClient, upsertClient } from "@/lib/supabase"

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

export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const status = await terrainPdfsReady(sb, params.id)
  return NextResponse.json(status)
}

export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const interventionId = params.id
  if (!interventionId) return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })

  let body: { nom?: string; email?: string; telephone?: string; force?: boolean }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const nom = (body.nom || "").trim()
  if (!nom) return NextResponse.json({ error: "Nom client requis" }, { status: 400 })

  if (!body.force) {
    const existing = await terrainPdfsReady(sb, interventionId)
    if (existing.ready) {
      return NextResponse.json({ ok: true, skipped: true, ...existing })
    }
  }

  const email = (body.email || "").trim()
  const telephone = (body.telephone || "").trim()
  const { data: interv } = await sb
    .from("interventions")
    .select("id, client_id, ville, code_postal")
    .eq("id", interventionId)
    .maybeSingle()

  if (interv) {
    if (interv.client_id) {
      await patchClient(interv.client_id as string, {
        nom,
        email: email || null,
        ...(telephone ? { telephone } : {}),
      })
    } else {
      const clientId = await upsertClient({
        nom,
        email: email || null,
        telephone: telephone || null,
        ville: (interv.ville as string) || null,
        code_postal: (interv.code_postal as string) || null,
      })
      if (clientId) {
        await sb.from("interventions").update({ client_id: clientId }).eq("id", interventionId)
      }
    }
  }

  try {
    const result = await generateTerrainPdfsOnServer({
      interventionId,
      baseUrl: getBaseUrl(req),
      clientNom: nom,
      sb,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[generate-pdfs]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Génération PDF échouée" },
      { status: 500 },
    )
  }
}

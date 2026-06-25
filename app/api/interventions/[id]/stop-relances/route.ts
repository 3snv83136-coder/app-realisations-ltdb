import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }
type RelanceType = "avis" | "devis"

const COLUMN: Record<RelanceType, string> = {
  avis: "avis_relance_ids",
  devis: "devis_relance_ids",
}

/**
 * Annule depuis l'app les relances automatiques planifiées (avis Google ou
 * devis) pour une intervention — typiquement quand le client a laissé son avis
 * ou accepté le devis. Annule les emails Resend programmés puis vide la liste.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let body: { type?: RelanceType }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const type = body.type
  if (type !== "avis" && type !== "devis") {
    return NextResponse.json({ error: "type doit être 'avis' ou 'devis'" }, { status: 400 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const column = COLUMN[type]
  const { data: interv, error: readErr } = await sb
    .from("interventions")
    .select("id, avis_relance_ids, devis_relance_ids")
    .eq("id", interventionId)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const row = interv as unknown as Record<string, unknown>
  const ids: string[] = Array.isArray(row[column]) ? (row[column] as string[]) : []

  // Annulation Resend (best-effort).
  let canceled = 0
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && ids.length > 0) {
    const resend = new Resend(resendKey)
    for (const id of ids) {
      try {
        const r = await resend.emails.cancel(id)
        if (!r.error) canceled++
      } catch {
        /* ignore */
      }
    }
  }

  // Vide la liste + marque l'état correspondant.
  const update: Record<string, unknown> = { [column]: [] }
  if (type === "avis") update.avis_recu = true
  if (type === "devis") update.devis_accepte_at = new Date().toISOString()

  const { error: updErr } = await sb
    .from("interventions")
    .update(update)
    .eq("id", interventionId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, type, total: ids.length, canceled })
}

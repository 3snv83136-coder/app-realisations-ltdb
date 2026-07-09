import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"
import type { GarantieIntervention } from "@/lib/garantie-intervention"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * POST /api/interventions/[id]/garantie
 * Enregistre la garantie d'intervention dans rapport_json.garantie_intervention.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { est_garanti?: boolean; commentaire?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (typeof body.est_garanti !== 'boolean') {
    return NextResponse.json({ error: 'est_garanti (boolean) requis' }, { status: 400 })
  }

  const commentaire = typeof body.commentaire === 'string' ? body.commentaire.trim() : ''

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, rapport_json')
    .eq('id', interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const garantie: GarantieIntervention = {
    est_garanti: body.est_garanti,
    ...(commentaire ? { commentaire } : {}),
    saisi_at: new Date().toISOString(),
  }

  const rapportJson = {
    ...(interv.rapport_json && typeof interv.rapport_json === 'object' ? interv.rapport_json : {}),
    garantie_intervention: garantie,
  }

  const { error } = await sb
    .from('interventions')
    .update({ rapport_json: rapportJson })
    .eq('id', interventionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, garantie })
}

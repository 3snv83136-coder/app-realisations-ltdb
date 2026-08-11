import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"
import {
  getAttestationConformiteMeta,
  isAttestationConformiteResolved,
  mergeAttestationConformiteMeta,
  type AttestationConformiteStatus,
} from "@/lib/attestation-conformite"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * GET  → { resolved, meta, has_document }
 * POST → { action: 'skip' | 'generated', document_id? }
 */
export async function GET(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const access = await requireInterventionAccess(req, params.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const { data: interv, error } = await sb
    .from('interventions')
    .select('id, rapport_json')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const { data: doc } = await sb
    .from('documents')
    .select('id')
    .eq('intervention_id', params.id)
    .eq('type', 'attestation')
    .limit(1)
    .maybeSingle()

  const hasDocument = !!doc?.id
  const meta = getAttestationConformiteMeta(interv.rapport_json)

  return NextResponse.json({
    resolved: isAttestationConformiteResolved(interv.rapport_json, hasDocument),
    meta,
    has_document: hasDocument,
    document_id: doc?.id || meta?.document_id || null,
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const access = await requireInterventionAccess(req, params.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { action?: string; document_id?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const action = body.action
  let status: AttestationConformiteStatus | null = null
  if (action === 'skip') status = 'skipped'
  else if (action === 'generated') status = 'generated'
  else {
    return NextResponse.json({ error: 'action invalide (skip | generated)' }, { status: 400 })
  }

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, rapport_json')
    .eq('id', params.id)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const meta = {
    status,
    at: new Date().toISOString(),
    document_id: body.document_id || null,
  }
  const rapport_json = mergeAttestationConformiteMeta(interv.rapport_json, meta)

  const { data, error } = await sb
    .from('interventions')
    .update({ rapport_json })
    .eq('id', params.id)
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, meta, intervention: data })
}

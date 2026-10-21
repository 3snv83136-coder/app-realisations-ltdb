import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseOrNull } from '@/lib/supabase'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'
import type { InspectionData } from '@/lib/types-documents'
export const dynamic = 'force-dynamic'
type Context = { params: { id: string } }
export async function GET(_req: NextRequest, { params }: Context) {
  const access = await requireOwnerAdminApi()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })
  const { data, error } = await sb.from('documents').select('id, numero, payload, intervention_id').eq('type', 'inspection').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  return NextResponse.json({ report: data })
}
export async function PATCH(req: NextRequest, { params }: Context) {
  const access = await requireOwnerAdminApi()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })
  let body: { inspection?: InspectionData; interventionId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }) }
  if (typeof body.inspection?.client?.nom !== 'string' || !body.inspection.client.nom.trim() || !Array.isArray(body.inspection.troncons) || typeof body.inspection.dateInspection !== 'string') return NextResponse.json({ error: 'Rapport invalide : client et tronçons requis' }, { status: 400 })
  const { data: existing, error: readError } = await sb.from('documents').select('numero').eq('type', 'inspection').eq('id', params.id).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  const { error } = await sb.from('documents').update({ payload: { ...body.inspection, numero: existing.numero }, date_emission: body.inspection.dateInspection, pdf_url: null, intervention_id: body.interventionId || null })
    .eq('type', 'inspection').eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: params.id })
}

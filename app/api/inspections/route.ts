import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseOrNull } from '@/lib/supabase'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  const access = await requireOwnerAdminApi()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 503 })
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset')) || 0)
  const { data, error, count } = await sb.from('documents')
    .select('id, numero, date_emission, statut, created_at, clientNom:payload->client->>nom, ville:payload->client->>ville, technicienNom:payload->>technicienNom, intervention_id', { count: 'exact' })
    .eq('type', 'inspection').order('created_at', { ascending: false }).order('id').range(offset, offset + 49)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data || [], total: count || 0 })
}

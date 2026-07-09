import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * GET /api/interventions/[id]/accord
 * Retourne l'accord lié à l'intervention (s'il existe) avec ses lignes.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: 'ID intervention manquant' }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const { data: accord, error } = await sb
    .from('accords_intervention')
    .select('*')
    .eq('intervention_id', interventionId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!accord) return NextResponse.json({ accord: null, lignes: [] })

  const { data: lignes, error: lignesErr } = await sb
    .from('lignes_devis')
    .select('*')
    .eq('accord_id', accord.id)
    .order('position', { ascending: true })
  if (lignesErr) return NextResponse.json({ error: lignesErr.message }, { status: 500 })

  return NextResponse.json({ accord, lignes: lignes || [] })
}

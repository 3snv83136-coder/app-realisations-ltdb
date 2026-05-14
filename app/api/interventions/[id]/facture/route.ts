import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/**
 * Retourne la dernière facture liée à cette intervention (avec son payload complet).
 * Utilisé par le wizard Mode Terrain à l'étape d'envoi pour générer le PDF.
 *
 * GET /api/interventions/[id]/facture
 *   → { facture: { id, numero, montant_ht, montant_ttc, tva_taux, pdf_url, payload } | null }
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const { data, error } = await sb
    .from('documents')
    .select('id, numero, montant_ht, montant_ttc, tva_taux, pdf_url, payload, agence, date_emission, echeance, statut')
    .eq('intervention_id', params.id)
    .eq('type', 'facture')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ facture: data?.[0] || null })
}

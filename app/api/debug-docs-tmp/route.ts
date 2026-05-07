import { NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'no supabase' }, { status: 500 })

  const url = process.env.SUPABASE_URL || null
  const urlPrefix = url ? url.slice(0, url.indexOf('.')) : null

  const [light, full] = await Promise.all([
    sb.from('documents').select('id, type, numero, statut, created_at').neq('statut', 'annule').order('created_at', { ascending: false }).limit(100),
    sb.from('documents').select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, tva_taux, payload, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at').neq('statut', 'annule').order('created_at', { ascending: false }).limit(100),
  ])

  const lightIds = new Set((light.data || []).map(r => r.id))
  const fullIds = new Set((full.data || []).map(r => r.id))
  const missingInFull = [...lightIds].filter(id => !fullIds.has(id))

  const payloadSizes = (full.data || []).map(r => ({
    id: r.id,
    numero: (r as any).numero,
    statut: (r as any).statut,
    payload_size: JSON.stringify((r as any).payload || {}).length,
  }))

  const totalPayloadBytes = payloadSizes.reduce((s, x) => s + x.payload_size, 0)

  return NextResponse.json({
    supabase_url_prefix: urlPrefix,
    light_count: light.data?.length ?? null,
    light_error: light.error?.message ?? null,
    full_count: full.data?.length ?? null,
    full_error: full.error?.message ?? null,
    missing_in_full: missingInFull,
    total_payload_bytes: totalPayloadBytes,
    payload_sizes: payloadSizes,
  })
}

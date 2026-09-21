import { NextRequest, NextResponse } from "next/server"
import { requireOwnerAdminApi } from "@/lib/require-owner-admin"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

/**
 * GET /api/attestations — liste des documents type attestation pour la rubrique.
 * Inclut payload (variante) : endpoint dédié pour éviter le bug PostgREST
 * « trop de colonnes » de /api/historique.
 */
export async function GET(req: NextRequest) {
  const admin = await requireOwnerAdminApi()
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error, documents: [] }, { status: admin.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré',
      documents: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 300)
  const rangeEnd = Math.max(limit - 1, 0)

  const { data, error } = await sb
    .from('documents')
    .select('id, type, numero, agence, date_emission, statut, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at, payload')
    .eq('type', 'attestation')
    .neq('statut', 'annule')
    .order('created_at', { ascending: false })
    .range(0, rangeEnd)

  if (error) {
    return NextResponse.json({ error: error.message, documents: [] }, { status: 500 })
  }

  const rows = data || []
  const clientIds = Array.from(new Set(rows.map(r => r.client_id).filter(Boolean) as string[]))
  let clients: Record<string, {
    nom: string | null
    email: string | null
    adresse: string | null
    code_postal: string | null
    ville: string | null
  }> = {}

  if (clientIds.length > 0) {
    const { data: clientsData } = await sb
      .from('clients')
      .select('id, nom, email, adresse, code_postal, ville')
      .in('id', clientIds)
    if (clientsData) {
      clients = Object.fromEntries(clientsData.map(c => [c.id, c]))
    }
  }

  const documents = rows.map(d => {
    const c = d.client_id ? clients[d.client_id] : null
    return {
      id: d.id,
      type: d.type,
      numero: d.numero,
      agence: d.agence,
      date_emission: d.date_emission,
      statut: d.statut,
      pdf_url: d.pdf_url,
      envoye_email: d.envoye_email,
      envoye_at: d.envoye_at,
      intervention_id: d.intervention_id,
      client_id: d.client_id,
      created_at: d.created_at,
      payload: d.payload,
      client_nom: c?.nom || null,
      client_email: c?.email || null,
      client_adresse: c?.adresse || null,
      client_code_postal: c?.code_postal || null,
      client_ville: c?.ville || null,
    }
  })

  return NextResponse.json({ documents })
}

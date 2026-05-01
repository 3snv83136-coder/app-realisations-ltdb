import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      interventions: [],
      documents: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const search = (url.searchParams.get('q') || '').trim().toLowerCase()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500)

  const [intRes, docRes] = await Promise.all([
    sb
      .from('interventions')
      .select('id, reference, type_intervention, ville, code_postal, date_realisee, date_prevue, statut, agence, publie_slug, created_at, client_id')
      .order('created_at', { ascending: false })
      .limit(limit),
    sb
      .from('documents')
      .select('id, type, numero, agence, date_emission, statut, montant_ht, montant_ttc, envoye_email, envoye_at, intervention_id, client_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (intRes.error) {
    return NextResponse.json({ error: intRes.error.message, interventions: [], documents: [] }, { status: 500 })
  }
  if (docRes.error) {
    return NextResponse.json({ error: docRes.error.message, interventions: [], documents: [] }, { status: 500 })
  }

  // Charge les clients référencés en une seule requête
  const clientIds = new Set<string>()
  intRes.data?.forEach(i => i.client_id && clientIds.add(i.client_id))
  docRes.data?.forEach(d => d.client_id && clientIds.add(d.client_id))

  let clients: Record<string, { id: string; nom: string; email: string | null; ville: string | null }> = {}
  if (clientIds.size > 0) {
    const { data: clientsData } = await sb
      .from('clients')
      .select('id, nom, email, ville')
      .in('id', Array.from(clientIds))
    if (clientsData) {
      clients = Object.fromEntries(clientsData.map(c => [c.id, c]))
    }
  }

  // Décore avec le nom client
  const decoratedInterventions = (intRes.data || []).map(i => ({
    ...i,
    client_nom: i.client_id ? clients[i.client_id]?.nom || null : null,
    client_email: i.client_id ? clients[i.client_id]?.email || null : null,
  }))
  const decoratedDocuments = (docRes.data || []).map(d => ({
    ...d,
    client_nom: d.client_id ? clients[d.client_id]?.nom || null : null,
  }))

  // Filtrage côté serveur (recherche)
  const filterByQ = <T extends Record<string, any>>(rows: T[]) => {
    if (!search) return rows
    return rows.filter(r => {
      const blob = [
        r.reference, r.numero, r.client_nom, r.client_email,
        r.ville, r.type_intervention, r.agence, r.publie_slug,
      ].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(search)
    })
  }

  return NextResponse.json({
    interventions: filterByQ(decoratedInterventions),
    documents: filterByQ(decoratedDocuments),
  })
}

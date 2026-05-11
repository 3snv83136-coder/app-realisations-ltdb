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
      .select('id, reference, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, statut, agence, publie_slug, created_at, client_id, technicien_id, rapport_json, photos_urls, pdf_rapport_url')
      .neq('statut', 'annulee')
      .order('created_at', { ascending: false })
      .limit(limit),
    sb
      .from('documents')
      .select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, tva_taux, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at')
      .neq('statut', 'annule')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const supabaseUrl = process.env.SUPABASE_URL || 'MISSING'
  const isDebug = url.searchParams.get('raw') === '1'
  console.log('[historique] SUPABASE_URL:', supabaseUrl.replace(/\/\/.*@/, '//***@'))
  console.log('[historique] docs bruts:', docRes.data?.length, '| types:', docRes.data?.map((d: any) => d.type).join(', '))
  console.log('[historique] docs ids:', docRes.data?.map((d: any) => `${d.type}:${d.id.slice(0, 8)}`).join(', '))

  if (isDebug) {
    // Requêtes debug pour isoler le bug du neq
    const [rawDocRes, devisRes, fullNoNeqRes, neqOnlyRes] = await Promise.all([
      sb.from('documents').select('id, type, numero, statut, created_at').order('created_at', { ascending: false }).limit(50),
      sb.from('documents').select('id, type, numero, statut, created_at').eq('type', 'devis'),
      // Mêmes colonnes que la requête principale mais SANS neq
      sb.from('documents').select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, tva_taux, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at').order('created_at', { ascending: false }).limit(50),
      // Colonnes minimales AVEC neq (même filtre que la requête principale)
      sb.from('documents').select('id, type, numero, statut, created_at').neq('statut', 'annule').order('created_at', { ascending: false }).limit(50),
    ])
    return NextResponse.json({
      _debug_supabase_url: supabaseUrl.replace(/\/\/.*@/, '//***@'),
      _debug_doc_count_raw: docRes.data?.length || 0,
      _debug_doc_count_raw_types: docRes.data?.map((d: any) => d.type).join(', ') || '',
      _debug_all_docs_count: rawDocRes.data?.length || 0,
      _debug_full_no_neq_count: fullNoNeqRes.data?.length || 0,
      _debug_full_no_neq_types: fullNoNeqRes.data?.map((d: any) => d.type).join(', ') || '',
      _debug_neq_only_count: neqOnlyRes.data?.length || 0,
      _debug_neq_only_types: neqOnlyRes.data?.map((d: any) => d.type).join(', ') || '',
      _debug_devis: devisRes.data || [],
      interventions: [],
      documents: [],
    })
  }

  if (intRes.error) {
    return NextResponse.json({ error: intRes.error.message, interventions: [], documents: [] }, { status: 500 })
  }
  if (docRes.error) {
    return NextResponse.json({ error: docRes.error.message, interventions: [], documents: [] }, { status: 500 })
  }

  // Charge clients référencés
  const clientIds = new Set<string>()
  intRes.data?.forEach(i => i.client_id && clientIds.add(i.client_id))
  docRes.data?.forEach(d => d.client_id && clientIds.add(d.client_id))

  let clients: Record<string, {
    id: string; nom: string; email: string | null;
    adresse: string | null; code_postal: string | null; ville: string | null
  }> = {}
  if (clientIds.size > 0) {
    const { data: clientsData } = await sb
      .from('clients')
      .select('id, nom, email, adresse, code_postal, ville')
      .in('id', Array.from(clientIds))
    if (clientsData) {
      clients = Object.fromEntries(clientsData.map(c => [c.id, c]))
    }
  }

  // Charge techniciens référencés
  const techIds = new Set<string>()
  intRes.data?.forEach(i => i.technicien_id && techIds.add(i.technicien_id))
  let techniciens: Record<string, { id: string; nom: string; agence: string | null }> = {}
  if (techIds.size > 0) {
    const { data: techData } = await sb
      .from('techniciens')
      .select('id, nom, agence')
      .in('id', Array.from(techIds))
    if (techData) {
      techniciens = Object.fromEntries(techData.map(t => [t.id, t]))
    }
  }

  // Décoration
  const decoratedInterventions = (intRes.data || []).map(i => {
    const c = i.client_id ? clients[i.client_id] : null
    const t = i.technicien_id ? techniciens[i.technicien_id] : null
    return {
      ...i,
      client_nom: c?.nom || null,
      client_email: c?.email || null,
      client_adresse: c?.adresse || null,
      client_code_postal: c?.code_postal || null,
      client_ville: c?.ville || null,
      technicien_nom: t?.nom || null,
      has_rapport: !!(i.rapport_json && Object.keys(i.rapport_json || {}).length > 0),
    }
  })
  const decoratedDocuments = (docRes.data || []).map(d => {
    const c = d.client_id ? clients[d.client_id] : null
    return {
      ...d,
      client_nom: c?.nom || null,
      client_email: c?.email || null,
      client_adresse: c?.adresse || null,
      client_code_postal: c?.code_postal || null,
      client_ville: c?.ville || null,
    }
  })

  // Filtrage côté serveur (recherche)
  const filterByQ = <T extends Record<string, any>>(rows: T[]) => {
    if (!search) return rows
    return rows.filter(r => {
      const blob = [
        r.reference, r.numero, r.client_nom, r.client_email,
        r.ville, r.client_ville, r.type_intervention, r.agence, r.publie_slug,
      ].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(search)
    })
  }

  return NextResponse.json({
    _debug_supabase_url: supabaseUrl.replace(/\/\/.*@/, '//***@'),
    _debug_doc_count_raw: docRes.data?.length || 0,
    interventions: filterByQ(decoratedInterventions),
    documents: filterByQ(decoratedDocuments),
  })
}

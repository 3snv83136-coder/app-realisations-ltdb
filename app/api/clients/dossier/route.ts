import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseOrNull } from '@/lib/supabase'
import {
  clientKey,
  clientMatchesFilters,
  hasClientSearchFilters,
  type ClientLike,
  type ClientSearchFilters,
} from '@/lib/client-search'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 500

type Dossier = {
  key: string
  client: ClientLike
  interventions: unknown[]
  documents: unknown[]
  accords: unknown[]
  caTotal: number
  caPaye: number
  lastDate: string | null
}

function parseFilters(url: URL): ClientSearchFilters {
  return {
    nom: (url.searchParams.get('nom') || '').trim(),
    telephone: (url.searchParams.get('telephone') || '').trim(),
    email: (url.searchParams.get('email') || '').trim(),
    ville: (url.searchParams.get('ville') || '').trim(),
  }
}

function accordToClient(a: Record<string, unknown>): ClientLike {
  return {
    id: (a.client_id as string) || null,
    nom: (a.client_nom as string) || 'Client sans nom',
    email: (a.client_email as string) || null,
    telephone: (a.client_telephone as string) || null,
    adresse: (a.client_adresse as string) || null,
    code_postal: (a.client_code_postal as string) || null,
    ville: (a.client_ville as string) || null,
  }
}

/**
 * GET /api/clients/dossier — dossier client (rapports, factures, devis, accords).
 * Au moins un filtre requis : nom, téléphone, email ou ville.
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré', dossiers: [] }, { status: 500 })
  }

  const filters = parseFilters(new URL(req.url))
  if (!hasClientSearchFilters(filters)) {
    return NextResponse.json({
      error: 'Indique au moins un critère : nom, téléphone, email ou ville.',
      dossiers: [],
    }, { status: 400 })
  }

  const rangeEnd = MAX_ROWS - 1

  const [clientsRes, intRes, docRes, accordRes] = await Promise.all([
    sb
      .from('clients')
      .select('id, nom, email, telephone, adresse, code_postal, ville')
      .order('nom', { ascending: true })
      .range(0, rangeEnd),
    sb
      .from('interventions')
      .select('id, reference, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, statut, agence, publie_slug, created_at, client_id, technicien_id, rapport_json, pdf_rapport_url')
      .neq('statut', 'annulee')
      .order('created_at', { ascending: false })
      .range(0, rangeEnd),
    sb
      .from('documents')
      .select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at')
      .neq('statut', 'annule')
      .order('created_at', { ascending: false })
      .range(0, rangeEnd),
    sb
      .from('accords_intervention')
      .select('id, reference, statut, total_ttc, valide_at, created_at, pdf_url, intervention_id, client_id, client_nom, client_email, client_telephone, client_adresse, client_code_postal, client_ville')
      .neq('statut', 'ANNULE')
      .order('created_at', { ascending: false })
      .range(0, rangeEnd),
  ])

  if (clientsRes.error) {
    return NextResponse.json({ error: clientsRes.error.message, dossiers: [] }, { status: 500 })
  }
  if (intRes.error) {
    return NextResponse.json({ error: intRes.error.message, dossiers: [] }, { status: 500 })
  }
  if (docRes.error) {
    return NextResponse.json({ error: docRes.error.message, dossiers: [] }, { status: 500 })
  }
  if (accordRes.error) {
    return NextResponse.json({ error: accordRes.error.message, dossiers: [] }, { status: 500 })
  }

  const allClients = (clientsRes.data || []) as ClientLike[]
  const rawInterventions = intRes.data || []
  const rawDocuments = docRes.data || []
  const rawAccords = accordRes.data || []

  const matchedClientIds = new Set<string>()
  const matchedAccordIds = new Set<string>()
  const dossierMap = new Map<string, Dossier>()

  const ensure = (c: ClientLike): Dossier => {
    const k = clientKey(c)
    const existing = dossierMap.get(k)
    if (existing) {
      if (!existing.client.id && c.id) existing.client.id = c.id
      if (!existing.client.email && c.email) existing.client.email = c.email
      if (!existing.client.telephone && c.telephone) existing.client.telephone = c.telephone
      if (!existing.client.adresse && c.adresse) existing.client.adresse = c.adresse
      if (!existing.client.code_postal && c.code_postal) existing.client.code_postal = c.code_postal
      if (!existing.client.ville && c.ville) existing.client.ville = c.ville
      return existing
    }
    const fresh: Dossier = {
      key: k,
      client: { ...c },
      interventions: [],
      documents: [],
      accords: [],
      caTotal: 0,
      caPaye: 0,
      lastDate: null,
    }
    dossierMap.set(k, fresh)
    return fresh
  }

  for (const c of allClients) {
    if (clientMatchesFilters(c, filters) && c.id) {
      matchedClientIds.add(c.id)
      ensure(c)
    }
  }

  for (const a of rawAccords) {
    const c = accordToClient(a)
    if (clientMatchesFilters(c, filters)) {
      matchedAccordIds.add(a.id as string)
      if (c.id) matchedClientIds.add(c.id)
      ensure(c)
    }
  }

  const clientById = Object.fromEntries(allClients.filter(c => c.id).map(c => [c.id!, c]))

  const techIds = new Set<string>()
  for (const i of rawInterventions) {
    if (i.technicien_id) techIds.add(i.technicien_id as string)
  }
  let techniciens: Record<string, { nom: string }> = {}
  if (techIds.size > 0) {
    const { data: techData } = await sb
      .from('techniciens')
      .select('id, nom')
      .in('id', Array.from(techIds))
    if (techData) techniciens = Object.fromEntries(techData.map(t => [t.id, { nom: t.nom }]))
  }

  const touchDate = (d: Dossier, iso: string | null | undefined) => {
    if (iso && (!d.lastDate || iso > d.lastDate)) d.lastDate = iso
  }

  const interventionBelongs = (clientId: string | null): boolean => {
    if (!clientId) return false
    return matchedClientIds.has(clientId)
  }

  for (const i of rawInterventions) {
    const cid = i.client_id as string | null
    if (!interventionBelongs(cid)) continue
    const c = clientById[cid!]
    if (!c) continue
    const d = ensure(c)
    const row = {
      ...i,
      client_nom: c.nom,
      client_email: c.email,
      client_ville: c.ville || i.ville,
      technicien_nom: i.technicien_id ? techniciens[i.technicien_id as string]?.nom || null : null,
      has_rapport: !!(i.rapport_json && Object.keys(i.rapport_json as object).length > 0),
    }
    d.interventions.push(row)
    touchDate(d, (i.date_realisee as string) || (i.date_prevue as string) || (i.created_at as string))
  }

  for (const doc of rawDocuments) {
    const cid = doc.client_id as string | null
    if (!cid || !matchedClientIds.has(cid)) continue
    const c = clientById[cid]
    if (!c) continue
    const d = ensure(c)
    const row = {
      ...doc,
      client_nom: c.nom,
      client_email: c.email,
      client_ville: c.ville,
    }
    d.documents.push(row)
    if (doc.type === 'facture' && typeof doc.montant_ttc === 'number') {
      d.caTotal += doc.montant_ttc
      if (doc.statut === 'paye') d.caPaye += doc.montant_ttc
    }
    touchDate(d, (doc.date_emission as string) || (doc.created_at as string))
  }

  for (const a of rawAccords) {
    if (!matchedAccordIds.has(a.id as string)) continue
    const c = accordToClient(a)
    const d = ensure(c)
    d.accords.push(a)
    touchDate(d, (a.valide_at as string) || (a.created_at as string))
  }

  const dossiers = Array.from(dossierMap.values())
    .sort((a, b) => {
      if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate)
      if (a.lastDate) return -1
      if (b.lastDate) return 1
      return a.client.nom.localeCompare(b.client.nom, 'fr')
    })

  return NextResponse.json({ dossiers })
}

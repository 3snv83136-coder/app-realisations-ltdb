import type { SupabaseClient } from '@supabase/supabase-js'
import {
  clientKey,
  clientMatchesFilters,
  type ClientLike,
  type ClientSearchFilters,
} from '@/lib/client-search'

const MAX_ROWS = 500

export type ClientSummary = {
  key: string
  client: ClientLike
  derniereIntervention: string | null
  derniereInterventionDate: string | null
  lastDate: string | null
}

export type ClientDossierData = {
  key: string
  client: ClientLike
  interventions: unknown[]
  documents: unknown[]
  accords: unknown[]
  caTotal: number
  caPaye: number
  lastDate: string | null
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

function interventionSortDate(i: Record<string, unknown>): string {
  return (
    (i.date_realisee as string)
    || (i.date_prevue as string)
    || (i.created_at as string)
    || ''
  )
}

function touchDate(d: { lastDate: string | null }, iso: string | null | undefined) {
  if (iso && (!d.lastDate || iso > d.lastDate)) d.lastDate = iso
}

function mergeClient(existing: ClientLike, incoming: ClientLike): ClientLike {
  return {
    id: existing.id || incoming.id,
    nom: existing.nom || incoming.nom,
    email: existing.email || incoming.email,
    telephone: existing.telephone || incoming.telephone,
    adresse: existing.adresse || incoming.adresse,
    code_postal: existing.code_postal || incoming.code_postal,
    ville: existing.ville || incoming.ville,
  }
}

/** Clients + accords correspondant aux filtres (sans documents ni détail interventions). */
async function collectMatchingClients(
  sb: SupabaseClient,
  filters: ClientSearchFilters,
): Promise<Map<string, ClientLike>> {
  const rangeEnd = MAX_ROWS - 1
  const map = new Map<string, ClientLike>()

  const { data: allClients, error: clientsErr } = await sb
    .from('clients')
    .select('id, nom, email, telephone, adresse, code_postal, ville')
    .order('nom', { ascending: true })
    .range(0, rangeEnd)

  if (clientsErr) throw new Error(clientsErr.message)

  for (const c of (allClients || []) as ClientLike[]) {
    if (clientMatchesFilters(c, filters)) {
      map.set(clientKey(c), { ...c })
    }
  }

  const { data: rawAccords, error: accordErr } = await sb
    .from('accords_intervention')
    .select('client_id, client_nom, client_email, client_telephone, client_adresse, client_code_postal, client_ville')
    .neq('statut', 'ANNULE')
    .order('created_at', { ascending: false })
    .range(0, rangeEnd)

  if (accordErr) throw new Error(accordErr.message)

  for (const a of rawAccords || []) {
    const c = accordToClient(a as Record<string, unknown>)
    if (!clientMatchesFilters(c, filters)) continue
    const k = clientKey(c)
    const prev = map.get(k)
    map.set(k, prev ? mergeClient(prev, c) : c)
  }

  return map
}

async function fetchLatestInterventionsByClient(
  sb: SupabaseClient,
  clientIds: string[],
): Promise<Map<string, { type: string | null; date: string | null }>> {
  const result = new Map<string, { type: string | null; date: string | null }>()
  if (clientIds.length === 0) return result

  const { data, error } = await sb
    .from('interventions')
    .select('client_id, type_intervention, date_realisee, date_prevue, created_at')
    .in('client_id', clientIds)
    .neq('statut', 'annulee')
    .order('created_at', { ascending: false })
    .range(0, MAX_ROWS - 1)

  if (error) throw new Error(error.message)

  for (const row of data || []) {
    const cid = row.client_id as string | null
    if (!cid || result.has(cid)) continue
    const date = interventionSortDate(row as Record<string, unknown>) || null
    result.set(cid, {
      type: (row.type_intervention as string) || null,
      date,
    })
  }

  return result
}

/** Recherche légère : nom, tél, email + dernière intervention. */
export async function searchClientSummaries(
  sb: SupabaseClient,
  filters: ClientSearchFilters,
): Promise<ClientSummary[]> {
  const matched = await collectMatchingClients(sb, filters)
  const clientIds = Array.from(matched.values()).map(c => c.id).filter(Boolean) as string[]
  const latestByClient = await fetchLatestInterventionsByClient(sb, clientIds)

  const summaries: ClientSummary[] = []
  for (const client of Array.from(matched.values())) {
    const key = clientKey(client)
    const latest = client.id ? latestByClient.get(client.id) : undefined
    summaries.push({
      key,
      client,
      derniereIntervention: latest?.type || null,
      derniereInterventionDate: latest?.date || null,
      lastDate: latest?.date || null,
    })
  }

  summaries.sort((a, b) => {
    if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate)
    if (a.lastDate) return -1
    if (b.lastDate) return 1
    return a.client.nom.localeCompare(b.client.nom, 'fr')
  })

  return summaries
}

/** Dossier complet pour un seul client (chargé au clic). */
export async function buildClientDossier(
  sb: SupabaseClient,
  client: ClientLike,
): Promise<ClientDossierData> {
  const dossier: ClientDossierData = {
    key: clientKey(client),
    client: { ...client },
    interventions: [],
    documents: [],
    accords: [],
    caTotal: 0,
    caPaye: 0,
    lastDate: null,
  }

  const cid = client.id

  if (cid) {
    const [intRes, docRes, accordByIdRes] = await Promise.all([
      sb
        .from('interventions')
        .select('id, reference, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, statut, agence, publie_slug, created_at, client_id, technicien_id, rapport_json, pdf_rapport_url')
        .eq('client_id', cid)
        .neq('statut', 'annulee')
        .order('created_at', { ascending: false }),
      sb
        .from('documents')
        .select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at')
        .eq('client_id', cid)
        .neq('statut', 'annule')
        .order('created_at', { ascending: false }),
      sb
        .from('accords_intervention')
        .select('id, reference, statut, total_ttc, valide_at, created_at, pdf_url, intervention_id, client_id, client_nom, client_email, client_telephone, client_adresse, client_code_postal, client_ville')
        .eq('client_id', cid)
        .neq('statut', 'ANNULE')
        .order('created_at', { ascending: false }),
    ])

    if (intRes.error) throw new Error(intRes.error.message)
    if (docRes.error) throw new Error(docRes.error.message)
    if (accordByIdRes.error) throw new Error(accordByIdRes.error.message)

    const techIds = new Set<string>()
    for (const i of intRes.data || []) {
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

    for (const i of intRes.data || []) {
      dossier.interventions.push({
        ...i,
        client_nom: client.nom,
        client_email: client.email,
        client_ville: client.ville || i.ville,
        technicien_nom: i.technicien_id ? techniciens[i.technicien_id as string]?.nom || null : null,
        has_rapport: !!(i.rapport_json && Object.keys(i.rapport_json as object).length > 0),
      })
      touchDate(dossier, interventionSortDate(i as Record<string, unknown>))
    }

    for (const doc of docRes.data || []) {
      dossier.documents.push({
        ...doc,
        client_nom: client.nom,
        client_email: client.email,
        client_ville: client.ville,
      })
      if (doc.type === 'facture' && typeof doc.montant_ttc === 'number') {
        dossier.caTotal += doc.montant_ttc
        if (doc.statut === 'paye') dossier.caPaye += doc.montant_ttc
      }
      touchDate(dossier, (doc.date_emission as string) || (doc.created_at as string))
    }

    for (const a of accordByIdRes.data || []) {
      dossier.accords.push(a)
      touchDate(dossier, (a.valide_at as string) || (a.created_at as string))
    }
  }

  // Accords sans client_id mais même identité (nom + email)
  const accordFilter = sb
    .from('accords_intervention')
    .select('id, reference, statut, total_ttc, valide_at, created_at, pdf_url, intervention_id, client_id, client_nom, client_email, client_telephone, client_adresse, client_code_postal, client_ville')
    .neq('statut', 'ANNULE')
    .order('created_at', { ascending: false })
    .range(0, MAX_ROWS - 1)

  const { data: orphanAccords, error: orphanErr } = await accordFilter
  if (orphanErr) throw new Error(orphanErr.message)

  const existingAccordIds = new Set(dossier.accords.map(a => (a as { id: string }).id))
  const nomNorm = client.nom.trim().toLowerCase()
  const emailNorm = (client.email || '').trim().toLowerCase()

  for (const a of orphanAccords || []) {
    if (existingAccordIds.has(a.id as string)) continue
    const ac = accordToClient(a as Record<string, unknown>)
    if (ac.id && cid && ac.id === cid) continue
    const sameIdentity =
      ac.nom.trim().toLowerCase() === nomNorm
      && (!emailNorm || !ac.email || ac.email.trim().toLowerCase() === emailNorm)
    if (!sameIdentity) continue
    dossier.accords.push(a)
    touchDate(dossier, (a.valide_at as string) || (a.created_at as string))
  }

  return dossier
}

/** Résout un client à partir de client_id ou nom+email. */
export async function resolveClientForDossier(
  sb: SupabaseClient,
  params: { clientId?: string; nom?: string; email?: string },
): Promise<ClientLike | null> {
  const clientId = params.clientId?.trim()
  if (clientId) {
    const { data, error } = await sb
      .from('clients')
      .select('id, nom, email, telephone, adresse, code_postal, ville')
      .eq('id', clientId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return data as ClientLike
  }

  const nom = params.nom?.trim()
  if (!nom) return null

  const email = params.email?.trim().toLowerCase()
  const { data: byNom, error } = await sb
    .from('clients')
    .select('id, nom, email, telephone, adresse, code_postal, ville')
    .ilike('nom', nom)
    .range(0, 20)

  if (error) throw new Error(error.message)
  const rows = (byNom || []) as ClientLike[]
  if (rows.length === 1) return rows[0]
  if (rows.length > 1 && email) {
    const match = rows.find(r => (r.email || '').trim().toLowerCase() === email)
    if (match) return match
  }
  if (rows.length > 0) return rows[0]

  return {
    id: null,
    nom,
    email: params.email?.trim() || null,
    telephone: null,
    adresse: null,
    code_postal: null,
    ville: null,
  }
}

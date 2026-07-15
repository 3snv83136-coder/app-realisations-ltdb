'use client'
import { useState } from "react"
import Link from "next/link"
import LtdbLogoLink from "@/components/LtdbLogoLink"

type Client = {
  id: string | null
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

type Intervention = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_realisee: string | null
  date_prevue: string | null
  statut: string | null
  agence: string | null
  publie_slug: string | null
  pdf_rapport_url: string | null
  created_at: string
  client_id: string | null
  technicien_nom: string | null
  has_rapport: boolean
  client_nom: string | null
  client_email: string | null
  client_ville: string | null
}

type DocRow = {
  id: string
  type: string
  numero: string | null
  agence: string | null
  date_emission: string | null
  echeance: string | null
  statut: string | null
  montant_ht: number | null
  montant_ttc: number | null
  pdf_url: string | null
  envoye_email: string | null
  envoye_at: string | null
  intervention_id: string | null
  client_id: string | null
  created_at: string
  client_nom: string | null
  client_email: string | null
  client_ville: string | null
}

type AccordRow = {
  id: string
  reference: string | null
  statut: string
  total_ttc: number | null
  valide_at: string | null
  created_at: string
  pdf_url: string | null
  intervention_id: string | null
}

type ClientDossier = {
  key: string
  client: Client
  interventions: Intervention[]
  documents: DocRow[]
  accords: AccordRow[]
  caTotal: number
  caPaye: number
  lastDate: string | null
}

type ClientSummary = {
  key: string
  client: Client
  derniereIntervention: string | null
  derniereInterventionDate: string | null
  lastDate: string | null
}

const TYPE_LABEL: Record<string, string> = {
  facture: 'Facture',
  devis: 'Devis',
  attestation: 'Attestation',
  rapport: 'Rapport',
}

const ACCORD_STATUT_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_ATTENTE_SMS: 'En attente SMS',
  VALIDE: 'Validé',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
}

function fmtMontant(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v).replace(/\r?\n/g, ' ')
  if (s.includes(';') || s.includes('"') || s.includes(',')) {
    s = '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const BOM = '﻿'
  const csv = BOM + rows.map(r => r.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function hasFilters(f: { nom: string; telephone: string; email: string; ville: string }): boolean {
  return !!(f.nom.trim() || f.telephone.trim() || f.email.trim() || f.ville.trim())
}

export default function ClientsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<ClientSummary[]>([])
  const [dossiersByKey, setDossiersByKey] = useState<Record<string, ClientDossier>>({})
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>({})
  const [detailError, setDetailError] = useState<Record<string, string>>({})
  const [searched, setSearched] = useState(false)

  const [filterNom, setFilterNom] = useState('')
  const [filterTelephone, setFilterTelephone] = useState('')
  const [filterEmail, setFilterEmail] = useState('')
  const [filterVille, setFilterVille] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [sendModal, setSendModal] = useState<{ open: boolean; dossier: ClientDossier | null; email: string; sending: boolean; status: string | null }>({
    open: false, dossier: null, email: '', sending: false, status: null,
  })

  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [editModal, setEditModal] = useState<{
    open: boolean
    id: string | null
    form: { nom: string; email: string; telephone: string; adresse: string; code_postal: string; ville: string }
    saving: boolean
    error: string | null
  }>({
    open: false, id: null,
    form: { nom: '', email: '', telephone: '', adresse: '', code_postal: '', ville: '' },
    saving: false, error: null,
  })

  function openEditModal(d: ClientDossier) {
    if (!d.client.id) {
      setDeleteError(`"${d.client.nom}" n'est pas une fiche client enregistrée — rien à modifier. Crée d'abord une intervention liée pour qu'une fiche existe.`)
      return
    }
    setEditModal({
      open: true,
      id: d.client.id,
      form: {
        nom: d.client.nom || '',
        email: d.client.email || '',
        telephone: d.client.telephone || '',
        adresse: d.client.adresse || '',
        code_postal: d.client.code_postal || '',
        ville: d.client.ville || '',
      },
      saving: false, error: null,
    })
  }

  async function saveEditClient() {
    if (!editModal.id) return
    const nom = editModal.form.nom.trim()
    if (!nom) {
      setEditModal(s => ({ ...s, error: 'Le nom est obligatoire.' }))
      return
    }
    setEditModal(s => ({ ...s, saving: true, error: null }))
    try {
      const res = await fetch(`/api/clients/${editModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom,
          email: editModal.form.email,
          telephone: editModal.form.telephone,
          adresse: editModal.form.adresse,
          code_postal: editModal.form.code_postal,
          ville: editModal.form.ville,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      const updated = body?.client as Client | undefined
      if (updated) {
        setDossiersByKey(prev => {
          const next = { ...prev }
          for (const [k, d] of Object.entries(next)) {
            if (d.client.id === updated.id) {
              next[k] = { ...d, client: { ...d.client, ...updated } }
            }
          }
          return next
        })
        setSummaries(prev => prev.map(s => (
          s.client.id === updated.id
            ? { ...s, client: { ...s.client, ...updated } }
            : s
        )))
      }
      setEditModal(s => ({ ...s, open: false, saving: false }))
    } catch (e) {
      setEditModal(s => ({ ...s, saving: false, error: e instanceof Error ? e.message : 'Échec' }))
    }
  }

  async function handleDeleteClient(d: ClientDossier) {
    setDeleteError(null)
    const id = d.client.id
    if (!id) {
      setDeleteError(`"${d.client.nom}" n'est pas un client enregistré en base (agrégé depuis des interventions sans fiche client) — rien à supprimer.`)
      return
    }
    if (d.interventions.length > 0 || d.documents.length > 0 || d.accords.length > 0) {
      const parts: string[] = []
      if (d.interventions.length > 0) parts.push(`${d.interventions.length} intervention(s)`)
      if (d.documents.length > 0) parts.push(`${d.documents.length} document(s)`)
      if (d.accords.length > 0) parts.push(`${d.accords.length} accord(s)`)
      setDeleteError(`Impossible de supprimer "${d.client.nom}" : ${parts.join(' et ')} y ${parts.length > 1 ? 'sont' : 'est'} rattaché(s). Supprime-les d'abord depuis l'historique.`)
      return
    }
    if (!confirm(`Supprimer définitivement le client "${d.client.nom}" ? Cette action est irréversible.`)) return
    setDeletingKey(d.key)
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      setSummaries(prev => prev.filter(s => s.client.id !== id))
      setDossiersByKey(prev => {
        const next = { ...prev }
        delete next[d.key]
        return next
      })
      setExpanded(s => { const next = { ...s }; delete next[d.key]; return next })
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Suppression échouée')
    } finally {
      setDeletingKey(null)
    }
  }

  async function loadDossierDetail(summary: ClientSummary): Promise<ClientDossier | null> {
    if (dossiersByKey[summary.key]) return dossiersByKey[summary.key]
    setLoadingDetail(s => ({ ...s, [summary.key]: true }))
    setDetailError(s => ({ ...s, [summary.key]: '' }))
    try {
      const params = new URLSearchParams()
      if (summary.client.id) params.set('client_id', summary.client.id)
      else {
        params.set('nom', summary.client.nom)
        if (summary.client.email) params.set('email', summary.client.email)
      }
      const res = await fetch(`/api/clients/dossier?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const dossier = data.dossier as ClientDossier
      setDossiersByKey(s => ({ ...s, [summary.key]: dossier }))
      return dossier
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement'
      setDetailError(s => ({ ...s, [summary.key]: msg }))
      return null
    } finally {
      setLoadingDetail(s => ({ ...s, [summary.key]: false }))
    }
  }

  async function toggleClient(summary: ClientSummary) {
    const key = summary.key
    const willOpen = !expanded[key]
    setExpanded(s => ({ ...s, [key]: willOpen }))
    if (willOpen && !dossiersByKey[key] && !loadingDetail[key]) {
      await loadDossierDetail(summary)
    }
  }

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!hasFilters({ nom: filterNom, telephone: filterTelephone, email: filterEmail, ville: filterVille })) {
      setError('Indique au moins un critère : nom, téléphone, email ou ville.')
      setSearched(false)
      setSummaries([])
      setDossiersByKey({})
      setExpanded({})
      return
    }
    setLoading(true)
    setError(null)
    setSearched(true)
    setDossiersByKey({})
    setExpanded({})
    setDetailError({})
    try {
      const params = new URLSearchParams()
      if (filterNom.trim()) params.set('nom', filterNom.trim())
      if (filterTelephone.trim()) params.set('telephone', filterTelephone.trim())
      if (filterEmail.trim()) params.set('email', filterEmail.trim())
      if (filterVille.trim()) params.set('ville', filterVille.trim())
      const res = await fetch(`/api/clients/search?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSummaries((data.results || []) as ClientSummary[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de recherche')
      setSummaries([])
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    setFilterNom('')
    setFilterTelephone('')
    setFilterEmail('')
    setFilterVille('')
    setSummaries([])
    setDossiersByKey({})
    setExpanded({})
    setDetailError({})
    setSearched(false)
    setError(null)
  }

  const loadedDossiers = Object.values(dossiersByKey)
  const totalCa = loadedDossiers.reduce((s, d) => s + d.caTotal, 0)
  const totalInterv = loadedDossiers.reduce((s, d) => s + d.interventions.length, 0)
  const totalDocs = loadedDossiers.reduce((s, d) => s + d.documents.length, 0)
  const totalAccords = loadedDossiers.reduce((s, d) => s + d.accords.length, 0)

  function exportClientCsv(d: ClientDossier) {
    const safeName = (d.client.nom || 'client').replace(/[^\w\-]+/g, '_').toLowerCase()
    const rows: (string | number | null | undefined)[][] = []
    rows.push(['Type', 'Date', 'Référence/N°', 'Objet', 'Ville', 'Statut', 'Montant TTC', 'Lien PDF'])
    for (const i of d.interventions) {
      rows.push([
        'Intervention',
        fmtDate(i.date_realisee || i.date_prevue || i.created_at),
        i.reference || '',
        i.type_intervention || '',
        i.ville || '',
        i.statut || '',
        '',
        i.pdf_rapport_url || '',
      ])
    }
    for (const doc of d.documents) {
      rows.push([
        TYPE_LABEL[doc.type] || doc.type,
        fmtDate(doc.date_emission || doc.created_at),
        doc.numero || '',
        '',
        '',
        doc.statut || '',
        doc.montant_ttc !== null && doc.montant_ttc !== undefined
          ? doc.montant_ttc.toFixed(2).replace('.', ',') : '',
        doc.pdf_url || '',
      ])
    }
    for (const a of d.accords) {
      rows.push([
        'Accord',
        fmtDate(a.valide_at || a.created_at),
        a.reference || '',
        '',
        '',
        a.statut || '',
        a.total_ttc !== null && a.total_ttc !== undefined
          ? a.total_ttc.toFixed(2).replace('.', ',') : '',
        a.pdf_url || '',
      ])
    }
    downloadCsv(`ltdb-client-${safeName}.csv`, rows)
  }

  function exportAllCsv() {
    const rows: (string | number | null | undefined)[][] = []
    rows.push(['Client', 'Email', 'Téléphone', 'Ville', 'Dernière intervention', 'Nb interventions', 'Nb documents', 'Nb accords', 'CA total TTC', 'CA payé TTC', 'Dernière activité'])
    for (const s of summaries) {
      const d = dossiersByKey[s.key]
      rows.push([
        s.client.nom,
        s.client.email || '',
        s.client.telephone || '',
        s.client.ville || '',
        s.derniereIntervention || '',
        d?.interventions.length ?? '',
        d?.documents.length ?? '',
        d?.accords.length ?? '',
        d ? d.caTotal.toFixed(2).replace('.', ',') : '',
        d ? d.caPaye.toFixed(2).replace('.', ',') : '',
        fmtDate(d?.lastDate || s.lastDate),
      ])
    }
    downloadCsv('ltdb-clients.csv', rows)
  }

  function openSendModal(d: ClientDossier) {
    setSendModal({ open: true, dossier: d, email: d.client.email || '', sending: false, status: null })
  }

  async function submitSend() {
    if (!sendModal.dossier) return
    if (!sendModal.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(sendModal.email)) {
      setSendModal(s => ({ ...s, status: 'Email invalide' }))
      return
    }
    setSendModal(s => ({ ...s, sending: true, status: null }))
    try {
      const d = sendModal.dossier
      const res = await fetch('/api/clients/send-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sendModal.email,
          clientNom: d.client.nom,
          ville: d.client.ville || '',
          interventions: d.interventions.map(i => ({
            reference: i.reference,
            date: i.date_realisee || i.date_prevue,
            type: i.type_intervention,
            ville: i.ville,
            statut: i.statut,
          })),
          documents: d.documents.map(doc => ({
            type: doc.type,
            numero: doc.numero,
            date: doc.date_emission,
            montant_ttc: doc.montant_ttc,
            statut: doc.statut,
            pdf_url: doc.pdf_url,
          })),
          accords: d.accords.map(a => ({
            reference: a.reference,
            date: a.valide_at || a.created_at,
            statut: a.statut,
            montant_ttc: a.total_ttc,
            pdf_url: a.pdf_url,
          })),
          caTotal: d.caTotal,
          caPaye: d.caPaye,
        }),
      })
      const j = await res.json()
      if (!res.ok || j.error) {
        setSendModal(s => ({ ...s, sending: false, status: j.error || 'Erreur envoi' }))
        return
      }
      setSendModal(s => ({ ...s, sending: false, status: 'Envoyé ✓' }))
      setTimeout(() => setSendModal({ open: false, dossier: null, email: '', sending: false, status: null }), 1500)
    } catch (e) {
      setSendModal(s => ({ ...s, sending: false, status: e instanceof Error ? e.message : 'Erreur' }))
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <LtdbLogoLink variant="banner" className="text-white" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">Clients</span>
          </div>
          <Link href="/" className="text-xs text-white/70 hover:text-white">← Accueil</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats résumé */}
        {searched && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Clients" value={String(summaries.length)} />
            <Stat label="Interventions" value={loadedDossiers.length > 0 ? String(totalInterv) : '—'} hint="dossiers ouverts" />
            <Stat label="Documents" value={loadedDossiers.length > 0 ? String(totalDocs) : '—'} hint="dossiers ouverts" />
            <Stat label="Accords" value={loadedDossiers.length > 0 ? String(totalAccords) : '—'} hint="dossiers ouverts" />
            <Stat label="CA total" value={loadedDossiers.length > 0 ? fmtMontant(totalCa) : '—'} hint="dossiers ouverts" />
          </div>
        )}

        {/* Filtres */}
        <form onSubmit={runSearch} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <p className="text-sm text-slate-600">
            Recherche un client par <strong>nom</strong>, <strong>téléphone</strong>, <strong>email</strong> ou <strong>ville</strong> — clique sur une ligne pour charger le dossier complet (rapports, factures, devis, accords).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Nom"
              value={filterNom}
              onChange={e => setFilterNom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
            <input
              type="tel"
              placeholder="Téléphone"
              value={filterTelephone}
              onChange={e => setFilterTelephone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={filterEmail}
              onChange={e => setFilterEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
            <input
              type="text"
              placeholder="Ville"
              value={filterVille}
              onChange={e => setFilterVille(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500">
              {searched
                ? `${summaries.length} client${summaries.length > 1 ? 's' : ''} trouvé${summaries.length > 1 ? 's' : ''}`
                : 'Aucune recherche lancée'}
            </div>
            <div className="flex gap-2">
              {searched && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"
                >Réinitialiser</button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 text-xs rounded-lg bg-[#0e2a52] text-white hover:bg-[#0a1f3d] disabled:opacity-40"
              >{loading ? 'Recherche…' : '🔍 Rechercher'}</button>
              <button
                type="button"
                onClick={exportAllCsv}
                disabled={summaries.length === 0}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >📥 Exporter CSV</button>
            </div>
          </div>
        </form>

        {/* Liste */}
        {loading && <div className="text-center py-12 text-slate-500 text-sm">Chargement…</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
        {deleteError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start justify-between gap-3 mb-3">
            <span>⚠ {deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="text-amber-600 hover:text-amber-900 font-bold shrink-0">✕</button>
          </div>
        )}
        {!loading && !error && searched && summaries.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">Aucun client ne correspond à ces critères.</div>
        )}
        {!searched && !loading && (
          <div className="text-center py-16 text-slate-400 text-sm">
            Saisis au moins un critère puis clique sur <strong>Rechercher</strong> pour afficher la liste des clients.
          </div>
        )}

        {summaries.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              <div className="col-span-3">Nom</div>
              <div className="col-span-2">Téléphone</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-3">Dernière intervention</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y divide-slate-100">
              {summaries.map(s => {
                const isOpen = !!expanded[s.key]
                const d = dossiersByKey[s.key]
                const isLoadingDetail = !!loadingDetail[s.key]
                const errDetail = detailError[s.key]
                return (
                  <div key={s.key}>
                    <button
                      type="button"
                      onClick={() => void toggleClient(s)}
                      className="w-full px-4 py-3 sm:py-3.5 flex flex-col sm:grid sm:grid-cols-12 gap-1 sm:gap-3 sm:items-center hover:bg-slate-50 text-left transition-colors"
                    >
                      <div className="sm:col-span-3 font-semibold text-sm truncate">{s.client.nom}</div>
                      <div className="sm:col-span-2 text-sm text-slate-600 truncate">
                        <span className="sm:hidden text-slate-400 text-xs mr-1">Tél.</span>
                        {s.client.telephone || '—'}
                      </div>
                      <div className="sm:col-span-3 text-sm text-slate-600 truncate">
                        <span className="sm:hidden text-slate-400 text-xs mr-1">Email</span>
                        {s.client.email || '—'}
                      </div>
                      <div className="sm:col-span-3 text-sm text-slate-600 truncate">
                        <span className="sm:hidden text-slate-400 text-xs mr-1">Intervention</span>
                        {s.derniereIntervention || '—'}
                        {s.derniereInterventionDate && (
                          <span className="text-slate-400 text-xs ml-1">({fmtDate(s.derniereInterventionDate)})</span>
                        )}
                      </div>
                      <div className="hidden sm:flex sm:col-span-1 justify-end">
                        <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-4">
                        {isLoadingDetail && (
                          <p className="text-sm text-slate-500">Chargement du dossier…</p>
                        )}
                        {errDetail && !isLoadingDetail && (
                          <p className="text-sm text-red-600">{errDetail}</p>
                        )}
                        {d && !isLoadingDetail && (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => openEditModal(d)}
                                disabled={!d.client.id}
                                title={d.client.id ? 'Modifier les coordonnées' : 'Pas de fiche enregistrée'}
                                className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                              >✏️ Modifier</button>
                              <button
                                onClick={() => exportClientCsv(d)}
                                className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 hover:bg-slate-100"
                              >📥 Exporter ce client (CSV)</button>
                              <button
                                onClick={() => openSendModal(d)}
                                disabled={!d.client.email && !d.documents.length && !d.interventions.length && !d.accords.length}
                                className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                              >✉ Envoyer le récap</button>
                              <button
                                onClick={() => handleDeleteClient(d)}
                                disabled={deletingKey === d.key}
                                className="px-3 py-1.5 text-xs rounded-lg bg-white border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                              >{deletingKey === d.key ? '⏳ Suppression…' : '🗑 Supprimer ce client'}</button>
                            </div>
                            {(d.interventions.length > 0 || d.documents.length > 0 || d.accords.length > 0) && (
                              <p className="text-[11px] text-slate-500">
                                ⚠ Ce client a {d.interventions.length} intervention(s), {d.documents.length} document(s) et {d.accords.length} accord(s) liés.
                                Sa suppression est bloquée tant qu&apos;ils existent.
                              </p>
                            )}

                            {(() => {
                              const rapports = d.interventions.filter(i => i.has_rapport)
                              const interventionsSansRapport = d.interventions.filter(i => !i.has_rapport)
                              const factures = d.documents.filter(doc => doc.type === 'facture')
                              const devis = d.documents.filter(doc => doc.type === 'devis')
                              const attestations = d.documents.filter(doc => doc.type === 'attestation')
                              const accords = d.accords
                              return (
                                <>
                                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                                    <Pill className="bg-indigo-50 text-indigo-700 border-indigo-100">📝 {rapports.length} rapport{rapports.length > 1 ? 's' : ''}</Pill>
                                    <Pill className="bg-emerald-50 text-emerald-700 border-emerald-100">🧾 {factures.length} facture{factures.length > 1 ? 's' : ''}</Pill>
                                    <Pill className="bg-amber-50 text-amber-700 border-amber-100">📋 {devis.length} devis</Pill>
                                    <Pill className="bg-violet-50 text-violet-700 border-violet-100">🤝 {accords.length} accord{accords.length > 1 ? 's' : ''}</Pill>
                                    <Pill className="bg-stone-50 text-stone-700 border-stone-100">✅ {attestations.length} attestation{attestations.length > 1 ? 's' : ''}</Pill>
                                  </div>

                                  <DocSection title="📝 Rapports d'intervention" count={rapports.length} accent="indigo">
                                    {rapports.map(i => (
                                      <div
                                        key={i.id}
                                        className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <span className="font-medium">{i.reference || i.id.slice(0, 8)}</span>
                                          {i.type_intervention && <span className="text-slate-500"> · {i.type_intervention}</span>}
                                          {i.ville && <span className="text-slate-500"> · {i.ville}</span>}
                                        </div>
                                        <div className="text-xs text-slate-600 shrink-0 flex items-center gap-3">
                                          <span className="text-slate-500">{fmtDate(i.date_realisee || i.date_prevue || i.created_at)}</span>
                                          {i.pdf_rapport_url && (
                                            <a href={i.pdf_rapport_url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-[11px]">📄 PDF</a>
                                          )}
                                          <Link href={`/intervention/${i.id}`} className="text-[#0e2a52] hover:underline">Voir →</Link>
                                        </div>
                                      </div>
                                    ))}
                                  </DocSection>

                                  <DocSection title="🧾 Factures" count={factures.length} accent="emerald">
                                    {factures.map(doc => (
                                      <DocRowView key={doc.id} doc={doc} />
                                    ))}
                                  </DocSection>

                                  <DocSection title="📋 Devis" count={devis.length} accent="amber">
                                    {devis.map(doc => (
                                      <DocRowView key={doc.id} doc={doc} />
                                    ))}
                                  </DocSection>

                                  <DocSection title="🤝 Accords d'intervention" count={accords.length} accent="violet">
                                    {accords.map(a => (
                                      <AccordRowView key={a.id} accord={a} />
                                    ))}
                                  </DocSection>

                                  <DocSection title="✅ Attestations" count={attestations.length} accent="stone">
                                    {attestations.map(doc => (
                                      <DocRowView key={doc.id} doc={doc} />
                                    ))}
                                  </DocSection>

                                  {interventionsSansRapport.length > 0 && (
                                    <DocSection title="📅 Interventions sans rapport" count={interventionsSansRapport.length} accent="slate">
                                      {interventionsSansRapport.map(i => (
                                        <Link
                                          key={i.id}
                                          href={`/intervention/${i.id}`}
                                          className="block bg-white border border-slate-200 rounded-lg px-3 py-2 hover:border-[#0e2a52] hover:bg-slate-50"
                                        >
                                          <div className="flex items-center justify-between gap-3 text-sm">
                                            <div className="flex-1 min-w-0">
                                              <span className="font-medium">{i.reference || i.id.slice(0, 8)}</span>
                                              {i.type_intervention && <span className="text-slate-500"> · {i.type_intervention}</span>}
                                              {i.ville && <span className="text-slate-500"> · {i.ville}</span>}
                                            </div>
                                            <div className="text-xs text-slate-500 shrink-0">
                                              {fmtDate(i.date_realisee || i.date_prevue || i.created_at)}
                                              {i.statut && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase ${statutClass(i.statut)}`}>{i.statut}</span>}
                                            </div>
                                          </div>
                                        </Link>
                                      ))}
                                    </DocSection>
                                  )}

                                  {d.interventions.length === 0 && d.documents.length === 0 && d.accords.length === 0 && (
                                    <div className="text-xs text-slate-500 italic">Aucune intervention, document ni accord pour ce client.</div>
                                  )}
                                </>
                              )
                            })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modale envoi récap */}
      {sendModal.open && sendModal.dossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Envoyer le récap au client</h3>
              <button onClick={() => setSendModal({ open: false, dossier: null, email: '', sending: false, status: null })} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Récap pour <strong>{sendModal.dossier.client.nom}</strong> : {sendModal.dossier.interventions.length} intervention(s), {sendModal.dossier.documents.length} document(s) et {sendModal.dossier.accords.length} accord(s).
            </p>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email destinataire</label>
            <input
              type="email"
              value={sendModal.email}
              onChange={e => setSendModal(s => ({ ...s, email: e.target.value, status: null }))}
              placeholder="client@exemple.fr"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
            {sendModal.status && (
              <div className={`mt-3 text-sm ${sendModal.status === 'Envoyé ✓' ? 'text-emerald-600' : 'text-red-600'}`}>{sendModal.status}</div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSendModal({ open: false, dossier: null, email: '', sending: false, status: null })} className="px-3 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50">Annuler</button>
              <button onClick={submitSend} disabled={sendModal.sending} className="px-3 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {sendModal.sending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale édition fiche client */}
      {editModal.open && editModal.id && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => !editModal.saving && setEditModal(s => ({ ...s, open: false }))}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-lg shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[#0e2a52]">Modifier la fiche client</h3>
              <button
                onClick={() => setEditModal(s => ({ ...s, open: false }))}
                disabled={editModal.saving}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >×</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block sm:col-span-2">
                <span className="block text-xs font-medium text-slate-600 mb-1">Nom *</span>
                <input
                  type="text"
                  value={editModal.form.nom}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, nom: e.target.value }, error: null }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
                <input
                  type="email"
                  value={editModal.form.email}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, email: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Téléphone</span>
                <input
                  type="tel"
                  value={editModal.form.telephone}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, telephone: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="block text-xs font-medium text-slate-600 mb-1">Adresse</span>
                <input
                  type="text"
                  value={editModal.form.adresse}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, adresse: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Code postal</span>
                <input
                  type="text"
                  value={editModal.form.code_postal}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, code_postal: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">Ville</span>
                <input
                  type="text"
                  value={editModal.form.ville}
                  onChange={e => setEditModal(s => ({ ...s, form: { ...s.form, ville: e.target.value } }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
                  disabled={editModal.saving}
                />
              </label>
            </div>

            {editModal.error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                ⚠ {editModal.error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setEditModal(s => ({ ...s, open: false }))}
                disabled={editModal.saving}
                className="px-4 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              >Annuler</button>
              <button
                onClick={saveEditClient}
                disabled={editModal.saving || !editModal.form.nom.trim()}
                className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >{editModal.saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-xl sm:text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[9px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  )
}

function Pill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-100 ${className}`}>{children}</span>
  )
}

function statutClass(s: string): string {
  switch (s) {
    case 'planifiee': return 'bg-blue-100 text-blue-700'
    case 'en_cours': return 'bg-amber-100 text-amber-700'
    case 'terminee': return 'bg-emerald-100 text-emerald-700'
    case 'annulee': return 'bg-slate-200 text-slate-600'
    default: return 'bg-slate-100 text-slate-600'
  }
}

type Accent = 'indigo' | 'emerald' | 'amber' | 'stone' | 'slate' | 'violet'

const ACCENT_CLASSES: Record<Accent, string> = {
  indigo: 'text-indigo-700 border-indigo-100 bg-indigo-50/50',
  emerald: 'text-emerald-700 border-emerald-100 bg-emerald-50/50',
  amber: 'text-amber-700 border-amber-100 bg-amber-50/50',
  stone: 'text-stone-700 border-stone-100 bg-stone-50/50',
  slate: 'text-slate-700 border-slate-100 bg-slate-50/50',
  violet: 'text-violet-700 border-violet-100 bg-violet-50/50',
}

function DocSection({ title, count, accent, children }: { title: string; count: number; accent: Accent; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div>
      <div className={`text-[11px] uppercase tracking-wider font-semibold mb-2 px-2 py-1 inline-block rounded border ${ACCENT_CLASSES[accent]}`}>
        {title} ({count})
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function DocRowView({ doc }: { doc: DocRow }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium">{doc.numero || (TYPE_LABEL[doc.type] || doc.type)}</span>
        {doc.statut && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase ${docStatutClass(doc.statut)}`}>{doc.statut}</span>}
      </div>
      <div className="text-xs text-slate-600 shrink-0 flex items-center gap-3">
        {typeof doc.montant_ttc === 'number' && <span className="font-medium">{fmtMontant(doc.montant_ttc)}</span>}
        <span className="text-slate-500">{fmtDate(doc.date_emission || doc.created_at)}</span>
        {doc.pdf_url && (
          <a href={doc.pdf_url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-[#0e2a52] text-white hover:bg-[#0a1f3d] text-[11px]">📄 PDF</a>
        )}
      </div>
    </div>
  )
}

function AccordRowView({ accord }: { accord: AccordRow }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium">{accord.reference || accord.id.slice(0, 8)}</span>
        {accord.statut && (
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase ${accordStatutClass(accord.statut)}`}>
            {ACCORD_STATUT_LABEL[accord.statut] || accord.statut}
          </span>
        )}
      </div>
      <div className="text-xs text-slate-600 shrink-0 flex items-center gap-3">
        {typeof accord.total_ttc === 'number' && <span className="font-medium">{fmtMontant(accord.total_ttc)}</span>}
        <span className="text-slate-500">{fmtDate(accord.valide_at || accord.created_at)}</span>
        {accord.pdf_url && (
          <a href={accord.pdf_url} target="_blank" rel="noreferrer" className="px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 text-[11px]">📄 PDF</a>
        )}
        <Link href={`/accord/${accord.id}`} className="text-[#0e2a52] hover:underline">Voir →</Link>
      </div>
    </div>
  )
}

function accordStatutClass(s: string): string {
  switch (s) {
    case 'VALIDE': return 'bg-emerald-100 text-emerald-700'
    case 'BROUILLON': return 'bg-slate-100 text-slate-600'
    case 'REFUSE': return 'bg-red-100 text-red-700'
    case 'EN_ATTENTE_SMS': return 'bg-amber-100 text-amber-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function docStatutClass(s: string): string {
  switch (s) {
    case 'paye': return 'bg-emerald-100 text-emerald-700'
    case 'envoye': return 'bg-blue-100 text-blue-700'
    case 'brouillon': return 'bg-slate-100 text-slate-600'
    case 'relance': return 'bg-amber-100 text-amber-700'
    case 'impaye': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

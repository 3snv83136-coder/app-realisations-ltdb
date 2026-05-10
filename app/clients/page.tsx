'use client'
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

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

type ClientDossier = {
  key: string
  client: Client
  interventions: Intervention[]
  documents: DocRow[]
  caTotal: number
  caPaye: number
  lastDate: string | null
}

const TYPE_LABEL: Record<string, string> = {
  facture: 'Facture',
  devis: 'Devis',
  attestation: 'Attestation',
  rapport: 'Rapport',
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

function clientKey(c: { id: string | null; nom: string; email: string | null }): string {
  if (c.id) return `id:${c.id}`
  return `noid:${(c.nom || '').toLowerCase().trim()}|${(c.email || '').toLowerCase().trim()}`
}

export default function ClientsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allClients, setAllClients] = useState<Client[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [documents, setDocuments] = useState<DocRow[]>([])

  const [search, setSearch] = useState('')
  const [filterVille, setFilterVille] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [sendModal, setSendModal] = useState<{ open: boolean; dossier: ClientDossier | null; email: string; sending: boolean; status: string | null }>({
    open: false, dossier: null, email: '', sending: false, status: null,
  })

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true); setError(null)
      try {
        const [hRes, cRes] = await Promise.all([
          fetch('/api/historique?limit=500', { cache: 'no-store' }),
          fetch('/api/clients?limit=1000', { cache: 'no-store' }),
        ])
        const hJson = await hRes.json()
        const cJson = await cRes.json()
        if (!alive) return
        if (hJson.error) throw new Error(hJson.error)
        if (cJson.error) throw new Error(cJson.error)
        setInterventions(hJson.interventions || [])
        setDocuments(hJson.documents || [])
        setAllClients(cJson.clients || [])
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const dossiers = useMemo<ClientDossier[]>(() => {
    const map = new Map<string, ClientDossier>()

    const ensure = (c: Client): ClientDossier => {
      const k = clientKey(c)
      const existing = map.get(k)
      if (existing) {
        if (!existing.client.email && c.email) existing.client.email = c.email
        if (!existing.client.telephone && c.telephone) existing.client.telephone = c.telephone
        if (!existing.client.adresse && c.adresse) existing.client.adresse = c.adresse
        if (!existing.client.code_postal && c.code_postal) existing.client.code_postal = c.code_postal
        if (!existing.client.ville && c.ville) existing.client.ville = c.ville
        return existing
      }
      const fresh: ClientDossier = {
        key: k,
        client: { ...c },
        interventions: [],
        documents: [],
        caTotal: 0,
        caPaye: 0,
        lastDate: null,
      }
      map.set(k, fresh)
      return fresh
    }

    for (const c of allClients) ensure(c)

    for (const i of interventions) {
      const c: Client = {
        id: i.client_id,
        nom: i.client_nom || 'Client sans nom',
        email: i.client_email,
        telephone: null,
        adresse: null,
        code_postal: null,
        ville: i.client_ville || i.ville,
      }
      const d = ensure(c)
      d.interventions.push(i)
      const dt = i.date_realisee || i.date_prevue || i.created_at
      if (dt && (!d.lastDate || dt > d.lastDate)) d.lastDate = dt
    }

    for (const doc of documents) {
      const c: Client = {
        id: doc.client_id,
        nom: doc.client_nom || 'Client sans nom',
        email: doc.client_email,
        telephone: null,
        adresse: null,
        code_postal: null,
        ville: doc.client_ville,
      }
      const d = ensure(c)
      d.documents.push(doc)
      if (doc.type === 'facture' && typeof doc.montant_ttc === 'number') {
        d.caTotal += doc.montant_ttc
        if (doc.statut === 'paye') d.caPaye += doc.montant_ttc
      }
      const dt = doc.date_emission || doc.created_at
      if (dt && (!d.lastDate || dt > d.lastDate)) d.lastDate = dt
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate)
      if (a.lastDate) return -1
      if (b.lastDate) return 1
      return a.client.nom.localeCompare(b.client.nom, 'fr')
    })
  }, [allClients, interventions, documents])

  const villes = useMemo(() => {
    const set = new Set<string>()
    for (const d of dossiers) {
      if (d.client.ville) set.add(d.client.ville)
      for (const i of d.interventions) if (i.ville) set.add(i.ville)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [dossiers])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return dossiers.filter(d => {
      if (s) {
        const blob = [
          d.client.nom, d.client.email, d.client.ville, d.client.telephone,
          ...d.interventions.map(i => `${i.reference || ''} ${i.ville || ''} ${i.type_intervention || ''}`),
          ...d.documents.map(doc => `${doc.numero || ''} ${doc.type || ''}`),
        ].join(' ').toLowerCase()
        if (!blob.includes(s)) return false
      }
      if (filterVille) {
        const villesD = new Set<string>([
          ...(d.client.ville ? [d.client.ville] : []),
          ...d.interventions.map(i => i.ville || '').filter(Boolean),
        ])
        if (!villesD.has(filterVille)) return false
      }
      if (filterType) {
        const hasType = d.documents.some(doc => doc.type === filterType)
        if (!hasType) return false
      }
      if (from || to) {
        const inRange = (iso: string | null | undefined) => {
          if (!iso) return false
          const ymd = iso.slice(0, 10)
          if (from && ymd < from) return false
          if (to && ymd > to) return false
          return true
        }
        const anyMatch = d.interventions.some(i => inRange(i.date_realisee || i.date_prevue || i.created_at))
          || d.documents.some(doc => inRange(doc.date_emission || doc.created_at))
        if (!anyMatch) return false
      }
      return true
    })
  }, [dossiers, search, filterVille, filterType, from, to])

  const totalCa = filtered.reduce((s, d) => s + d.caTotal, 0)
  const totalInterv = filtered.reduce((s, d) => s + d.interventions.length, 0)
  const totalDocs = filtered.reduce((s, d) => s + d.documents.length, 0)

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
    downloadCsv(`ltdb-client-${safeName}.csv`, rows)
  }

  function exportAllCsv() {
    const rows: (string | number | null | undefined)[][] = []
    rows.push(['Client', 'Email', 'Téléphone', 'Ville', 'Nb interventions', 'Nb documents', 'CA total TTC', 'CA payé TTC', 'Dernière activité'])
    for (const d of filtered) {
      rows.push([
        d.client.nom,
        d.client.email || '',
        d.client.telephone || '',
        d.client.ville || '',
        d.interventions.length,
        d.documents.length,
        d.caTotal.toFixed(2).replace('.', ','),
        d.caPaye.toFixed(2).replace('.', ','),
        fmtDate(d.lastDate),
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
            <Link href="/" className="text-xl font-black tracking-tight hover:opacity-80">LTDB</Link>
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">Clients</span>
          </div>
          <Link href="/" className="text-xs text-white/70 hover:text-white">← Accueil</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats résumé */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Clients" value={String(filtered.length)} />
          <Stat label="Interventions" value={String(totalInterv)} />
          <Stat label="Documents" value={String(totalDocs)} />
          <Stat label="CA total" value={fmtMontant(totalCa)} />
        </div>

        {/* Filtres */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Rechercher (nom, email, ville, n°…)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="lg:col-span-2 w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            />
            <select
              value={filterVille}
              onChange={e => setFilterVille(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            >
              <option value="">Toutes villes</option>
              {villes.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm"
            >
              <option value="">Tout type doc</option>
              <option value="facture">Facture</option>
              <option value="devis">Devis</option>
              <option value="attestation">Attestation</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-500">{filtered.length} client{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</div>
            <div className="flex gap-2">
              {(search || filterVille || filterType || from || to) && (
                <button
                  onClick={() => { setSearch(''); setFilterVille(''); setFilterType(''); setFrom(''); setTo('') }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"
                >Réinitialiser</button>
              )}
              <button
                onClick={exportAllCsv}
                disabled={filtered.length === 0}
                className="px-3 py-1.5 text-xs rounded-lg bg-[#0e2a52] text-white hover:bg-[#0a1f3d] disabled:opacity-40"
              >📥 Exporter CSV</button>
            </div>
          </div>
        </div>

        {/* Liste */}
        {loading && <div className="text-center py-12 text-slate-500 text-sm">Chargement…</div>}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">Aucun client ne correspond aux filtres.</div>
        )}

        <div className="space-y-3">
          {filtered.map(d => {
            const isOpen = !!expanded[d.key]
            return (
              <div key={d.key} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(s => ({ ...s, [d.key]: !s[d.key] }))}
                  className="w-full px-4 sm:px-5 py-4 flex items-center gap-4 hover:bg-slate-50 text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
                    {(d.client.nom || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm sm:text-base truncate">{d.client.nom}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {[d.client.email, d.client.telephone, d.client.ville].filter(Boolean).join(' · ') || 'Aucun contact'}
                    </div>
                  </div>
                  <div className="hidden sm:flex gap-3 text-xs text-slate-600">
                    <Pill>{d.interventions.length} interv.</Pill>
                    <Pill>{d.documents.length} doc.</Pill>
                    {d.caTotal > 0 && <Pill className="bg-emerald-50 text-emerald-700 border-emerald-100">{fmtMontant(d.caTotal)}</Pill>}
                  </div>
                  <span className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => exportClientCsv(d)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-200 hover:bg-slate-100"
                      >📥 Exporter ce client (CSV)</button>
                      <button
                        onClick={() => openSendModal(d)}
                        disabled={!d.client.email && !d.documents.length && !d.interventions.length}
                        className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                      >✉ Envoyer le récap</button>
                    </div>

                    {d.interventions.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Interventions ({d.interventions.length})</div>
                        <div className="space-y-1.5">
                          {d.interventions.map(i => (
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
                        </div>
                      </div>
                    )}

                    {d.documents.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">Documents ({d.documents.length})</div>
                        <div className="space-y-1.5">
                          {d.documents.map(doc => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{TYPE_LABEL[doc.type] || doc.type}</span>
                                {doc.numero && <span className="text-slate-500"> · {doc.numero}</span>}
                                {doc.statut && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase ${docStatutClass(doc.statut)}`}>{doc.statut}</span>}
                              </div>
                              <div className="text-xs text-slate-600 shrink-0 flex items-center gap-3">
                                {typeof doc.montant_ttc === 'number' && <span className="font-medium">{fmtMontant(doc.montant_ttc)}</span>}
                                <span className="text-slate-500">{fmtDate(doc.date_emission || doc.created_at)}</span>
                                {doc.pdf_url && (
                                  <a href={doc.pdf_url} target="_blank" rel="noreferrer" className="text-[#0e2a52] hover:underline">PDF</a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {d.interventions.length === 0 && d.documents.length === 0 && (
                      <div className="text-xs text-slate-500 italic">Aucune intervention ni document pour ce client.</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
              Récap pour <strong>{sendModal.dossier.client.nom}</strong> : {sendModal.dossier.interventions.length} intervention(s) et {sendModal.dossier.documents.length} document(s).
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
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="text-xl sm:text-2xl font-bold mt-1">{value}</div>
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

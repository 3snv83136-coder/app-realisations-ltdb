'use client'

import { useEffect, useMemo, useState } from 'react'
import React from 'react'
import { fmtDateFR, fmtEUR } from '@/lib/format'
import { errorMessage } from '@/lib/error-message'
import { pdfDocumentToBase64 } from '@/lib/pdfToBase64'
import { ltdbFactureEmetteur } from '@/lib/emetteur'
import { FactureDocument, type FactureData } from '@/components/FacturePDF'

type FactureImpayee = {
  id: string
  numero: string | null
  date_emission: string
  echeance: string | null
  statut: string
  montant_ttc: number | null
  pdf_url: string | null
  client_nom: string
  client_email: string | null
}

type Groupe = {
  cle: string
  nom: string
  email: string | null
  count: number
  total_ttc: number
  factures: FactureImpayee[]
}

async function pdfManquant(facture: FactureImpayee): Promise<string> {
  const res = await fetch(`/api/historique/${facture.id}`, { cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `PDF ${facture.numero || facture.id}`)
  const payload = data?.document?.payload as FactureData | undefined
  if (!payload?.lignes) throw new Error(`Facture ${facture.numero || facture.id} sans contenu`)
  const emetteur = ltdbFactureEmetteur()
  const element = React.createElement(FactureDocument, {
    emetteur,
    client: { nom: facture.client_nom, adresseLignes: [] },
    facture: payload,
    phone: emetteur.telephone,
  })
  return pdfDocumentToBase64(element)
}

export default function FacturesImpayees() {
  const [groupes, setGroupes] = useState<Groupe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [recherche, setRecherche] = useState('')
  const [selection, setSelection] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [rib, setRib] = useState(true)
  const [envoi, setEnvoi] = useState('')

  async function charger() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/facture/impayees', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setGroupes(data.groupes || [])
    } catch (e) {
      setError(errorMessage(e) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void charger() }, [])

  const visibles = useMemo(() => {
    const needle = recherche.trim().toLowerCase()
    if (!needle) return groupes
    return groupes.filter(groupe =>
      groupe.nom.toLowerCase().includes(needle)
      || (groupe.email || '').toLowerCase().includes(needle)
      || groupe.factures.some(facture => (facture.numero || '').toLowerCase().includes(needle)),
    )
  }, [groupes, recherche])

  const choisi = groupes.find(groupe => groupe.cle === selection) || null

  function ouvrir(groupe: Groupe) {
    setSelection(groupe.cle)
    setEmail(groupe.email || '')
    setError('')
    setInfo('')
  }

  async function envoyer() {
    if (!choisi) return
    if (!email.trim()) {
      setError('Indique l’adresse email du client.')
      return
    }
    const confirmation = window.confirm(
      `Envoyer ${choisi.count} facture${choisi.count > 1 ? 's' : ''} à ${email.trim()} dans un seul mail ?`,
    )
    if (!confirmation) return

    setError('')
    setInfo('')
    const pdfs: Record<string, string> = {}
    try {
      const sansPdf = choisi.factures.filter(facture => !facture.pdf_url)
      for (let i = 0; i < sansPdf.length; i += 1) {
        setEnvoi(`Préparation du PDF ${i + 1}/${sansPdf.length}`)
        pdfs[sansPdf[i].id] = await pdfManquant(sansPdf[i])
      }
      setEnvoi('Envoi du mail…')
      const res = await fetch('/api/facture/impayees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cle: choisi.cle,
          email: email.trim(),
          joindreRib: rib,
          pdfs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInfo(`${data.count} facture${data.count > 1 ? 's' : ''} envoyée${data.count > 1 ? 's' : ''} à ${email.trim()} en un seul mail${data.rib_joint ? ', avec le RIB' : ''}.`)
      setSelection(null)
      await charger()
    } catch (e) {
      setError(errorMessage(e) || 'Envoi impossible')
    } finally {
      setEnvoi('')
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div>
          <h2 className="font-bold text-[#0e2a52]">Factures non payées</h2>
          <p className="text-sm text-slate-500 mt-1">
            Choisis un client, par exemple un syndic. Un seul mail part, avec toutes ses factures encore dues en pièces jointes.
          </p>
        </div>
        <input
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un client, Procura…"
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 text-sm min-h-[44px]"
        />
      </section>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
      {info && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{info}</div>}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">Chargement…</div>
      ) : visibles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
          Aucune facture en attente.
        </div>
      ) : (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 text-left">Client</th>
                  <th className="px-3 py-2 text-right">Factures</th>
                  <th className="px-3 py-2 text-right">Total TTC</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(groupe => (
                  <tr key={groupe.cle} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-800">{groupe.nom}</div>
                      <div className="text-xs text-slate-500">{groupe.email || 'Email à saisir'}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{groupe.count}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#0e2a52] tabular-nums whitespace-nowrap">{fmtEUR(groupe.total_ttc)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => ouvrir(groupe)}
                        className="px-3 py-2 rounded-xl bg-[#0e2a52] text-white text-xs font-bold min-h-[44px]"
                      >
                        Voir et envoyer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {choisi && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-[#0e2a52]">{choisi.nom}</h3>
              <p className="text-sm text-slate-500">{choisi.count} facture{choisi.count > 1 ? 's' : ''} · {fmtEUR(choisi.total_ttc)}</p>
            </div>
            <button type="button" onClick={() => setSelection(null)} className="text-sm font-semibold text-slate-500 min-h-[44px] px-2">
              Fermer
            </button>
          </div>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {choisi.factures.map(facture => (
              <li key={facture.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-mono font-bold text-[#0e2a52]">{facture.numero || '—'}</span>
                  <span className="text-slate-500"> · {fmtDateFR(facture.date_emission)}</span>
                </span>
                <span className="font-semibold tabular-nums">{fmtEUR(facture.montant_ttc)}</span>
              </li>
            ))}
          </ul>
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Email du client</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 mt-1 min-h-[44px]"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 min-h-[44px]">
            <input type="checkbox" checked={rib} onChange={e => setRib(e.target.checked)} className="w-4 h-4" />
            Joindre le RIB
          </label>
          <button
            type="button"
            onClick={() => void envoyer()}
            disabled={Boolean(envoi)}
            className="px-4 py-3 rounded-xl bg-[#0e2a52] text-white font-bold min-h-[48px] disabled:opacity-60"
          >
            {envoi || `Envoyer les ${choisi.count} factures`}
          </button>
        </section>
      )}
    </div>
  )
}

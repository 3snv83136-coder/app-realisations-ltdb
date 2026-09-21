'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { fmtDateFR } from '@/lib/format'
import type { HistoriqueDocument } from '@/components/DocumentDownloadButton'

const DocumentDownloadButton = dynamic(() => import('@/components/DocumentDownloadButton'), { ssr: false })
const ResendEmailButton = dynamic(() => import('@/components/ResendEmailButton'), { ssr: false })

type AttestationRow = {
  id: string
  type: string
  numero: string | null
  date_emission: string | null
  statut: string | null
  envoye_email: string | null
  envoye_at: string | null
  intervention_id: string | null
  client_nom: string | null
  client_ville: string | null
  client_email: string | null
  client_adresse: string | null
  client_code_postal: string | null
  agence: string | null
  pdf_url: string | null
  created_at: string
  payload?: Record<string, unknown> | null
}

const STATUT_BADGE: Record<string, string> = {
  brouillon: 'bg-slate-200 text-slate-600',
  envoye: 'bg-emerald-100 text-emerald-800',
  annule: 'bg-red-100 text-red-700',
}

const STATUT_LABEL: Record<string, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  annule: 'Annulé',
}

function varianteLabel(payload: Record<string, unknown> | null | undefined): string {
  const v = typeof payload?.variante === 'string' ? payload.variante : ''
  if (v === 'reseau-fonctionnel') return 'Réseau fonctionnel'
  if (v === 'tout-a-legout') return "Tout-à-l'égout"
  if (v === 'fosse-septique') return 'Fosse septique'
  if (v === 'non-conforme') return 'Non-conforme'
  return v || '—'
}

function toHistoriqueDoc(d: AttestationRow): HistoriqueDocument & {
  envoye_email?: string | null
  client_email?: string | null
  intervention_id?: string | null
} {
  return {
    id: d.id,
    type: 'attestation',
    numero: d.numero,
    agence: d.agence,
    client_nom: d.client_nom,
    client_adresse: d.client_adresse,
    client_code_postal: d.client_code_postal,
    client_ville: d.client_ville,
    envoye_email: d.envoye_email,
    client_email: d.client_email,
    intervention_id: d.intervention_id,
    payload: d.payload as HistoriqueDocument['payload'],
  }
}

/**
 * Liste des attestations (terrain + rubrique) pour la page /attestation.
 */
export default function AttestationsRecentes({ limit = 40 }: { limit?: number }) {
  const [rows, setRows] = useState<AttestationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<'all' | 'envoye' | 'brouillon'>('all')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/attestations?limit=200`, { cache: 'no-store' })
        const json = await res.json()
        if (!alive) return
        if (json.error) throw new Error(json.error)
        const list: AttestationRow[] = json.documents || []
        setRows(list)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [limit])

  async function reload() {
    setError(null)
    try {
      const res = await fetch(`/api/attestations?limit=200`, { cache: 'no-store' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setRows(json.documents || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return rows
      .filter(d => {
        if (filtreStatut !== 'all' && d.statut !== filtreStatut) return false
        if (!s) return true
        const blob = [d.numero, d.client_nom, d.client_ville, d.envoye_email, d.agence, varianteLabel(d.payload)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return blob.includes(s)
      })
      .slice(0, limit)
  }, [rows, search, filtreStatut, limit])

  const stats = useMemo(() => ({
    total: rows.length,
    envoyes: rows.filter(r => r.statut === 'envoye').length,
    brouillons: rows.filter(r => r.statut === 'brouillon').length,
  }), [rows])

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-bold text-[#0f2e5c]">Attestations enregistrées</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Terrain (caméra / conformité) et création manuelle — {stats.envoyes} envoyée{stats.envoyes > 1 ? 's' : ''}, {stats.brouillons} brouillon{stats.brouillons > 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/historique" className="text-xs font-semibold text-[#0f2e5c] hover:underline">
          Voir l&apos;historique →
        </Link>
      </div>

      <div className="px-4 py-3 flex flex-col sm:flex-row gap-2 border-b border-slate-50">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher n°, client, ville…"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex gap-1">
          {([
            ['all', 'Tous'],
            ['envoye', 'Envoyés'],
            ['brouillon', 'Brouillons'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltreStatut(key)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                filtreStatut === key
                  ? 'bg-[#0f2e5c] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 my-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <p className="px-4 py-8 text-center text-slate-400 text-sm">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-slate-400 text-sm">
          Aucune attestation pour le moment. Elles apparaîtront ici après génération terrain ou manuelle.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-2">N°</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2 hidden sm:table-cell">Type</th>
                <th className="px-4 py-2 hidden md:table-cell">Date</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                    {d.numero || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{d.client_nom || '—'}</div>
                    <div className="text-xs text-slate-500">{d.client_ville || d.envoye_email || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 hidden sm:table-cell">
                    {varianteLabel(d.payload)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 hidden md:table-cell">
                    {fmtDateFR(d.date_emission || d.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUT_BADGE[d.statut || ''] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUT_LABEL[d.statut || ''] || d.statut || '—'}
                    </span>
                    {d.envoye_at && d.statut === 'envoye' ? (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {fmtDateFR(d.envoye_at)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-wrap gap-1 justify-end">
                      {d.intervention_id ? (
                        <Link
                          href={`/intervention/${d.intervention_id}`}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Dossier
                        </Link>
                      ) : null}
                      <DocumentDownloadButton doc={toHistoriqueDoc(d)} />
                      <ResendEmailButton doc={toHistoriqueDoc(d)} onSent={reload} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

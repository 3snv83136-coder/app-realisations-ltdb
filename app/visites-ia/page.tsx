'use client'

import { useEffect, useState } from 'react'
import AppTabs from '@/components/AppTabs'
import { errorMessage } from '@/lib/error-message'
import type { LlmVisitesReport } from '@/lib/llm-visits'

type KindFilter = 'tous' | 'robot' | 'clic' | 'requete'

function fmtDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDay(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function VisitesIaPage() {
  const [report, setReport] = useState<LlmVisitesReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [moteur, setMoteur] = useState('')
  const [kind, setKind] = useState<KindFilter>('tous')
  const [search, setSearch] = useState('')
  const [debut, setDebut] = useState('')
  const [fin, setFin] = useState('')
  const [exporting, setExporting] = useState(false)

  function filters(format?: 'csv') {
    const params = new URLSearchParams()
    if (debut) params.set('debut', debut)
    if (fin) params.set('fin', fin)
    if (moteur) params.set('moteur', moteur)
    if (kind !== 'tous') params.set('kind', kind)
    if (search.trim()) params.set('q', search.trim())
    if (format) params.set('format', format)
    const searchText = params.toString()
    return searchText ? `?${searchText}` : ''
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/llm-visites${filters()}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setReport(data)
    } catch (e) {
      setError(errorMessage(e) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debut, fin, moteur, kind, search])

  async function exporter() {
    setExporting(true)
    setError('')
    try {
      const res = await fetch(`/api/llm-visites${filters('csv')}`, { cache: 'no-store' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const name = ['visites-ia', debut, fin].filter(Boolean).join('-')
      link.href = url
      link.download = `${name}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(errorMessage(e) || 'Export impossible')
    } finally {
      setExporting(false)
    }
  }

  const rows = report?.rows || []

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-6xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>

      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-3">
          <div>
            <div className="font-black text-base sm:text-lg leading-tight">Visites des assistants IA</div>
            <div className="text-[11px] opacity-70">
              {report
                ? `Journal du ${fmtDay(report.journal_du)} au ${fmtDay(report.journal_au)}`
                : 'Robots et arrivées depuis ChatGPT, Claude, Gemini, Perplexity'}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void exporter()}
              disabled={exporting}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-white text-[#0e2a52] hover:bg-slate-100 min-h-[44px] disabled:opacity-60"
            >
              {exporting ? 'Export…' : 'Exporter'}
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-bold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 min-h-[44px]"
            >
              Rafraîchir
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        <p className="text-sm leading-relaxed text-slate-600 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          {report?.note || 'La requête est affichée seulement quand l’assistant l’a mise dans le lien d’arrivée. Un robot qui explore une page ne transmet pas la question.'}
        </p>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Visites', report?.visites],
            ['Robots', report?.robots],
            ['Clics humains', report?.clics],
            ['Avec requête', report?.avec_requete],
          ].map(([label, value]) => (
            <article key={String(label)} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
              <div className="mt-1 text-2xl font-black text-[#0e2a52] tabular-nums">
                {loading ? '…' : (value ?? 0).toLocaleString('fr-FR')}
              </div>
            </article>
          ))}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {([
              ['tous', 'Toutes'],
              ['robot', 'Robots'],
              ['clic', 'Clics humains'],
              ['requete', 'Avec requête'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setKind(id)}
                className={`px-3 py-2 rounded-xl text-sm font-bold min-h-[44px] ${
                  kind === id ? 'bg-[#0e2a52] text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Du</span>
              <input
                type="date"
                value={debut}
                onChange={e => setDebut(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Au</span>
              <input
                type="date"
                value={fin}
                onChange={e => setFin(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 min-h-[44px]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Assistant</span>
              <select
                value={moteur}
                onChange={e => setMoteur(e.target.value)}
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white min-h-[44px]"
              >
                <option value="">Tous</option>
                {(report?.moteurs || []).map(item => (
                  <option key={item.moteur} value={item.moteur}>
                    {item.moteur} · {item.visites.toLocaleString('fr-FR')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Page ou requête</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="toulon, canalisation…"
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 min-h-[44px]"
              />
            </label>
          </div>
          {report && report.rows_total > rows.length && (
            <p className="text-xs text-slate-500">
              {rows.length.toLocaleString('fr-FR')} visites affichées sur {report.rows_total.toLocaleString('fr-FR')}. L&apos;export contient toute la sélection.
            </p>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <p className="p-4 text-sm text-slate-500">Lecture du journal…</p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Aucune visite pour ce filtre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Assistant</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Page</th>
                    <th className="px-3 py-2">Requête</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.seen_at}-${row.path}-${index}`} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-600">{fmtDate(row.seen_at)}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-[#0e2a52]">{row.moteur}</div>
                        <div className="text-xs text-slate-500">{row.agent}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.kind === 'clic' ? 'Clic' : 'Robot'}
                      </td>
                      <td className="px-3 py-2 max-w-[280px]">
                        <div className="break-all">{row.path}</div>
                        {row.origine && (
                          <div className="text-xs text-slate-500 break-all mt-1">Depuis {row.origine}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[280px]">
                        {row.requete
                          ? <span className="font-medium text-slate-800">{row.requete}</span>
                          : <span className="text-slate-400">Non transmise</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

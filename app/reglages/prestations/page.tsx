'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import AppTabs from '@/components/AppTabs'
import type { PrestationCatalogItem } from '@/lib/tarifs-catalog'
import { errorMessage } from '@/lib/error-message'

type Draft = {
  designation: string
  pu_ht: string
  unite: string
}

const EMPTY_DRAFT: Draft = { designation: '', pu_ht: '', unite: 'forfait' }

export default function ReglagesPrestationsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo

  const [articles, setArticles] = useState<PrestationCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)

  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tarifs?all=1', { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setArticles(j.articles || [])
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/reglages/prestations')
      return
    }
    if (status !== 'authenticated') return
    if (!isOwner) {
      setLoading(false)
      return
    }
    void load()
  }, [status, isOwner, router, load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter(a =>
      a.designation.toLowerCase().includes(q)
      || a.type.toLowerCase().includes(q)
      || a.unite.toLowerCase().includes(q),
    )
  }, [articles, search])

  const actifs = articles.filter(a => a.actif).length

  async function createArticle() {
    const designation = draft.designation.trim()
    if (!designation) {
      setError('Libellé requis')
      return
    }
    const pu = Number(draft.pu_ht)
    if (!Number.isFinite(pu) || pu < 0) {
      setError('Prix HT invalide')
      return
    }
    setCreating(true)
    setError('')
    setInfo('')
    try {
      const res = await fetch('/api/tarifs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designation,
          pu_ht: pu,
          unite: draft.unite.trim() || 'forfait',
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setDraft(EMPTY_DRAFT)
      setInfo(`Article « ${designation} » ajouté au catalogue.`)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  async function saveEdit(id: string) {
    const designation = editDraft.designation.trim()
    if (!designation) {
      setError('Libellé requis')
      return
    }
    const pu = Number(editDraft.pu_ht)
    if (!Number.isFinite(pu) || pu < 0) {
      setError('Prix HT invalide')
      return
    }
    setBusyId(id)
    setError('')
    setInfo('')
    try {
      const res = await fetch(`/api/tarifs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designation,
          pu_ht: pu,
          unite: editDraft.unite.trim() || 'forfait',
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setEditId(null)
      setInfo('Article mis à jour.')
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActif(a: PrestationCatalogItem) {
    setBusyId(a.id)
    setError('')
    setInfo('')
    try {
      const res = await fetch(`/api/tarifs/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !a.actif }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setInfo(a.actif ? `« ${a.designation} » désactivé.` : `« ${a.designation} » réactivé.`)
      await load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  if (status === 'loading' || (status === 'authenticated' && isOwner && loading && articles.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppTabs />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500 text-sm">
          Chargement du catalogue…
        </main>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppTabs />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="font-bold text-slate-800">Accès réservé au gérant</p>
          <Link href="/" className="text-sm text-blue-700 hover:underline mt-2 inline-block">← Retour</Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <AppTabs />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-5">
        <header>
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-800">← Admin World</Link>
          <h1 className="text-2xl font-black text-slate-900 mt-2">Réglages · Prestations</h1>
          <p className="text-sm text-slate-600 mt-1">
            Créez vos articles manuellement — ils apparaissent dans les catalogues devis, facture et terrain.
          </p>
        </header>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Nouvel article</h2>
            <span className="text-xs text-slate-400">{actifs} actif{actifs > 1 ? 's' : ''} · {articles.length} au total</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <input
              value={draft.designation}
              onChange={e => setDraft(d => ({ ...d, designation: e.target.value }))}
              placeholder="Désignation (ex. Remplacement clapet)"
              className="sm:col-span-3 border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-xl px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.pu_ht}
              onChange={e => setDraft(d => ({ ...d, pu_ht: e.target.value }))}
              placeholder="P.U. HT €"
              className="sm:col-span-1 border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-xl px-3 py-2.5 text-sm"
            />
            <input
              value={draft.unite}
              onChange={e => setDraft(d => ({ ...d, unite: e.target.value }))}
              placeholder="unité"
              className="sm:col-span-1 border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-xl px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={creating || !draft.designation.trim()}
              onClick={() => void createArticle()}
              className="sm:col-span-1 bg-[#0e2a52] hover:bg-[#1a3a6b] disabled:opacity-50 text-white font-bold text-sm rounded-xl px-3 py-2.5"
            >
              {creating ? '…' : 'Ajouter'}
            </button>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}
        {info && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">{info}</div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une prestation…"
              className="w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-xl px-4 py-2.5 text-sm"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Aucun article.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map(a => (
                <li key={a.id} className={`px-4 py-3 ${a.actif ? '' : 'bg-slate-50 opacity-70'}`}>
                  {editId === a.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                        <input
                          value={editDraft.designation}
                          onChange={e => setEditDraft(d => ({ ...d, designation: e.target.value }))}
                          className="sm:col-span-3 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editDraft.pu_ht}
                          onChange={e => setEditDraft(d => ({ ...d, pu_ht: e.target.value }))}
                          className="sm:col-span-1 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          value={editDraft.unite}
                          onChange={e => setEditDraft(d => ({ ...d, unite: e.target.value }))}
                          className="sm:col-span-1 border-2 border-slate-200 rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void saveEdit(a.id)}
                          className="sm:col-span-1 bg-[#0e2a52] text-white font-bold text-sm rounded-lg px-3 py-2 disabled:opacity-50"
                        >
                          Sauver
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{a.designation}</span>
                          {!a.standard && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                              manuel
                            </span>
                          )}
                          {!a.actif && (
                            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                              inactif
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {a.pu_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT / {a.unite}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={!!busyId}
                          onClick={() => {
                            setEditId(a.id)
                            setEditDraft({
                              designation: a.designation,
                              pu_ht: String(a.pu_ht),
                              unite: a.unite,
                            })
                          }}
                          className="text-xs font-bold text-[#0e2a52] hover:underline px-2 py-1"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => void toggleActif(a)}
                          className={`text-xs font-bold rounded-lg px-3 py-1.5 ${
                            a.actif
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                          } disabled:opacity-50`}
                        >
                          {a.actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

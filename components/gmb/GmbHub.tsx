'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtDateFR } from '@/lib/format'

type GmbStatus = {
  configured: boolean
  connected: boolean
  accountEmail: string | null
  locationPath: string | null
  locationLabel: string | null
  ready: boolean
}

type GmbLocationRow = {
  locationPath: string
  title: string
  address: string | null
  accountName: string
}

type GmbPostRow = {
  name: string
  summary: string
  state: string
  createTime: string
  searchUrl: string | null
  photoUrl: string | null
}

const STATE_LABEL: Record<string, string> = {
  LIVE: 'En ligne',
  PROCESSING: 'En traitement',
  REJECTED: 'Rejeté',
}

export default function GmbHub() {
  const [status, setStatus] = useState<GmbStatus | null>(null)
  const [locations, setLocations] = useState<GmbLocationRow[]>([])
  const [posts, setPosts] = useState<GmbPostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingLocs, setLoadingLocs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/gmb/status', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    setStatus(data)
    return data as GmbStatus
  }, [])

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/gmb/posts', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setPosts(data.posts || [])
      else setPosts([])
    } catch {
      setPosts([])
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const st = await loadStatus()
      if (st.ready) await loadPosts()
      else setPosts([])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [loadStatus, loadPosts])

  useEffect(() => {
    void loadAll()
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      if (p.get('gmb_oauth') === 'ok') {
        setMsg('Compte Google connecté — choisis ta fiche ci-dessous.')
        window.history.replaceState({}, '', '/post-gmb')
      }
      if (p.get('gmb_oauth') === 'error') {
        setError(`Connexion Google refusée : ${p.get('reason') || 'erreur'}`)
        window.history.replaceState({}, '', '/post-gmb')
      }
    }
  }, [loadAll])

  async function fetchLocations() {
    setLoadingLocs(true)
    setError('')
    try {
      const res = await fetch('/api/gmb/locations', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setLocations(data.locations || [])
      if ((data.locations || []).length === 0) {
        setError('Aucune fiche trouvée — vérifie que tu es admin de la fiche Google Business.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingLocs(false)
    }
  }

  async function selectLocation(loc: GmbLocationRow) {
    setSaving(true)
    setError('')
    setMsg('')
    try {
      const res = await fetch('/api/gmb/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationPath: loc.locationPath,
          label: loc.title,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg(`Fiche enregistrée : ${loc.title}`)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-slate-500 text-sm">Chargement…</p>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}
      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-medium">
          {msg}
        </div>
      )}

      {/* Étape 1 — Connexion Google */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          1. Connexion Google Business
        </h2>
        {!status?.configured ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            OAuth non configuré sur le serveur. Ajoute{' '}
            <code className="text-xs">GMB_CLIENT_ID</code>,{' '}
            <code className="text-xs">GMB_CLIENT_SECRET</code> et{' '}
            <code className="text-xs">GMB_REDIRECT_URI</code> sur Vercel, puis redéploie.
          </p>
        ) : status.connected ? (
          <p className="text-sm text-emerald-700 font-semibold">
            ✓ Connecté{status.accountEmail ? ` — ${status.accountEmail}` : ''}
          </p>
        ) : (
          <p className="text-sm text-slate-600">Compte Google Business non connecté.</p>
        )}
        {status?.configured && (
          <a
            href="/api/oauth/gmb"
            className="inline-flex items-center gap-2 bg-[#0e2a52] hover:bg-[#1a3d6e] text-white font-bold text-sm px-4 py-2.5 rounded-xl transition"
          >
            {status.connected ? '↻ Reconnecter Google' : '🔗 Connecter Google Business'}
          </a>
        )}
      </section>

      {/* Étape 2 — Choisir la fiche */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          2. Choisir la fiche à publier
        </h2>
        {status?.locationPath ? (
          <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <span className="font-bold text-blue-900">
              {status.locationLabel || 'Fiche active'}
            </span>
            <p className="text-[11px] text-blue-700/80 mt-0.5 font-mono truncate">
              {status.locationPath}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">Aucune fiche sélectionnée.</p>
        )}
        {status?.connected && (
          <>
            <button
              type="button"
              onClick={() => void fetchLocations()}
              disabled={loadingLocs || saving}
              className="text-sm font-bold text-[#0e2a52] underline disabled:opacity-50"
            >
              {loadingLocs ? 'Chargement des fiches…' : 'Charger mes fiches Google'}
            </button>
            {locations.length > 0 && (
              <ul className="space-y-2">
                {locations.map(loc => (
                  <li key={loc.locationPath}>
                    <button
                      type="button"
                      onClick={() => void selectLocation(loc)}
                      disabled={saving}
                      className="w-full text-left rounded-xl border-2 border-slate-200 hover:border-blue-400 px-3 py-2.5 transition disabled:opacity-50"
                    >
                      <div className="font-bold text-slate-800 text-sm">{loc.title}</div>
                      {loc.address && (
                        <div className="text-xs text-slate-500">{loc.address}</div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">{loc.accountName}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Étape 3 — Posts */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          3. Posts publiés
        </h2>
        {!status?.ready ? (
          <p className="text-sm text-slate-500">
            Connecte Google et choisis une fiche pour voir les posts et publier depuis une
            intervention.
          </p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun post. Publie depuis une{' '}
            <Link href="/historique" className="text-blue-600 underline font-semibold">
              fiche intervention
            </Link>{' '}
            → bouton « Post GMB ».
          </p>
        ) : (
          <ul className="space-y-2">
            {posts.map(p => (
              <li
                key={p.name}
                className="border border-slate-100 rounded-xl p-3 flex gap-3"
              >
                {p.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photoUrl}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover shrink-0 bg-slate-100"
                  />
                )}
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">
                    {STATE_LABEL[p.state] || p.state} · {fmtDateFR(p.createTime)}
                  </div>
                  <p className="text-sm text-slate-700 line-clamp-2 mt-0.5">{p.summary}</p>
                  {p.searchUrl && (
                    <a
                      href={p.searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-blue-700 hover:underline"
                    >
                      Voir sur Google →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { DemoAccessRow } from '@/lib/demo-access'

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isActive(row: DemoAccessRow): boolean {
  if (!row.actif || row.revoked_at) return false
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false
  return true
}

export default function AccesDemoPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<DemoAccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/acces-demo')
      return
    }
    if (status !== 'authenticated') return
    if (!isOwner) {
      setLoading(false)
      return
    }
    void load()
  }, [status, isOwner, router])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/demo-access', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setRows(data.access || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/demo-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password,
          label: label || undefined,
          expires_at: expiresAt || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setLogin('')
      setPassword('')
      setLabel('')
      setExpiresAt('')
      await load()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Création impossible')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string, loginName: string) {
    if (!confirm(`Révoquer l'accès « ${loginName} » ? Le client ne pourra plus se connecter.`)) return
    setRevokingId(id)
    try {
      const res = await fetch(`/api/demo-access/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Révocation impossible')
    } finally {
      setRevokingId(null)
    }
  }

  if (status === 'loading' || (loading && isOwner)) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
        Chargement…
      </main>
    )
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <header className="bg-[#0e2a52] text-white px-4 py-5">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="font-black text-lg">Accès démo</h1>
            <Link href="/" className="text-xs text-white/70 hover:text-white">← Accueil</Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500 text-sm">
          Réservé au gérant — les comptes démo n&apos;ont pas accès à cette page.
        </div>
      </main>
    )
  }

  const active = rows.filter(isActive)
  const inactive = rows.filter(r => !isActive(r))

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-black text-lg sm:text-xl">🔑 Accès démo client</h1>
            <p className="text-xs text-white/70 mt-0.5">Admin complet temporaire — créer et révoquer</p>
          </div>
          <Link href="/" className="text-xs text-white/70 hover:text-white shrink-0">← Accueil</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-[#0e2a52]">Créer un accès</h2>
          <p className="text-sm text-slate-600">
            Le client se connecte sur <strong>/login</strong> avec l&apos;identifiant et le mot de passe ci-dessous.
            Il a accès à toute l&apos;app (comme un admin), sauf cette page de gestion.
          </p>
          <form onSubmit={e => { void handleCreate(e) }} className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identifiant *</span>
              <input
                value={login}
                onChange={e => setLogin(e.target.value)}
                placeholder="demo-client-martin"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mot de passe *</span>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                required
                minLength={6}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Libellé (client)</span>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Essai — Société Martin"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expiration (optionnel)</span>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            {createError && (
              <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2.5 rounded-xl bg-[#0e2a52] text-white text-sm font-bold hover:bg-[#0a1f3d] disabled:opacity-50"
              >
                {creating ? 'Création…' : '+ Créer l\'accès démo'}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="font-bold text-emerald-700">Actifs ({active.length})</h2>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Aucun accès démo actif.</p>
          ) : (
            <ul className="space-y-2">
              {active.map(row => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-emerald-100 bg-emerald-50/40 rounded-xl px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-sm">{row.login}</div>
                    {row.label && <div className="text-xs text-slate-600">{row.label}</div>}
                    <div className="text-[11px] text-slate-500 mt-1">
                      Créé le {fmtDate(row.created_at)}
                      {row.expires_at ? ` · expire le ${fmtDate(row.expires_at)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(row.id, row.login)}
                    disabled={revokingId === row.id}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {revokingId === row.id ? '…' : 'Révoquer'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {inactive.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-500">Révoqués / expirés ({inactive.length})</h2>
            <ul className="space-y-2">
              {inactive.map(row => (
                <li
                  key={row.id}
                  className="border border-slate-100 rounded-xl px-4 py-3 opacity-70"
                >
                  <div className="font-medium text-sm line-through">{row.login}</div>
                  {row.label && <div className="text-xs text-slate-500">{row.label}</div>}
                  <div className="text-[11px] text-slate-400 mt-1">
                    {row.revoked_at ? `Révoqué le ${fmtDate(row.revoked_at)}` : 'Expiré'}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

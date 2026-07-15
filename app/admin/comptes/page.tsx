'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { CompteTechRow } from '@/lib/comptes-tech'
import { errorMessage } from '@/lib/error-message'

type Technicien = {
  id: string
  nom: string
  agence: string | null
  actif: boolean
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Mot de passe lisible (sans caractères ambigus 0/O, 1/l/I). */
function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

function loginFromNom(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 32)
}

export default function AdminComptesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [comptes, setComptes] = useState<CompteTechRow[]>([])
  const [techniciens, setTechniciens] = useState<Technicien[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Formulaire de création
  const [technicienId, setTechnicienId] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  /** Identifiants à transmettre au technicien — affichés une seule fois. */
  const [issued, setIssued] = useState<{ login: string; password: string; nom: string } | null>(null)

  const [pendingId, setPendingId] = useState<string | null>(null)

  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/admin/comptes')
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
      const [comptesRes, techsRes] = await Promise.all([
        fetch('/api/admin/comptes-tech', { cache: 'no-store' }),
        fetch('/api/techniciens', { cache: 'no-store' }),
      ])
      const comptesData = await comptesRes.json()
      const techsData = await techsRes.json()
      if (!comptesRes.ok) throw new Error(comptesData.error || `HTTP ${comptesRes.status}`)
      setComptes(comptesData.comptes || [])
      setTechniciens(techsData.techniciens || [])
    } catch (e) {
      setError(errorMessage(e) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectTechnicien(id: string) {
    setTechnicienId(id)
    const tech = techniciens.find(t => t.id === id)
    if (tech && !login.trim()) setLogin(loginFromNom(tech.nom))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setIssued(null)
    try {
      const res = await fetch('/api/admin/comptes-tech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, technicien_id: technicienId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const nom = techniciens.find(t => t.id === technicienId)?.nom || login
      setIssued({ login: data.compte?.login || login, password, nom })
      setLogin('')
      setPassword('')
      setTechnicienId('')
      await load()
    } catch (e) {
      setCreateError(errorMessage(e) || 'Création impossible')
    } finally {
      setCreating(false)
    }
  }

  async function patchCompte(id: string, body: { actif?: boolean; password?: string }) {
    setPendingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/comptes-tech/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await load()
      return true
    } catch (e) {
      setError(errorMessage(e) || 'Modification impossible')
      return false
    } finally {
      setPendingId(null)
    }
  }

  async function handleToggleActif(row: CompteTechRow) {
    if (row.actif) {
      if (!confirm(`Désactiver le compte « ${row.login} » ? ${row.technicien_nom || 'Le technicien'} sera déconnecté immédiatement.`)) return
      await patchCompte(row.id, { actif: false })
    } else {
      await patchCompte(row.id, { actif: true })
    }
  }

  async function handleResetPassword(row: CompteTechRow) {
    if (!confirm(`Générer un nouveau mot de passe pour « ${row.login} » ? L'ancien ne fonctionnera plus.`)) return
    const newPassword = generatePassword()
    const ok = await patchCompte(row.id, { password: newPassword })
    if (ok) {
      setIssued({ login: row.login, password: newPassword, nom: row.technicien_nom || row.login })
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
            <h1 className="font-black text-lg">Comptes techniciens</h1>
            <Link href="/" className="text-xs text-white/70 hover:text-white">← Accueil</Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500 text-sm">
          Réservé au gérant.
        </div>
      </main>
    )
  }

  const actifs = comptes.filter(c => c.actif && !c.revoked_at)
  const inactifs = comptes.filter(c => !c.actif || c.revoked_at)
  const techniciensSansCompte = techniciens.filter(
    t => t.actif && !actifs.some(c => c.technicien_id === t.id),
  )

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-black text-lg sm:text-xl">👷 Comptes techniciens</h1>
            <p className="text-xs text-white/70 mt-0.5">
              Login + mot de passe — accès restreint : planning, ses interventions, mode terrain
            </p>
          </div>
          <Link href="/" className="text-xs text-white/70 hover:text-white shrink-0">← Accueil</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {issued && (
          <section className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 space-y-2">
            <h2 className="font-bold text-emerald-800">✓ Identifiants à transmettre à {issued.nom}</h2>
            <div className="bg-white rounded-xl border border-emerald-200 p-4 font-mono text-sm space-y-1">
              <div>Identifiant : <strong>{issued.login}</strong></div>
              <div>Mot de passe : <strong>{issued.password}</strong></div>
              <div className="text-xs text-slate-500 font-sans pt-1">
                Connexion sur <strong>{typeof window !== 'undefined' ? window.location.origin : ''}/login</strong>
              </div>
            </div>
            <p className="text-xs text-emerald-700">
              ⚠ Le mot de passe n&apos;est affiché qu&apos;une seule fois — note-le avant de fermer.
            </p>
            <button
              type="button"
              onClick={() => setIssued(null)}
              className="text-xs text-emerald-700 underline"
            >
              Fermer
            </button>
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="font-bold text-[#0e2a52]">Créer un compte</h2>
          <p className="text-sm text-slate-600">
            Le technicien se connecte sur <strong>/login</strong> et n&apos;a accès qu&apos;à son planning,
            ses interventions et le mode terrain — jamais aux factures, statistiques ou autres clients.
          </p>
          <form onSubmit={e => { void handleCreate(e) }} className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Technicien *</span>
              <select
                value={technicienId}
                onChange={e => handleSelectTechnicien(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                required
              >
                <option value="">— Choisir un technicien —</option>
                {techniciens.filter(t => t.actif).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nom}{t.agence ? ` (${t.agence})` : ''}
                  </option>
                ))}
              </select>
              {techniciensSansCompte.length === 0 && techniciens.length > 0 && (
                <span className="block text-[11px] text-slate-400 mt-1">
                  Tous les techniciens actifs ont déjà un compte.
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Identifiant *</span>
              <input
                value={login}
                onChange={e => setLogin(e.target.value)}
                placeholder="prenom.nom"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mot de passe *</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="shrink-0 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  title="Générer un mot de passe aléatoire"
                >
                  🎲 Générer
                </button>
              </div>
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
                {creating ? 'Création…' : '+ Créer le compte'}
              </button>
            </div>
          </form>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="font-bold text-emerald-700">Comptes actifs ({actifs.length})</h2>
          {actifs.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Aucun compte technicien actif.</p>
          ) : (
            <ul className="space-y-2">
              {actifs.map(row => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-emerald-100 bg-emerald-50/40 rounded-xl px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-sm font-mono">{row.login}</div>
                    <div className="text-xs text-slate-600">{row.technicien_nom || 'Technicien inconnu'}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Créé le {fmtDate(row.created_at)}
                      {row.dernier_login_at ? ` · dernière connexion ${fmtDate(row.dernier_login_at)}` : ' · jamais connecté'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleResetPassword(row)}
                      disabled={pendingId === row.id}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {pendingId === row.id ? '…' : '🔑 Nouveau MDP'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleActif(row)}
                      disabled={pendingId === row.id}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {pendingId === row.id ? '…' : 'Désactiver'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {inactifs.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-slate-500">Désactivés ({inactifs.length})</h2>
            <ul className="space-y-2">
              {inactifs.map(row => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-slate-100 rounded-xl px-4 py-3 opacity-80"
                >
                  <div>
                    <div className="font-medium text-sm font-mono line-through">{row.login}</div>
                    <div className="text-xs text-slate-500">{row.technicien_nom || '—'}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {row.revoked_at ? `Désactivé le ${fmtDate(row.revoked_at)}` : 'Désactivé'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleToggleActif(row)}
                    disabled={pendingId === row.id}
                    className="px-3 py-1.5 text-xs rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {pendingId === row.id ? '…' : 'Réactiver'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[11px] text-slate-400 text-center">
          Les comptes des variables d&apos;environnement (AUTH_TECH_N) restent valides pendant la transition.
        </p>
      </div>
    </main>
  )
}

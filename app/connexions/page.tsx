'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { ConnexionLogRow } from '@/lib/connexions-log'

const COUNTRY_NAMES: Record<string, string> = {
  FR: 'France', BE: 'Belgique', CH: 'Suisse', LU: 'Luxembourg', MC: 'Monaco',
  GB: 'Royaume-Uni', DE: 'Allemagne', ES: 'Espagne', IT: 'Italie', PT: 'Portugal',
  NL: 'Pays-Bas', US: 'États-Unis', CA: 'Canada', MA: 'Maroc', DZ: 'Algérie', TN: 'Tunisie',
}

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '🌐'
  const base = 127397
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => c.charCodeAt(0) + base))
}

function countryLabel(code: string | null): string {
  if (!code) return 'Inconnu'
  return COUNTRY_NAMES[code.toUpperCase()] || code.toUpperCase()
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ConnexionsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [rows, setRows] = useState<ConnexionLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/connexions')
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
      const res = await fetch('/api/connexions', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setRows(data.rows || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  if (status !== 'authenticated' && status !== 'unauthenticated') {
    return <main className="min-h-dvh bg-[#0a1f3d]" />
  }

  if (status === 'authenticated' && !isOwner) {
    return (
      <main className="min-h-dvh bg-[#0a1f3d] text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-white/70">Accès réservé au gérant.</p>
          <Link href="/" className="inline-block text-xs text-white/70 hover:text-white">← Accueil</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[#0a1f3d] text-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-[#0e2a52]/95 backdrop-blur-md text-white border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="text-xs text-white/70 hover:text-white shrink-0">← Accueil</Link>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">Connexions</h1>
          </div>
          <button
            onClick={() => void load()}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            Rafraîchir
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6">
        {error && (
          <p className="mb-3 text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-white/50 text-sm">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-white/50 text-sm">Aucune connexion enregistrée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-left text-[10px] uppercase tracking-wider text-white/50">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Identifiant</th>
                  <th className="px-3 py-2">Rôle</th>
                  <th className="px-3 py-2">Pays</th>
                  <th className="px-3 py-2">Ville</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2 hidden md:table-cell">Appareil</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2 font-semibold">
                      {r.login}
                      {r.is_demo && (
                        <span className="ml-1.5 text-[9px] uppercase tracking-wide text-amber-300/80">démo</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-white/70">{r.role === 'admin' ? 'Gérant' : 'Technicien'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="mr-1.5">{countryFlag(r.country_code)}</span>
                      {countryLabel(r.country_code)}
                    </td>
                    <td className="px-3 py-2 text-white/70">{r.city || '—'}</td>
                    <td className="px-3 py-2 text-white/50 font-mono text-xs">{r.ip || '—'}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-white/40 text-xs max-w-[240px] truncate">
                      {r.user_agent || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

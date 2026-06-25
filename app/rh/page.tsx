'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import AppTabs from "@/components/AppTabs"
import type { Salarie } from "@/lib/rh/types"
import { salarieNomComplet } from "@/lib/rh/types"

export default function RhPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [salaries, setSalaries] = useState<Salarie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (session?.user?.role !== 'admin') {
      router.replace('/')
      return
    }
    fetch('/api/rh/salaries', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setSalaries(d.salaries || [])
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [session, status, router])

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-6xl mx-auto px-4"><AppTabs /></div>
      </div>

      <header className="bg-[#0e2a52] text-white px-4 py-5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black">Ressources humaines</h1>
            <p className="text-sm text-white/70">Dossiers salariés, scans et documents RH</p>
          </div>
          <Link
            href="/rh/nouveau"
            className="bg-white text-[#0e2a52] font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-slate-100 transition"
          >
            + Nouveau salarié
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          Gabarits juridiques standards — à valider par votre conseil avant signature.
        </div>

        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
        {loading && <p className="text-slate-500">Chargement…</p>}

        {!loading && salaries.length === 0 && (
          <p className="text-slate-500 text-center py-12">Aucun salarié. Crée le premier dossier.</p>
        )}

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {salaries.map(s => (
            <li key={s.id}>
              <Link
                href={`/rh/${s.id}`}
                className="block bg-white border-2 border-slate-200 hover:border-[#0e2a52] rounded-2xl p-4 transition"
              >
                <div className="font-bold text-[#0e2a52]">{salarieNomComplet(s)}</div>
                <div className="text-sm text-slate-600 mt-1">{s.poste || 'Poste non renseigné'}</div>
                <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-2">
                  <span>{s.type_contrat || 'CDI'}</span>
                  {!s.actif && <span className="text-red-600 font-semibold">Inactif</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

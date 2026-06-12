'use client'

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"

type InterventionRow = {
  id: string
  reference: string | null
  type_intervention: string | null
  ville: string | null
  date_prevue: string | null
  statut: string
  terrain_step: number | null
  client_nom?: string | null
}

const STEP_LABELS = [
  "Photo avant",
  "Démarrer",
  "Travaux suppl.",
  "Photo après",
  "Rapport",
  "Facture",
  "Devis",
  "Envoi client",
  "Réseaux",
  "Terminé",
]

export default function MesInterventionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rows, setRows] = useState<InterventionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/mes-interventions")
      return
    }
    if (session?.user?.role === "admin" || session?.user?.role === "tech") {
      router.replace("/planning")
      return
    }
    load()
  }, [status, session?.user?.role])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/interventions?limit=100", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setRows(data.interventions || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0e2a52] text-white px-4 py-4 sticky top-0 z-20 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="font-black text-lg">Mes interventions</h1>
            <p className="text-xs opacity-80">
              {session?.user?.name || "Technicien"} — mode terrain & envoi client
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}

        {loading && <p className="text-center text-slate-500 py-8">Chargement…</p>}

        {!loading && rows.length === 0 && (
          <p className="text-center text-slate-500 py-8">Aucune intervention assignée.</p>
        )}

        {rows.map(row => {
          const step = row.terrain_step ?? 0
          const stepLabel = STEP_LABELS[step] || `Étape ${step}`
          return (
            <article
              key={row.id}
              className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div>
                <div className="font-bold text-slate-900">{row.type_intervention || "Intervention"}</div>
                <div className="text-sm text-slate-600">
                  {row.client_nom || "Client"} · {row.ville || "—"}
                </div>
                {row.reference && (
                  <div className="text-xs text-slate-400 mt-0.5">{row.reference}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-blue-50 text-blue-800 font-semibold px-2 py-1 rounded-lg">
                  {stepLabel}
                </span>
                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg capitalize">
                  {row.statut}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  href={`/intervention/${row.id}/terrain`}
                  className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl shadow transition"
                >
                  🚀 Mode terrain
                </Link>
                <Link
                  href={`/intervention/${row.id}`}
                  className="w-full text-center text-sm text-slate-600 hover:underline"
                >
                  Voir la fiche
                </Link>
              </div>
            </article>
          )
        })}
      </main>
    </div>
  )
}

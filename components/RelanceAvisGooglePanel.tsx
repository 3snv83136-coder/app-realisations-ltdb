'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { AvisGoogleCampagne, AvisGoogleSnapshot } from "@/lib/avis-relance"
import { errorMessage } from "@/lib/error-message"

type Props = {
  className?: string
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const STATUS_META = {
  pending: { label: "Programmé", cls: "bg-blue-100 text-blue-900" },
  sent: { label: "Envoyé", cls: "bg-emerald-100 text-emerald-900" },
  canceled: { label: "Arrêté", cls: "bg-slate-200 text-slate-700" },
} as const

export default function RelanceAvisGooglePanel({ className = "" }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [data, setData] = useState<AvisGoogleSnapshot | null>(null)
  const [filter, setFilter] = useState<"all" | "active" | "stopped">("all")
  const [search, setSearch] = useState("")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/relances/avis", { cache: "no-store" })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setData({
        campagnes: j.campagnes || [],
        totals: j.totals || { actives: 0, arretees: 0, pending: 0, sent: 0 },
      })
    } catch (e) {
      setError(errorMessage(e) || "Erreur chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.campagnes.filter(c => {
      if (filter === "active" && !c.active) return false
      if (filter === "stopped" && !c.avisRecu) return false
      if (!q) return true
      return (
        c.clientNom.toLowerCase().includes(q)
        || c.reference.toLowerCase().includes(q)
        || (c.ville || "").toLowerCase().includes(q)
        || (c.clientEmail || "").toLowerCase().includes(q)
        || (c.clientTelephone || "").includes(q)
      )
    })
  }, [data, filter, search])

  async function stop(scope: "all" | "item", interventionId?: string) {
    const key = scope === "all" ? "all" : `stop:${interventionId}`
    setBusyKey(key)
    setInfo("")
    setError("")
    try {
      const res = await fetch("/api/relances/avis/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          scope === "all"
            ? { scope: "all" }
            : { scope: "item", interventionId },
        ),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setInfo(j.details?.length ? j.details.join(" · ") : "Relances arrêtées.")
      await load()
    } catch (e) {
      setError(errorMessage(e) || "Erreur arrêt")
    } finally {
      setBusyKey(null)
    }
  }

  async function reprendre(interventionId: string) {
    const key = `go:${interventionId}`
    setBusyKey(key)
    setInfo("")
    setError("")
    try {
      const res = await fetch("/api/relances/avis/reprendre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setInfo(
        j.resumed
          ? `${j.resumed} relance(s) reprise(s).`
          : "Relances réactivées.",
      )
      await load()
    } catch (e) {
      setError(errorMessage(e) || "Erreur reprise")
    } finally {
      setBusyKey(null)
    }
  }

  const totals = data?.totals ?? { actives: 0, arretees: 0, pending: 0, sent: 0 }

  return (
    <section
      className={`bg-amber-400 border-2 border-amber-200 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 ${className}`}
    >
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#1a1208] flex items-center gap-2">
            <span aria-hidden>⭐</span>
            <span>Relance avis Google</span>
          </h2>
          <p className="text-sm text-[#3d2a10] mt-1 font-medium">
            Historique des SMS et mails de demande d&apos;avis — arrête ou continue les relances.
          </p>
        </div>
        {totals.actives > 0 && (
          <button
            type="button"
            disabled={!!busyKey}
            onClick={() => {
              if (!confirm(`Arrêter toutes les relances avis actives (${totals.actives}) ?`)) return
              stop("all")
            }}
            className="shrink-0 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl px-4 py-2.5"
          >
            {busyKey === "all" ? "Arrêt…" : `🛑 Tout arrêter (${totals.actives})`}
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Actives" value={totals.actives} />
        <Kpi label="Programmés" value={totals.pending} />
        <Kpi label="Envoyés" value={totals.sent} />
        <Kpi label="Arrêtées" value={totals.arretees} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex rounded-xl overflow-hidden border-2 border-amber-700/30 bg-white/80">
          {(
            [
              { key: "all", label: "Tout" },
              { key: "active", label: "Actives" },
              { key: "stopped", label: "Arrêtées" },
            ] as const
          ).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`flex-1 px-3 py-2 text-xs font-bold ${
                filter === t.key
                  ? "bg-[#0e2a52] text-white"
                  : "text-[#1a1208] hover:bg-amber-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Client, référence, ville…"
          className="flex-1 border-2 border-amber-700/40 focus:border-amber-600 outline-none rounded-xl px-3 py-2.5 text-sm bg-white text-slate-900"
        />
      </div>

      {error && (
        <div className="bg-red-700 text-white rounded-xl px-3 py-2 text-sm font-semibold">
          ⚠ {error}
        </div>
      )}
      {info && (
        <div className="bg-emerald-700 text-white rounded-xl px-3 py-2 text-sm font-semibold">
          ✓ {info}
        </div>
      )}

      {loading ? (
        <p className="text-sm font-semibold text-[#3d2a10] text-center py-6">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white/70 rounded-xl px-4 py-6 text-center">
          <p className="font-bold text-[#1a1208]">Aucune relance avis</p>
          <p className="text-sm text-[#3d2a10] mt-1">
            Les séquences apparaissent après l&apos;envoi d&apos;un rapport + facture.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {filtered.map(c => (
            <CampagneCard
              key={c.interventionId}
              campagne={c}
              open={expanded === c.interventionId}
              onToggle={() =>
                setExpanded(prev => (prev === c.interventionId ? null : c.interventionId))
              }
              busyKey={busyKey}
              onStop={() => {
                if (!confirm(`Arrêter les relances avis pour ${c.clientNom} ?`)) return
                stop("item", c.interventionId)
              }}
              onReprendre={() => reprendre(c.interventionId)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/80 border border-amber-700/20 p-2.5 text-center">
      <div className="text-xl font-black text-[#0e2a52]">{value}</div>
      <div className="text-[10px] uppercase font-bold text-[#3d2a10] tracking-wide">{label}</div>
    </div>
  )
}

function CampagneCard({
  campagne: c,
  open,
  onToggle,
  busyKey,
  onStop,
  onReprendre,
}: {
  campagne: AvisGoogleCampagne
  open: boolean
  onToggle: () => void
  busyKey: string | null
  onStop: () => void
  onReprendre: () => void
}) {
  const stopBusy = busyKey === `stop:${c.interventionId}`
  const goBusy = busyKey === `go:${c.interventionId}`

  return (
    <li className="bg-white rounded-xl border border-amber-700/20 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-sm text-slate-900">{c.clientNom}</span>
            <span className="text-xs text-slate-500">{c.reference}</span>
            {c.ville && <span className="text-xs text-slate-500">{c.ville}</span>}
            {c.active ? (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                Active · {c.pendingCount}
              </span>
            ) : c.avisRecu ? (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                Arrêtée
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                Terminée
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {c.sentCount} envoyé{c.sentCount > 1 ? "s" : ""}
            {c.pendingCount > 0 ? ` · ${c.pendingCount} à venir` : ""}
            {c.canceledCount > 0 ? ` · ${c.canceledCount} arrêté${c.canceledCount > 1 ? "s" : ""}` : ""}
            {" · "}
            {open ? "masquer l'historique ▲" : "voir l'historique ▼"}
          </p>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href={c.href}
            className="text-xs font-bold text-[#0e2a52] hover:underline px-2 py-1.5"
          >
            Fiche →
          </Link>
          {c.active || c.pendingCount > 0 ? (
            <button
              type="button"
              disabled={!!busyKey}
              onClick={onStop}
              className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold rounded-lg px-3 py-2"
            >
              {stopBusy ? "…" : "Arrêter"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!!busyKey}
              onClick={onReprendre}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg px-3 py-2"
            >
              {goBusy ? "…" : "Continuer"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <ul className="border-t border-amber-100 divide-y divide-amber-50 bg-amber-50/40">
          {c.envois.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">Aucun détail d&apos;envoi enregistré.</li>
          ) : (
            c.envois.map((e, i) => {
              const meta = STATUS_META[e.status]
              return (
                <li key={`${e.channel}-${e.day}-${i}`} className="px-3 py-2 flex items-center gap-2 text-xs">
                  <span className="text-base w-6 text-center" aria-hidden>
                    {e.channel === "email" ? "✉" : "📱"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800">{e.label}</div>
                    <div className="text-slate-500 truncate">
                      {e.destinataire || "—"}
                      {" · "}
                      {e.status === "sent" ? fmtWhen(e.sentAt) : fmtWhen(e.sendAt)}
                    </div>
                  </div>
                  <span className={`shrink-0 font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
                    {meta.label}
                  </span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </li>
  )
}

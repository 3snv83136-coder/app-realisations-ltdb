'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { ClientRelancesGroup, RelanceItem, RelanceKind } from "@/lib/relances-hub"

type Snapshot = {
  groups: ClientRelancesGroup[]
  totals: { avis: number; devis: number; facture: number; all: number }
}

const KIND_META: Record<RelanceKind, { emoji: string; label: string; color: string }> = {
  avis: { emoji: '⭐', label: 'Avis Google', color: 'bg-amber-100 text-amber-900 border-amber-200' },
  devis: { emoji: '📋', label: 'Devis', color: 'bg-blue-100 text-blue-900 border-blue-200' },
  facture: { emoji: '🧾', label: 'Facture', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
}

type StopScope =
  | { scope: 'all' }
  | { scope: 'client'; clientKey: string }
  | { scope: 'item'; kind: RelanceKind; id: string }

export default function RelancesHubPanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [data, setData] = useState<Snapshot | null>(null)
  const [search, setSearch] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/relances', { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setData({ groups: j.groups || [], totals: j.totals || { avis: 0, devis: 0, facture: 0, all: 0 } })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredGroups = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.groups
    return data.groups
      .map(g => ({
        ...g,
        items: g.items.filter(i =>
          g.clientNom.toLowerCase().includes(q)
          || (g.clientEmail || '').toLowerCase().includes(q)
          || i.label.toLowerCase().includes(q)
          || (i.ville || '').toLowerCase().includes(q),
        ),
      }))
      .filter(g => g.items.length > 0)
      .map(g => ({
        ...g,
        totalPending: g.items.reduce((s, i) => s + i.pendingCount, 0),
      }))
  }, [data, search])

  async function stop(target: StopScope) {
    const key = JSON.stringify(target)
    setBusyKey(key)
    setInfo('')
    setError('')
    try {
      const res = await fetch('/api/relances/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setInfo(j.details?.length ? j.details.join(' · ') : 'Relances arrêtées.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyKey(null)
    }
  }

  const totals = data?.totals ?? { avis: 0, devis: 0, facture: 0, all: 0 }
  const hasAny = totals.all > 0

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-800">Centre de contrôle des relances</h2>
            <p className="text-sm text-slate-500 mt-1">
              Arrêtez les relances avis, devis ou factures sans passer par l&apos;historique ou chaque fiche.
            </p>
          </div>
          {hasAny && (
            <button
              type="button"
              disabled={!!busyKey}
              onClick={() => {
                if (!confirm(`Arrêter TOUTES les relances en cours (${totals.all}) pour tous les clients ?`)) return
                stop({ scope: 'all' })
              }}
              className="shrink-0 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl px-4 py-2.5 shadow"
            >
              {busyKey === '{"scope":"all"}' ? 'Arrêt…' : `🛑 Tout arrêter (${totals.all})`}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Kpi emoji="⭐" label="Avis" value={totals.avis} tone="amber" />
          <Kpi emoji="📋" label="Devis" value={totals.devis} tone="blue" />
          <Kpi emoji="🧾" label="Factures" value={totals.facture} tone="emerald" />
        </div>

        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un client, référence, ville…"
          className="w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-xl px-4 py-2.5 text-sm"
        />
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}
      {info && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm">{info}</div>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-12 text-sm">Chargement des relances…</div>
      ) : !hasAny ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-2">✓</div>
          <p className="font-bold text-slate-700">Aucune relance en attente</p>
          <p className="text-sm text-slate-500 mt-1">Tout est à jour — rien à arrêter pour le moment.</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center text-slate-500 py-8 text-sm">Aucun résultat pour cette recherche.</div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => (
            <ClientCard
              key={group.clientKey}
              group={group}
              busyKey={busyKey}
              onStopClient={() => {
                if (!confirm(`Arrêter toutes les relances de ${group.clientNom} (${group.totalPending}) ?`)) return
                stop({ scope: 'client', clientKey: group.clientKey })
              }}
              onStopItem={(kind, id) => stop({ scope: 'item', kind, id })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Kpi({ emoji, label, value, tone }: { emoji: string; label: string; value: number; tone: 'amber' | 'blue' | 'emerald' }) {
  const tones = {
    amber: 'bg-amber-50 border-amber-200',
    blue: 'bg-blue-50 border-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200',
  }
  return (
    <div className={`rounded-xl border p-3 text-center ${tones[tone]}`}>
      <div className="text-xl">{emoji}</div>
      <div className="text-2xl font-black text-slate-800">{value}</div>
      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">{label}</div>
    </div>
  )
}

function ClientCard({
  group,
  busyKey,
  onStopClient,
  onStopItem,
}: {
  group: ClientRelancesGroup
  busyKey: string | null
  onStopClient: () => void
  onStopItem: (kind: RelanceKind, id: string) => void
}) {
  const clientBusy = busyKey === JSON.stringify({ scope: 'client', clientKey: group.clientKey })

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div>
          <h3 className="font-bold text-slate-800">{group.clientNom}</h3>
          {group.clientEmail && (
            <p className="text-xs text-slate-500">{group.clientEmail}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">{group.totalPending} relance{group.totalPending > 1 ? 's' : ''} active{group.totalPending > 1 ? 's' : ''}</p>
        </div>
        <button
          type="button"
          disabled={!!busyKey}
          onClick={onStopClient}
          className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl px-4 py-2"
        >
          {clientBusy ? 'Arrêt…' : `Arrêter tout pour ce client`}
        </button>
      </div>

      <ul className="divide-y divide-slate-100">
        {group.items.map(item => (
          <RelanceRow
            key={`${item.kind}-${item.id}`}
            item={item}
            busy={busyKey === JSON.stringify({ scope: 'item', kind: item.kind, id: item.id })}
            disabled={!!busyKey}
            onStop={() => onStopItem(item.kind, item.id)}
          />
        ))}
      </ul>
    </section>
  )
}

function RelanceRow({
  item,
  busy,
  disabled,
  onStop,
}: {
  item: RelanceItem
  busy: boolean
  disabled: boolean
  onStop: () => void
}) {
  const meta = KIND_META[item.kind]
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
            {meta.emoji} {meta.label}
          </span>
          <span className="font-semibold text-sm text-slate-800">{item.label}</span>
          {item.ville && <span className="text-xs text-slate-500">{item.ville}</span>}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {item.pendingCount} relance{item.pendingCount > 1 ? 's' : ''} programmée{item.pendingCount > 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.href && (
          <Link
            href={item.href}
            className="text-xs font-semibold text-[#0e2a52] hover:underline px-2 py-1"
          >
            Voir →
          </Link>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={onStop}
          className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold rounded-lg px-3 py-2"
        >
          {busy ? '…' : 'Arrêter'}
        </button>
      </div>
    </li>
  )
}

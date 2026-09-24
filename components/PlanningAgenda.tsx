'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatCreneau } from '@/lib/creneau'
import { fmtDateFR, fmtEUR } from '@/lib/format'

type Statut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

export type AgendaIntervention = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  heure_prevue: string | null
  heure_fin_prevue?: string | null
  duree_estimee_min: number | null
  date_realisee: string | null
  urgence: boolean
  statut: Statut
  prix_prevu: number | null
  client_nom: string | null
  client_telephone: string | null
  technicien_nom: string | null
}

export type AgendaPeriod = 'day' | 'week' | 'month'

const STATUT_LABEL: Record<Statut, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

const CARD_STATUT_STYLE: Record<Statut, string> = {
  planifiee: 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-50 hover:border-amber-400',
  en_cours: 'bg-blue-100 border-blue-300 text-blue-950 hover:bg-blue-50 hover:border-blue-400',
  terminee: 'bg-emerald-100 border-emerald-300 text-emerald-950 hover:bg-emerald-50 hover:border-emerald-400',
  annulee: 'bg-slate-100 border-slate-300 text-slate-700 hover:border-slate-400',
}

const STATUT_BADGE: Record<Statut, string> = {
  planifiee: 'bg-amber-200/90 text-amber-900 border border-amber-400/50',
  en_cours: 'bg-blue-200/90 text-blue-900 border border-blue-400/50',
  terminee: 'bg-emerald-200/90 text-emerald-900 border border-emerald-400/50',
  annulee: 'bg-slate-200 text-slate-600',
}

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_LABELS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function ymd(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseYmd(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function addDays(iso: string, n: number): string {
  const d = parseYmd(iso)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

function startOfWeekISO(iso: string): string {
  const d = parseYmd(iso)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return ymd(d)
}

function endOfWeekISO(iso: string): string {
  return addDays(startOfWeekISO(iso), 6)
}

function startOfMonthISO(iso: string): string {
  const d = parseYmd(iso)
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1))
}

function endOfMonthISO(iso: string): string {
  const d = parseYmd(iso)
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

function interventionDate(i: AgendaIntervention): string | null {
  return (i.date_prevue || i.date_realisee || '').slice(0, 10) || null
}

function fmtHeure(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}

function sortByTime(a: AgendaIntervention, b: AgendaIntervention): number {
  const ha = a.heure_prevue || '99:99'
  const hb = b.heure_prevue || '99:99'
  return ha.localeCompare(hb)
}

function formatLongDay(iso: string): string {
  const d = parseYmd(iso)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type Props = {
  interventions: AgendaIntervention[]
  period: AgendaPeriod
  onPeriodChange: (p: AgendaPeriod) => void
  anchorDate: string
  onAnchorDateChange: (iso: string) => void
  techMode?: boolean
}

export default function PlanningAgenda({
  interventions,
  period,
  onPeriodChange,
  anchorDate,
  onAnchorDateChange,
  techMode = false,
}: Props) {
  const today = ymd(new Date())
  const [selectedDay, setSelectedDay] = useState(anchorDate)

  const weekStart = startOfWeekISO(anchorDate)
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const monthStart = startOfMonthISO(anchorDate)
  const monthEnd = endOfMonthISO(anchorDate)
  const monthGridStart = startOfWeekISO(monthStart)
  const monthCells = useMemo(() => {
    const cells: string[] = []
    let cur = monthGridStart
    // 6 semaines max
    for (let i = 0; i < 42; i++) {
      cells.push(cur)
      cur = addDays(cur, 1)
      if (cur > monthEnd && parseYmd(cur).getDay() === 1 && i >= 27) break
    }
    // Always fill to complete weeks
    while (cells.length % 7 !== 0) {
      cells.push(addDays(cells[cells.length - 1], 1))
    }
    if (cells.length < 35) {
      while (cells.length < 35) cells.push(addDays(cells[cells.length - 1], 1))
    }
    return cells.slice(0, 42)
  }, [monthGridStart, monthEnd])

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaIntervention[]>()
    for (const i of interventions) {
      const d = interventionDate(i)
      if (!d) continue
      const list = map.get(d) || []
      list.push(i)
      map.set(d, list)
    }
    for (const [, list] of Array.from(map.entries())) list.sort(sortByTime)
    return map
  }, [interventions])

  const todayItems = (byDay.get(today) || []).filter(i => i.statut !== 'annulee')
  const weekOtherItems = useMemo(() => {
    const out: { date: string; items: AgendaIntervention[] }[] = []
    for (const d of weekDays) {
      if (d === today) continue
      const items = (byDay.get(d) || []).filter(i => i.statut !== 'annulee')
      if (items.length) out.push({ date: d, items })
    }
    return out
  }, [weekDays, byDay, today])

  const selectedItems = (byDay.get(selectedDay) || []).filter(i => i.statut !== 'annulee')

  function shiftAnchor(delta: number) {
    if (period === 'day') onAnchorDateChange(addDays(anchorDate, delta))
    else if (period === 'week') onAnchorDateChange(addDays(anchorDate, delta * 7))
    else {
      const d = parseYmd(anchorDate)
      d.setMonth(d.getMonth() + delta)
      onAnchorDateChange(ymd(d))
    }
  }

  const periodLabel =
    period === 'day'
      ? formatLongDay(anchorDate === today ? today : anchorDate)
      : period === 'week'
        ? `Semaine du ${fmtDateFR(weekStart)}`
        : `${MOIS_LABELS[parseYmd(anchorDate).getMonth()]} ${parseYmd(anchorDate).getFullYear()}`

  return (
    <div className="space-y-4">
      {/* Bascule Jour / Semaine / Mois + navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {([
            { key: 'day' as const, label: 'Jour' },
            { key: 'week' as const, label: 'Semaine' },
            { key: 'month' as const, label: 'Mois' },
          ]).map(o => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                onPeriodChange(o.key)
                if (o.key === 'day') {
                  onAnchorDateChange(today)
                  setSelectedDay(today)
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                period === o.key
                  ? 'bg-[#0e2a52] text-white shadow'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftAnchor(-1)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
            aria-label="Période précédente"
          >
            ←
          </button>
          <div className="min-w-[10rem] text-center text-sm font-bold text-[#0e2a52] capitalize">
            {periodLabel}
          </div>
          <button
            type="button"
            onClick={() => shiftAnchor(1)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50"
            aria-label="Période suivante"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => {
              onAnchorDateChange(today)
              setSelectedDay(today)
            }}
            className="ml-1 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600"
          >
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      {period === 'day' && (
        <DayView
          today={today}
          focusDate={anchorDate}
          todayItems={anchorDate === today ? todayItems : (byDay.get(anchorDate) || []).filter(i => i.statut !== 'annulee')}
          weekOtherItems={weekOtherItems}
          techMode={techMode}
          isTodayFocus={anchorDate === today}
        />
      )}

      {period === 'week' && (
        <WeekView
          days={weekDays}
          today={today}
          byDay={byDay}
          techMode={techMode}
        />
      )}

      {period === 'month' && (
        <MonthView
          cells={monthCells}
          monthStart={monthStart}
          monthEnd={monthEnd}
          today={today}
          selectedDay={selectedDay}
          onSelectDay={(d) => {
            setSelectedDay(d)
            onAnchorDateChange(d)
          }}
          byDay={byDay}
          selectedItems={selectedItems}
          techMode={techMode}
        />
      )}
    </div>
  )
}

function DayView({
  today,
  focusDate,
  todayItems,
  weekOtherItems,
  techMode,
  isTodayFocus,
}: {
  today: string
  focusDate: string
  todayItems: AgendaIntervention[]
  weekOtherItems: { date: string; items: AgendaIntervention[] }[]
  techMode: boolean
  isTodayFocus: boolean
}) {
  const title = isTodayFocus
    ? `Aujourd'hui — ${formatLongDay(today)}`
    : formatLongDay(focusDate)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border-2 border-[#0e2a52] bg-gradient-to-br from-[#0e2a52] to-[#1a4a8a] text-white shadow-lg overflow-hidden">
        <header className="px-5 py-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/15">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-orange-200 font-bold">
              {isTodayFocus ? 'Focus du jour' : 'Jour sélectionné'}
            </div>
            <h2 className="text-xl sm:text-2xl font-black capitalize mt-1">{title}</h2>
          </div>
          <div className="text-sm font-bold bg-white/15 rounded-xl px-3 py-1.5">
            {todayItems.length} intervention{todayItems.length > 1 ? 's' : ''}
          </div>
        </header>
        <div className="p-4 sm:p-5 space-y-3 bg-slate-50">
          {todayItems.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-10">
              Aucune intervention ce jour-là.
            </p>
          ) : (
            todayItems.map(i => (
              <AgendaCard key={i.id} intervention={i} size="large" techMode={techMode} />
            ))
          )}
        </div>
      </section>

      {isTodayFocus && weekOtherItems.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <header className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
              Autres jours de la semaine
            </h3>
          </header>
          <div className="p-3 sm:p-4 space-y-4">
            {weekOtherItems.map(({ date, items }) => (
              <div key={date}>
                <div className="text-xs font-bold text-slate-500 mb-2 capitalize">
                  {formatLongDay(date)} · {items.length}
                </div>
                <div className="space-y-2 opacity-90">
                  {items.map(i => (
                    <AgendaCard key={i.id} intervention={i} size="compact" techMode={techMode} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function WeekView({
  days,
  today,
  byDay,
  techMode,
}: {
  days: string[]
  today: string
  byDay: Map<string, AgendaIntervention[]>
  techMode: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
      {days.map(d => {
        const items = (byDay.get(d) || []).filter(i => i.statut !== 'annulee')
        const isToday = d === today
        return (
          <section
            key={d}
            className={`rounded-2xl border-2 overflow-hidden flex flex-col min-h-[220px] ${
              isToday
                ? 'border-[#0e2a52] bg-[#0e2a52]/[0.03] shadow-md'
                : 'border-slate-200 bg-white'
            }`}
          >
            <header
              className={`px-2.5 py-2 ${
                isToday ? 'bg-[#0e2a52] text-white' : 'bg-slate-50 text-slate-700'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                {isToday ? "Aujourd'hui" : JOURS_COURTS[parseYmd(d).getDay() === 0 ? 6 : parseYmd(d).getDay() - 1]}
              </div>
              <div className="text-sm font-black tabular-nums">
                {parseYmd(d).getDate()}
              </div>
            </header>
            <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[420px]">
              {items.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-6">—</p>
              ) : (
                items.map(i => (
                  <AgendaCard key={i.id} intervention={i} size="chip" techMode={techMode} />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function MonthView({
  cells,
  monthStart,
  monthEnd,
  today,
  selectedDay,
  onSelectDay,
  byDay,
  selectedItems,
  techMode,
}: {
  cells: string[]
  monthStart: string
  monthEnd: string
  today: string
  selectedDay: string
  onSelectDay: (d: string) => void
  byDay: Map<string, AgendaIntervention[]>
  selectedItems: AgendaIntervention[]
  techMode: boolean
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {JOURS_COURTS.map(j => (
            <div key={j} className="text-center text-[10px] font-bold uppercase text-slate-400 py-1">
              {j}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map(d => {
            const inMonth = d >= monthStart && d <= monthEnd
            const items = (byDay.get(d) || []).filter(i => i.statut !== 'annulee')
            const isToday = d === today
            const isSelected = d === selectedDay
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDay(d)}
                className={`min-h-[4.5rem] rounded-xl border p-1.5 text-left transition ${
                  isSelected
                    ? 'border-[#0e2a52] bg-blue-50 ring-2 ring-[#0e2a52]/30'
                    : isToday
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-slate-100 hover:border-slate-300 bg-white'
                } ${!inMonth ? 'opacity-35' : ''}`}
              >
                <div className={`text-xs font-bold tabular-nums ${isToday ? 'text-orange-700' : 'text-slate-700'}`}>
                  {parseYmd(d).getDate()}
                </div>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {items.slice(0, 4).map(i => (
                    <span
                      key={i.id}
                      className={`w-2 h-2 rounded-full ${
                        i.statut === 'planifiee' ? 'bg-amber-400' :
                        i.statut === 'en_cours' ? 'bg-blue-500' :
                        i.statut === 'terminee' ? 'bg-emerald-500' :
                        'bg-slate-400'
                      }`}
                      title={i.client_nom || ''}
                    />
                  ))}
                  {items.length > 4 && (
                    <span className="text-[9px] font-bold text-slate-500">+{items.length - 4}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border-2 border-[#0e2a52] shadow-sm overflow-hidden flex flex-col">
        <header className="bg-[#0e2a52] text-white px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-orange-200 font-bold">
            {selectedDay === today ? "Aujourd'hui" : 'Jour sélectionné'}
          </div>
          <h3 className="font-black capitalize text-lg">{formatLongDay(selectedDay)}</h3>
          <div className="text-xs opacity-80 mt-0.5">
            {selectedItems.length} intervention{selectedItems.length > 1 ? 's' : ''}
          </div>
        </header>
        <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-[32rem]">
          {selectedItems.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">Rien de prévu.</p>
          ) : (
            selectedItems.map(i => (
              <AgendaCard key={i.id} intervention={i} size="large" techMode={techMode} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function AgendaCard({
  intervention: i,
  size,
  techMode,
}: {
  intervention: AgendaIntervention
  size: 'large' | 'compact' | 'chip'
  techMode: boolean
}) {
  // Admin → fiche ; tech → middleware redirige vers /terrain
  const href = `/intervention/${i.id}`
  const villeLabel = [i.code_postal, i.ville].filter(Boolean).join(' ') || i.ville || '—'
  const heure = formatCreneau(i.heure_prevue, i.heure_fin_prevue) || fmtHeure(i.heure_prevue) || '—'

  if (size === 'chip') {
    return (
      <Link
        href={href}
        className={`block rounded-lg border px-1.5 py-1.5 text-[10px] leading-tight transition ${CARD_STATUT_STYLE[i.statut]}`}
      >
        <div className="font-black tabular-nums">{heure}</div>
        <div className="font-semibold truncate">{i.client_nom || 'Client'}</div>
        <div className="truncate opacity-80">{villeLabel}</div>
      </Link>
    )
  }

  if (size === 'compact') {
    return (
      <Link
        href={href}
        className={`block rounded-xl border-2 px-3 py-2.5 transition shadow-sm ${CARD_STATUT_STYLE[i.statut]}`}
      >
        <div className="flex items-center gap-3">
          <div className="text-base font-black tabular-nums w-14 shrink-0">{heure}</div>
          <div className="min-w-0 flex-1">
            <div className="font-bold truncate text-sm">{i.client_nom || 'Client —'}</div>
            <div className="text-xs truncate opacity-80">
              {villeLabel}
              {i.type_intervention ? ` · ${i.type_intervention}` : ''}
            </div>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_BADGE[i.statut]}`}>
            {STATUT_LABEL[i.statut]}
          </span>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={`block rounded-2xl border-2 p-4 transition shadow-sm hover:shadow-md ${CARD_STATUT_STYLE[i.statut]}`}
    >
      <div className="flex gap-4">
        <div className="shrink-0 w-16 sm:w-20 text-center">
          <div className="text-2xl sm:text-3xl font-black tabular-nums leading-none">{heure.slice(0, 5)}</div>
          {i.heure_fin_prevue && (
            <div className="text-[10px] font-semibold opacity-70 mt-1">→ {fmtHeure(i.heure_fin_prevue)}</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-lg font-black truncate">{i.client_nom || 'Client —'}</div>
              <div className="text-sm font-bold opacity-90">{villeLabel}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {i.urgence && (
                <span className="text-[10px] font-bold text-red-800 bg-red-100 border border-red-300 rounded-full px-2 py-0.5">URG</span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_BADGE[i.statut]}`}>
                {STATUT_LABEL[i.statut]}
              </span>
            </div>
          </div>
          {i.adresse_chantier && (
            <div className="text-xs opacity-80 truncate">📍 {i.adresse_chantier}</div>
          )}
          <div className="text-xs font-semibold opacity-80">
            {i.type_intervention || '—'}
            {i.duree_estimee_min ? ` · ${i.duree_estimee_min} min` : ''}
          </div>
          {!techMode && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-black/10 opacity-80">
              <span className="truncate">👷 {i.technicien_nom || 'non assignée'}</span>
              {typeof i.prix_prevu === 'number' && i.prix_prevu > 0 && (
                <span className="font-black tabular-nums">{fmtEUR(i.prix_prevu)}</span>
              )}
            </div>
          )}
          {i.client_telephone && (
            <span className="text-xs font-medium opacity-80">📞 {i.client_telephone}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

/** Plage de dates à charger selon la période agenda. */
export function agendaRangeFor(period: AgendaPeriod, anchor: string): { from: string; to: string } {
  if (period === 'day') {
    const weekStart = startOfWeekISO(anchor)
    return { from: weekStart, to: endOfWeekISO(anchor) }
  }
  if (period === 'week') {
    return { from: startOfWeekISO(anchor), to: endOfWeekISO(anchor) }
  }
  // Mois : grille complète (semaines qui débordent)
  const ms = startOfMonthISO(anchor)
  const me = endOfMonthISO(anchor)
  return { from: startOfWeekISO(ms), to: endOfWeekISO(me) }
}

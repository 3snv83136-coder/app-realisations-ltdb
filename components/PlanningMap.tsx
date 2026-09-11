'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  buildAddressQuery,
  geocodeAddress,
  hasUsableAddress,
  sleep,
  TOULON_CENTER,
  type LatLng,
} from '@/lib/geocode-address'
import { fmtDateFR, fmtEUR } from '@/lib/format'
import { formatCreneau } from '@/lib/creneau'

export type PlanningMapIntervention = {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  date_realisee?: string | null
  heure_prevue: string | null
  heure_fin_prevue?: string | null
  statut: string
  urgence: boolean
  prix_prevu: number | null
  technicien_id: string | null
  technicien_nom: string | null
  client_nom: string | null
}

export type PlanningMapTech = {
  id: string
  nom: string
}

const TECH_COLORS = [
  '#0e2a52', // navy
  '#dc2626', // red
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
]

type Pin = {
  intervention: PlanningMapIntervention
  coords: LatLng
  color: string
  failed?: boolean
}

function colorForTech(technicienId: string | null, techIndex: Map<string, number>): string {
  if (!technicienId) return '#94a3b8'
  const idx = techIndex.get(technicienId) ?? 0
  return TECH_COLORS[idx % TECH_COLORS.length]
}

function pinIcon(color: string, label: string): L.DivIcon {
  const safe = (label || '?').slice(0, 2).toUpperCase()
  return L.divIcon({
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
    html: `<div style="
      width:32px;height:40px;position:relative;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));
    ">
      <svg viewBox="0 0 32 40" width="32" height="40" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 10.5 16 24 16 24s16-13.5 16-24C32 7.2 24.8 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="15" r="7.5" fill="#fff"/>
        <text x="16" y="19" text-anchor="middle" font-size="9" font-weight="700" font-family="system-ui,sans-serif" fill="${color}">${safe}</text>
      </svg>
    </div>`,
  })
}

function FitBounds({ points }: { points: LatLng[] }): null {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) {
      map.setView(TOULON_CENTER, 10)
      return
    }
    if (points.length === 1) {
      map.setView(points[0], 13)
      return
    }
    const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])))
    map.fitBounds(bounds.pad(0.18), { animate: true })
  }, [map, points])
  return null
}

const STATUT_LABEL: Record<string, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

export default function PlanningMap({
  interventions,
  techniciens,
  techFilter,
  onTechFilterChange,
  mapDate,
  onMapDateChange,
  showTechFilter,
}: {
  interventions: PlanningMapIntervention[]
  techniciens: PlanningMapTech[]
  techFilter: string
  onTechFilterChange: (v: string) => void
  mapDate: string
  onMapDateChange: (v: string) => void
  showTechFilter: boolean
}): JSX.Element {
  const techIndex = useMemo(() => {
    const m = new Map<string, number>()
    techniciens.forEach((t, i) => m.set(t.id, i))
    // Techs présents dans les interventions mais absents de la liste
    let extra = techniciens.length
    for (const i of interventions) {
      if (i.technicien_id && !m.has(i.technicien_id)) {
        m.set(i.technicien_id, extra++)
      }
    }
    return m
  }, [techniciens, interventions])

  const dayRows = useMemo(() => {
    let rows = interventions.filter(i => {
      const d = i.date_prevue || i.date_realisee || null
      return d === mapDate && i.statut !== 'annulee'
    })
    if (techFilter === 'none') rows = rows.filter(i => !i.technicien_id)
    else if (techFilter !== 'all') rows = rows.filter(i => i.technicien_id === techFilter)
    // Tri horaire pour lecture liste
    rows = [...rows].sort((a, b) =>
      (a.heure_prevue || '').localeCompare(b.heure_prevue || ''),
    )
    return rows
  }, [interventions, mapDate, techFilter])

  const [pins, setPins] = useState<Pin[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    const toGeocode = dayRows.filter(i =>
      hasUsableAddress(i.adresse_chantier, i.ville, i.code_postal),
    )
    const skipped = dayRows.length - toGeocode.length

    if (toGeocode.length === 0) {
      setPins([])
      setLoading(false)
      setProgress({ done: 0, total: 0 })
      return
    }

    setLoading(true)
    setProgress({ done: 0, total: toGeocode.length })
    setPins([])

    ;(async () => {
      const next: Pin[] = []
      for (let idx = 0; idx < toGeocode.length; idx++) {
        if (cancelled) return
        const intervention = toGeocode[idx]
        const query = buildAddressQuery(
          intervention.adresse_chantier,
          intervention.code_postal,
          intervention.ville,
        )
        const coords = await geocodeAddress(query)
        if (cancelled) return
        if (coords) {
          next.push({
            intervention,
            coords,
            color: colorForTech(intervention.technicien_id, techIndex),
          })
        }
        setProgress({ done: idx + 1, total: toGeocode.length })
        setPins([...next])
        // Respect Nominatim : ~1 req/s (sauf cache hit instantané)
        if (idx < toGeocode.length - 1) await sleep(350)
      }
      if (!cancelled) {
        setLoading(false)
        if (skipped > 0) {
          /* affiché via UI */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dayRows, techIndex])

  const legendTechs = useMemo(() => {
    const ids = new Set(
      dayRows.map(i => i.technicien_id).filter((id): id is string => !!id),
    )
    const items = Array.from(ids).map(id => {
      const fromList = techniciens.find(t => t.id === id)
      const fromRow = dayRows.find(i => i.technicien_id === id)
      return {
        id,
        nom: fromList?.nom || fromRow?.technicien_nom || 'Technicien',
        color: colorForTech(id, techIndex),
      }
    })
    const hasUnassigned = dayRows.some(i => !i.technicien_id)
    return { items, hasUnassigned }
  }, [dayRows, techniciens, techIndex])

  const withoutAddress = dayRows.filter(
    i => !hasUsableAddress(i.adresse_chantier, i.ville, i.code_postal),
  ).length

  if (typeof window === 'undefined') return <></>

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="block text-sm flex-1">
          <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Jour</span>
          <input
            type="date"
            value={mapDate}
            onChange={e => onMapDateChange(e.target.value)}
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white"
          />
        </label>
        {showTechFilter && (
          <label className="block text-sm flex-1">
            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Technicien</span>
            <select
              value={techFilter}
              onChange={e => onTechFilterChange(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 mt-1 bg-white"
            >
              <option value="all">Tous les techniciens</option>
              <option value="none">Non assignées</option>
              {techniciens.map(t => (
                <option key={t.id} value={t.id}>{t.nom}</option>
              ))}
            </select>
          </label>
        )}
        <div className="text-sm text-slate-600 sm:pb-2">
          <span className="font-bold text-[#0e2a52]">{dayRows.length}</span>
          {' '}RDV ·{' '}
          <span className="font-bold text-[#0e2a52]">{pins.length}</span>
          {' '}sur la carte
          {loading && progress.total > 0 && (
            <span className="text-slate-400"> · localisation {progress.done}/{progress.total}</span>
          )}
        </div>
      </div>

      {(legendTechs.items.length > 0 || legendTechs.hasUnassigned) && (
        <div className="flex flex-wrap gap-2 px-1">
          {legendTechs.items.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTechFilterChange(techFilter === t.id ? 'all' : t.id)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition ${
                techFilter === t.id
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
              {t.nom}
            </button>
          ))}
          {legendTechs.hasUnassigned && (
            <button
              type="button"
              onClick={() => onTechFilterChange(techFilter === 'none' ? 'all' : 'none')}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition ${
                techFilter === 'none'
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              Non assignée
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {dayRows.length === 0 ? (
          <div className="h-[420px] flex flex-col items-center justify-center text-slate-500 gap-2 p-6 text-center">
            <div className="text-4xl">🗺</div>
            <p className="font-semibold text-slate-700">Aucune intervention ce jour-là</p>
            <p className="text-sm">Change la date ou le filtre technicien.</p>
          </div>
        ) : (
          <div className="relative h-[min(70vh,560px)] min-h-[360px]">
            {loading && pins.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10 gap-2 text-slate-500 text-sm">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-[#0e2a52] rounded-full animate-spin" />
                Localisation des chantiers…
              </div>
            ) : null}
            <MapContainer
              center={TOULON_CENTER}
              zoom={10}
              scrollWheelZoom
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              {pins.map(pin => {
                const i = pin.intervention
                const initial = (i.technicien_nom || '?').trim().charAt(0) || '?'
                const creneau = formatCreneau(i.heure_prevue, i.heure_fin_prevue)
                return (
                  <Marker
                    key={i.id}
                    position={pin.coords}
                    icon={pinIcon(pin.color, initial)}
                  >
                    <Popup>
                      <div className="text-sm min-w-[180px] space-y-1">
                        <div className="font-bold text-[#0e2a52]">
                          {i.urgence ? '🚨 ' : ''}
                          {i.type_intervention || 'Intervention'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {creneau || '—'} · {STATUT_LABEL[i.statut] || i.statut}
                        </div>
                        <div>{i.client_nom || 'Client'}</div>
                        <div className="text-xs text-slate-600">
                          {[i.adresse_chantier, [i.code_postal, i.ville].filter(Boolean).join(' ')]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                        <div className="text-xs">
                          👷 {i.technicien_nom || 'non assignée'}
                          {i.prix_prevu != null ? ` · ${fmtEUR(i.prix_prevu)}` : ''}
                        </div>
                        <Link
                          href={`/intervention/${i.id}`}
                          className="inline-block mt-1 text-blue-700 font-bold text-xs hover:underline"
                        >
                          Ouvrir la fiche →
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
              <FitBounds points={pins.map(p => p.coords)} />
            </MapContainer>
          </div>
        )}
      </div>

      {withoutAddress > 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          ⚠ {withoutAddress} intervention{withoutAddress > 1 ? 's' : ''} sans adresse
          utilisable — non affichée{withoutAddress > 1 ? 's' : ''} sur la carte.
        </p>
      )}

      {dayRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-500">
            Liste du {fmtDateFR(mapDate)}
          </div>
          <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {dayRows.map(i => {
              const color = colorForTech(i.technicien_id, techIndex)
              const creneau = formatCreneau(i.heure_prevue, i.heure_fin_prevue)
              const onMap = pins.some(p => p.intervention.id === i.id)
              return (
                <li key={i.id}>
                  <Link
                    href={`/intervention/${i.id}`}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition"
                  >
                    <span
                      className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: onMap ? color : '#cbd5e1' }}
                      title={onMap ? 'Sur la carte' : 'Non localisée'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#0e2a52] truncate">
                        {creneau ? `${creneau} · ` : ''}
                        {i.client_nom || 'Client'}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {i.type_intervention || '—'} · {[i.ville, i.adresse_chantier].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 shrink-0">
                      {i.technicien_nom || '—'}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

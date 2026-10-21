'use client'
/**
 * Schéma libre du réseau + marqueurs liés aux observations / photos.
 * Exporte une image composite (dessin + pastilles numérotées) pour le PDF.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SchemaMarker } from '@/components/InspectionCameraPDF'

export type SchemaObsOption = {
  tronconId: string
  tronconNom: string
  obsIndex: number
  label: string
  code?: string
  description: string
  hasPhoto: boolean
}

type Mode = 'draw' | 'pin'

type Props = {
  observations: SchemaObsOption[]
  drawingUrl?: string | null
  markers: SchemaMarker[]
  onChange: (next: {
    drawingUrl: string | null
    markers: SchemaMarker[]
    compositeUrl: string | null
  }) => void
}

const MARKER_COLORS = ['#c0392b', '#0e2a52', '#b45309', '#047857', '#7c3aed', '#0369a1']

function markerColor(n: number) {
  return MARKER_COLORS[(n - 1) % MARKER_COLORS.length]
}

export function composeSchemaImage(
  drawingUrl: string | null,
  markers: SchemaMarker[],
  cssW = 800,
  cssH = 480,
): Promise<string | null> {
  if (!drawingUrl && markers.length === 0) return Promise.resolve(null)

  const w = Math.max(800, Math.round(cssW * 2))
  const h = Math.max(480, Math.round(cssH * 2))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(drawingUrl)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#e8eef5'
  ctx.lineWidth = 1
  const step = 40
  for (let x = step; x < w; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  const drawMarkers = () => {
    for (const m of markers) {
      const x = (m.xPct / 100) * w
      const y = (m.yPct / 100) * h
      const r = Math.max(16, Math.round(w * 0.018))
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = markerColor(m.n)
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.round(r * 1.1)}px Helvetica, Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(m.n), x, y + 1)
    }
    return canvas.toDataURL('image/jpeg', 0.88)
  }

  if (!drawingUrl) return Promise.resolve(drawMarkers())

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h)
      resolve(drawMarkers())
    }
    img.onerror = () => resolve(drawMarkers())
    img.src = drawingUrl
  })
}

function paintGrid(ctx: CanvasRenderingContext2D, cssW: number, cssH: number) {
  ctx.save()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  const step = 28
  for (let x = step; x < cssW; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssH); ctx.stroke()
  }
  for (let y = step; y < cssH; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke()
  }
  ctx.restore()
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#0e2a52'
}

export default function SchemaReseauEditor({
  observations,
  drawingUrl,
  markers,
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(Boolean(drawingUrl))
  const [mode, setMode] = useState<Mode>('draw')
  const [selectedObsKey, setSelectedObsKey] = useState<string>('')
  const [empty, setEmpty] = useState(!drawingUrl && markers.length === 0)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const markersRef = useRef(markers)
  markersRef.current = markers
  const emitSeq = useRef(0)

  const obsKey = (o: SchemaObsOption) => `${o.tronconId}:${o.obsIndex}`

  const placedKeys = useMemo(
    () => new Set(markers.map(m => `${m.tronconId}:${m.obsIndex}`)),
    [markers],
  )

  const availableObs = useMemo(
    () => observations.filter(o => !placedKeys.has(obsKey(o))),
    [observations, placedKeys],
  )

  useEffect(() => {
    if (!selectedObsKey && availableObs[0]) {
      setSelectedObsKey(obsKey(availableObs[0]))
    } else if (selectedObsKey && !availableObs.some(o => obsKey(o) === selectedObsKey)) {
      setSelectedObsKey(availableObs[0] ? obsKey(availableObs[0]) : '')
    }
  }, [availableObs, selectedObsKey])

  const emit = useCallback(async (nextMarkers: SchemaMarker[]) => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    const drawingOut = hasInk.current && canvas ? canvas.toDataURL('image/png') : null
    const seq = ++emitSeq.current
    const composite = await composeSchemaImage(
      drawingOut,
      nextMarkers,
      rect?.width || 800,
      rect?.height || 480,
    )
    if (seq !== emitSeq.current) return
    setEmpty(!drawingOut && nextMarkers.length === 0)
    onChangeRef.current({
      drawingUrl: drawingOut,
      markers: nextMarkers,
      compositeUrl: composite,
    })
  }, [])

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width * ratio))
    const h = Math.max(1, Math.round(rect.height * ratio))
    const prevData = hasInk.current ? canvas.toDataURL('image/png') : null
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(ratio, ratio)
    paintGrid(ctx, rect.width, rect.height)
    const src = drawingUrl || prevData
    if (src && hasInk.current) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = src
    }
  }, [drawingUrl])

  useEffect(() => {
    setupCanvas()
    const onResize = () => setupCanvas()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setupCanvas])

  useEffect(() => {
    if (!drawingUrl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const img = new Image()
    img.onload = () => {
      paintGrid(ctx, rect.width, rect.height)
      ctx.drawImage(img, 0, 0, rect.width, rect.height)
      hasInk.current = true
      setEmpty(false)
    }
    img.src = drawingUrl
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw') return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const { x, y } = point(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw' || !drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = point(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInk.current = true
  }

  function endDraw() {
    if (mode !== 'draw' || !drawing.current) return
    drawing.current = false
    if (!hasInk.current) return
    void emit(markersRef.current)
  }

  function placePin(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'pin') return
    e.preventDefault()
    const obs = availableObs.find(o => obsKey(o) === selectedObsKey)
    if (!obs) return
    const { x, y, w, h } = point(e)
    if (w <= 0 || h <= 0) return
    const n = markersRef.current.length + 1
    const next: SchemaMarker = {
      id: `m-${Date.now().toString(36)}-${n}`,
      xPct: Math.round((x / w) * 1000) / 10,
      yPct: Math.round((y / h) * 1000) / 10,
      n,
      tronconId: obs.tronconId,
      tronconNom: obs.tronconNom,
      obsIndex: obs.obsIndex,
      label: obs.label,
      code: obs.code,
      description: obs.description.slice(0, 160),
      hasPhoto: obs.hasPhoto,
    }
    void emit([...markersRef.current, next])
  }

  function removeMarker(id: string) {
    const remaining = markersRef.current
      .filter(m => m.id !== id)
      .map((m, i) => ({ ...m, n: i + 1 }))
    void emit(remaining)
  }

  function clearAll() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const ratio = window.devicePixelRatio || 1
      ctx.scale(ratio, ratio)
      ctx.clearRect(0, 0, rect.width, rect.height)
      paintGrid(ctx, rect.width, rect.height)
    }
    hasInk.current = false
    setEmpty(true)
    onChangeRef.current({ drawingUrl: null, markers: [], compositeUrl: null })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Dessine le sens du réseau (regards, direction d’écoulement), puis place les anomalies
        pour les relier à une observation et sa photo.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
            mode === 'draw'
              ? 'border-[#0e2a52] bg-[#0e2a52] text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          ✏️ Dessiner
        </button>
        <button
          type="button"
          onClick={() => setMode('pin')}
          disabled={availableObs.length === 0}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition disabled:opacity-40 ${
            mode === 'pin'
              ? 'border-red-600 bg-red-600 text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          📍 Placer une anomalie
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto px-3 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 border-2 border-red-200"
        >
          Effacer tout
        </button>
      </div>

      {mode === 'pin' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
            Observation à associer
          </div>
          {availableObs.length === 0 ? (
            <p className="text-sm text-amber-800">Toutes les observations sont déjà placées, ou aucune n’est renseignée.</p>
          ) : (
            <select
              value={selectedObsKey}
              onChange={e => setSelectedObsKey(e.target.value)}
              className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {availableObs.map(o => (
                <option key={obsKey(o)} value={obsKey(o)}>
                  {o.label}{o.hasPhoto ? ' 📷' : ''} — {o.description.slice(0, 60) || 'sans description'}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-amber-800">Puis touche le schéma à l’endroit de l’anomalie.</p>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-300 bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          onPointerDown={mode === 'draw' ? startDraw : placePin}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          className={`w-full h-64 sm:h-80 touch-none ${mode === 'draw' ? 'cursor-crosshair' : 'cursor-cell'}`}
        />
        {markers.map(m => (
          <button
            key={m.id}
            type="button"
            title={`${m.label} — cliquer pour retirer`}
            onClick={() => removeMarker(m.id)}
            className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full text-white text-xs font-black shadow-md border-2 border-white flex items-center justify-center"
            style={{
              left: `${m.xPct}%`,
              top: `${m.yPct}%`,
              backgroundColor: markerColor(m.n),
            }}
          >
            {m.n}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          {empty
            ? 'Schéma vide — dessine puis place les anomalies'
            : `Schéma prêt · ${markers.length} anomalie(s) placée(s)`}
        </span>
        {mode === 'draw' && <span>Mode dessin actif</span>}
        {mode === 'pin' && <span>Mode placement actif</span>}
      </div>

      {markers.length > 0 && (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
            Légende des anomalies
          </div>
          {markers.map(m => (
            <div key={m.id} className="flex items-start gap-3 px-3 py-2.5 bg-white">
              <span
                className="shrink-0 w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center"
                style={{ backgroundColor: markerColor(m.n) }}
              >
                {m.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-800 truncate">
                  {m.label}{m.code ? ` · ${m.code}` : ''}{m.hasPhoto ? ' 📷' : ''}
                </div>
                <div className="text-xs text-slate-500 line-clamp-2">{m.description || '—'}</div>
              </div>
              <button
                type="button"
                onClick={() => removeMarker(m.id)}
                className="text-xs font-semibold text-red-600 shrink-0"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

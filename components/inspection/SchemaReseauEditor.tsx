'use client'
/**
 * Schéma réseau professionnel :
 * - banque de symboles (regards, canalisations, flèches…)
 * - dessin libre
 * - pastilles d’anomalies liées aux observations / photos
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SchemaMarker } from '@/components/InspectionCameraPDF'
import {
  SCHEMA_SYMBOL_BANK,
  SCHEMA_SYMBOL_CATEGORIES,
  getSymbolDef,
  paintSymbolInstance,
  symbolPreviewDataUrl,
  type SchemaSymbolInstance,
  type SchemaSymbolKind,
} from '@/lib/schema-reseau-symbols'

export type SchemaObsOption = {
  tronconId: string
  tronconNom: string
  obsIndex: number
  label: string
  code?: string
  description: string
  hasPhoto: boolean
}

type Mode = 'draw' | 'pipe' | 'symbol' | 'pin' | 'select'

const PIPE_KINDS = new Set<SchemaSymbolKind>(['canalisation', 'canalisation_ep', 'branchement'])

function pipeStyle(kind: SchemaSymbolKind): { color: string; width: number } {
  if (kind === 'canalisation_ep') return { color: '#0369a1', width: 10 }
  if (kind === 'branchement') return { color: '#0e2a52', width: 5 }
  return { color: '#0e2a52', width: 9 }
}

type Props = {
  observations: SchemaObsOption[]
  drawingUrl?: string | null
  markers: SchemaMarker[]
  symbols?: SchemaSymbolInstance[]
  onChange: (next: {
    drawingUrl: string | null
    markers: SchemaMarker[]
    symbols: SchemaSymbolInstance[]
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
  symbols: SchemaSymbolInstance[],
  cssW = 800,
  cssH = 480,
): Promise<string | null> {
  if (!drawingUrl && markers.length === 0 && symbols.length === 0) return Promise.resolve(null)

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

  const finish = () => {
    for (const sym of symbols) paintSymbolInstance(ctx, sym, w, h)
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
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  if (!drawingUrl) return Promise.resolve(finish())

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h)
      resolve(finish())
    }
    img.onerror = () => resolve(finish())
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

function SymbolThumb({ kind }: { kind: SchemaSymbolKind }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    setSrc(symbolPreviewDataUrl(kind, 56))
  }, [kind])
  if (!src) return <span className="w-10 h-10 block bg-slate-100 rounded" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="w-10 h-10 object-contain" />
}

export default function SchemaReseauEditor({
  observations,
  drawingUrl,
  markers,
  symbols: symbolsProp = [],
  onChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(Boolean(drawingUrl))
  const [mode, setMode] = useState<Mode>('pipe')
  const [selectedKind, setSelectedKind] = useState<SchemaSymbolKind>('canalisation')
  const [pipeKind, setPipeKind] = useState<SchemaSymbolKind>('canalisation')
  const [selectedObsKey, setSelectedObsKey] = useState('')
  const [symbols, setSymbols] = useState<SchemaSymbolInstance[]>(symbolsProp)
  const [selectedSymbolId, setSelectedSymbolId] = useState<string | null>(null)
  const [category, setCategory] = useState<(typeof SCHEMA_SYMBOL_CATEGORIES)[number]['id']>('reseaux')
  const [empty, setEmpty] = useState(!drawingUrl && markers.length === 0 && symbolsProp.length === 0)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const markersRef = useRef(markers)
  markersRef.current = markers
  const symbolsRef = useRef(symbols)
  symbolsRef.current = symbols
  const emitSeq = useRef(0)
  const pipeKindRef = useRef(pipeKind)
  pipeKindRef.current = pipeKind

  // Sync symbols from parent when draft restored
  useEffect(() => {
    setSymbols(symbolsProp)
    symbolsRef.current = symbolsProp
  }, [symbolsProp])

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
    if (!selectedObsKey && availableObs[0]) setSelectedObsKey(obsKey(availableObs[0]))
    else if (selectedObsKey && !availableObs.some(o => obsKey(o) === selectedObsKey)) {
      setSelectedObsKey(availableObs[0] ? obsKey(availableObs[0]) : '')
    }
  }, [availableObs, selectedObsKey])

  const bankFiltered = useMemo(
    () => SCHEMA_SYMBOL_BANK.filter(s => s.category === category),
    [category],
  )

  const emit = useCallback(async (nextMarkers: SchemaMarker[], nextSymbols: SchemaSymbolInstance[]) => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    const drawingOut = hasInk.current && canvas ? canvas.toDataURL('image/png') : null
    const seq = ++emitSeq.current
    const composite = await composeSchemaImage(
      drawingOut,
      nextMarkers,
      nextSymbols,
      rect?.width || 800,
      rect?.height || 480,
    )
    if (seq !== emitSeq.current) return
    setEmpty(!drawingOut && nextMarkers.length === 0 && nextSymbols.length === 0)
    onChangeRef.current({
      drawingUrl: drawingOut,
      markers: nextMarkers,
      symbols: nextSymbols,
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

  function applyStrokeStyle(ctx: CanvasRenderingContext2D, forPipe: boolean) {
    if (forPipe) {
      const st = pipeStyle(pipeKindRef.current)
      ctx.strokeStyle = st.color
      ctx.lineWidth = st.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    } else {
      ctx.strokeStyle = '#0e2a52'
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw' && mode !== 'pipe') return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    applyStrokeStyle(ctx, mode === 'pipe')
    const { x, y } = point(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // Point de départ visible (surtout utile au toucher)
    ctx.lineTo(x + 0.01, y + 0.01)
    ctx.stroke()
    hasInk.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if ((mode !== 'draw' && mode !== 'pipe') || !drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    applyStrokeStyle(ctx, mode === 'pipe')
    const { x, y } = point(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasInk.current = true
  }

  function endDraw() {
    if ((mode !== 'draw' && mode !== 'pipe') || !drawing.current) return
    drawing.current = false
    if (!hasInk.current) return
    void emit(markersRef.current, symbolsRef.current)
  }

  function selectBankSymbol(kind: SchemaSymbolKind) {
    setSelectedKind(kind)
    if (PIPE_KINDS.has(kind)) {
      setPipeKind(kind)
      setMode('pipe')
    } else {
      setMode('symbol')
    }
  }

  function nextTagFor(kind: SchemaSymbolKind): string {
    const def = getSymbolDef(kind)
    const same = symbolsRef.current.filter(s => s.kind === kind).length + 1
    if (kind === 'nord' || kind === 'fleche_ecoulement' || kind === 'fleche_inspection') return ''
    return `${def.short}${same}`
  }

  function placeOnCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === 'draw' || mode === 'pipe') return
    e.preventDefault()
    const { x, y, w, h } = point(e)
    if (w <= 0 || h <= 0) return
    const xPct = Math.round((x / w) * 1000) / 10
    const yPct = Math.round((y / h) * 1000) / 10

    if (mode === 'symbol') {
      const next: SchemaSymbolInstance = {
        id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        kind: selectedKind,
        xPct,
        yPct,
        rotationDeg: 0,
        scale: 1,
        tag: nextTagFor(selectedKind) || undefined,
      }
      const nextSymbols = [...symbolsRef.current, next]
      setSymbols(nextSymbols)
      symbolsRef.current = nextSymbols
      setSelectedSymbolId(next.id)
      void emit(markersRef.current, nextSymbols)
      return
    }

    if (mode === 'pin') {
      const obs = availableObs.find(o => obsKey(o) === selectedObsKey)
      if (!obs) return
      const n = markersRef.current.length + 1
      const next: SchemaMarker = {
        id: `m-${Date.now().toString(36)}-${n}`,
        xPct,
        yPct,
        n,
        tronconId: obs.tronconId,
        tronconNom: obs.tronconNom,
        obsIndex: obs.obsIndex,
        label: obs.label,
        code: obs.code,
        description: obs.description.slice(0, 160),
        hasPhoto: obs.hasPhoto,
      }
      void emit([...markersRef.current, next], symbolsRef.current)
    }
  }

  function removeMarker(id: string) {
    const remaining = markersRef.current
      .filter(m => m.id !== id)
      .map((m, i) => ({ ...m, n: i + 1 }))
    void emit(remaining, symbolsRef.current)
  }

  function removeSymbol(id: string) {
    const next = symbolsRef.current.filter(s => s.id !== id)
    setSymbols(next)
    symbolsRef.current = next
    if (selectedSymbolId === id) setSelectedSymbolId(null)
    void emit(markersRef.current, next)
  }

  function updateSelectedSymbol(patch: Partial<SchemaSymbolInstance>) {
    if (!selectedSymbolId) return
    const next = symbolsRef.current.map(s =>
      s.id === selectedSymbolId ? { ...s, ...patch } : s,
    )
    setSymbols(next)
    symbolsRef.current = next
    void emit(markersRef.current, next)
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
    setSymbols([])
    symbolsRef.current = []
    setSelectedSymbolId(null)
    onChangeRef.current({ drawingUrl: null, markers: [], symbols: [], compositeUrl: null })
  }

  const selectedSym = symbols.find(s => s.id === selectedSymbolId) || null

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 space-y-1">
        <p className="font-bold text-[#0e2a52]">Comment faire</p>
        <ol className="list-decimal list-inside text-xs sm:text-sm space-y-0.5 text-slate-600">
          <li><strong>Canalisation continue</strong> : clique « Canalisation EU/EP » puis trace au doigt sans lever (trait épais).</li>
          <li><strong>Regards / flèches</strong> : banque → symbole → touche le plan pour poser.</li>
          <li><strong>Anomalies</strong> : d’abord une observation dans un tronçon, puis « Marquer une anomalie » → choisir l’obs → toucher le plan.</li>
        </ol>
      </div>

      {/* Modes */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setPipeKind('canalisation'); setSelectedKind('canalisation'); setMode('pipe'); setCategory('reseaux') }}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
            mode === 'pipe' && pipeKind === 'canalisation'
              ? 'border-[#0e2a52] bg-[#0e2a52] text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          ━ Canalisation EU
        </button>
        <button
          type="button"
          onClick={() => { setPipeKind('canalisation_ep'); setSelectedKind('canalisation_ep'); setMode('pipe'); setCategory('reseaux') }}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
            mode === 'pipe' && pipeKind === 'canalisation_ep'
              ? 'border-sky-700 bg-sky-700 text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          ━ Canalisation EP
        </button>
        <button
          type="button"
          onClick={() => setMode('symbol')}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
            mode === 'symbol'
              ? 'border-[#0e2a52] bg-[#0e2a52] text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          Banque symboles
        </button>
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
            mode === 'draw'
              ? 'border-[#0e2a52] bg-[#0e2a52] text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          Trait libre
        </button>
        <button
          type="button"
          onClick={() => setMode('pin')}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
            mode === 'pin'
              ? 'border-red-600 bg-red-600 text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          📍 Marquer une anomalie
        </button>
        <button
          type="button"
          onClick={() => setMode('select')}
          className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition ${
            mode === 'select'
              ? 'border-[#0e2a52] bg-[#0e2a52] text-white'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          Sélection
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto px-3 py-2 rounded-xl text-sm font-bold text-red-600 bg-red-50 border-2 border-red-200"
        >
          Effacer tout
        </button>
      </div>

      {mode === 'pipe' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 font-semibold">
          Mode canalisation {pipeKind === 'canalisation_ep' ? 'EP (bleu)' : pipeKind === 'branchement' ? 'branchement' : 'EU (navy)'} —
          glisse le doigt / la souris sans lever pour un tracé continu.
        </div>
      )}

      {/* Palette symboles */}
      {(mode === 'symbol' || mode === 'pipe') && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {SCHEMA_SYMBOL_CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  category === c.id
                    ? 'bg-[#0e2a52] text-white'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {bankFiltered.map(def => (
              <button
                key={def.kind}
                type="button"
                onClick={() => selectBankSymbol(def.kind)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 bg-white transition ${
                  (PIPE_KINDS.has(def.kind) ? mode === 'pipe' && pipeKind === def.kind : mode === 'symbol' && selectedKind === def.kind)
                    ? 'border-[#0e2a52] ring-2 ring-[#0e2a52]/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                title={PIPE_KINDS.has(def.kind) ? `${def.label} — tracé continu` : def.label}
              >
                <SymbolThumb kind={def.kind} />
                <span className="text-[10px] font-bold text-slate-700 text-center leading-tight">
                  {def.label}
                  {PIPE_KINDS.has(def.kind) ? ' · continu' : ''}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {PIPE_KINDS.has(selectedKind)
              ? 'Canalisation = tracé continu (glisser). Autres symboles = toucher pour poser.'
              : <>Symbole : <strong>{getSymbolDef(selectedKind).label}</strong> — touche le schéma pour le placer.</>}
          </p>
        </div>
      )}

      {mode === 'pin' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-3">
          <div className="text-sm font-black text-amber-950">Marquer une anomalie sur le schéma</div>
          {observations.length === 0 ? (
            <div className="text-sm text-amber-900 space-y-2">
              <p>
                Aucune observation disponible. Remonte dans la section <strong>3. Tronçons</strong>,
                ajoute une observation (position / code / description, photo si possible),
                puis reviens ici.
              </p>
              <p className="text-xs text-amber-800">
                Sans observation renseignée, on ne peut pas lier une pastille à un constat.
              </p>
            </div>
          ) : availableObs.length === 0 ? (
            <p className="text-sm text-amber-900">Toutes les observations sont déjà placées sur le schéma.</p>
          ) : (
            <>
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-900">
                1. Choisis l’observation
                <select
                  value={selectedObsKey}
                  onChange={e => setSelectedObsKey(e.target.value)}
                  className="mt-1.5 w-full border-2 border-amber-400 rounded-lg px-3 py-2.5 text-sm bg-white font-semibold text-slate-800"
                >
                  {availableObs.map(o => (
                    <option key={obsKey(o)} value={obsKey(o)}>
                      {o.label}{o.hasPhoto ? ' 📷' : ''} — {o.description.slice(0, 60) || 'sans description'}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm font-bold text-amber-950">
                2. Touche ensuite le schéma à l’endroit de l’anomalie (pastille numérotée).
              </p>
            </>
          )}
        </div>
      )}

      {/* Canvas */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-300 bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          onPointerDown={(mode === 'draw' || mode === 'pipe') ? startDraw : placeOnCanvas}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          className={`w-full h-72 sm:h-96 touch-none ${
            mode === 'draw' || mode === 'pipe' ? 'cursor-crosshair' : mode === 'select' ? 'cursor-default' : 'cursor-cell'
          }`}
        />
        {/* Symboles en overlay HTML pour sélection / feedback */}
        {symbols.map(sym => {
          const def = getSymbolDef(sym.kind)
          const active = selectedSymbolId === sym.id
          return (
            <button
              key={sym.id}
              type="button"
              title={`${def.label}${sym.tag ? ` (${sym.tag})` : ''} — cliquer pour sélectionner`}
              onClick={e => {
                e.stopPropagation()
                setMode('select')
                setSelectedSymbolId(sym.id)
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 bg-white/90 shadow ${
                active ? 'border-[#0e2a52] ring-2 ring-blue-300 z-10' : 'border-transparent'
              }`}
              style={{
                left: `${sym.xPct}%`,
                top: `${sym.yPct}%`,
                transform: `translate(-50%, -50%) rotate(${sym.rotationDeg}deg) scale(${sym.scale})`,
                width: 48,
                height: 48,
                pointerEvents: (mode === 'draw' || mode === 'pipe') ? 'none' : 'auto',
              }}
            >
              <SymbolThumb kind={sym.kind} />
              {sym.tag && (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-[#0e2a52] whitespace-nowrap">
                  {sym.tag}
                </span>
              )}
            </button>
          )
        })}
        {markers.map(m => (
          <button
            key={m.id}
            type="button"
            title={`${m.label} — cliquer pour retirer`}
            onClick={() => removeMarker(m.id)}
            className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full text-white text-xs font-black shadow-md border-2 border-white flex items-center justify-center z-20"
            style={{
              left: `${m.xPct}%`,
              top: `${m.yPct}%`,
              backgroundColor: markerColor(m.n),
              pointerEvents: (mode === 'draw' || mode === 'pipe') ? 'none' : 'auto',
            }}
          >
            {m.n}
          </button>
        ))}
      </div>

      {/* Contrôles symbole sélectionné */}
      {selectedSym && mode === 'select' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-[#0e2a52]">
            {getSymbolDef(selectedSym.kind).label}
            {selectedSym.tag ? ` · ${selectedSym.tag}` : ''}
          </span>
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            Rotation
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={selectedSym.rotationDeg}
              onChange={e => updateSelectedSymbol({ rotationDeg: Number(e.target.value) })}
              className="w-28"
            />
            <span className="tabular-nums w-8">{selectedSym.rotationDeg}°</span>
          </label>
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            Taille
            <input
              type="range"
              min={60}
              max={180}
              step={10}
              value={Math.round((selectedSym.scale || 1) * 100)}
              onChange={e => updateSelectedSymbol({ scale: Number(e.target.value) / 100 })}
              className="w-24"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            Tag
            <input
              value={selectedSym.tag || ''}
              onChange={e => updateSelectedSymbol({ tag: e.target.value.slice(0, 8) })}
              className="border border-slate-300 rounded-lg px-2 py-1 w-16 text-sm"
              placeholder="R1"
            />
          </label>
          <button
            type="button"
            onClick={() => removeSymbol(selectedSym.id)}
            className="ml-auto text-xs font-bold text-red-600"
          >
            Retirer
          </button>
        </div>
      )}

      <div className="text-[11px] text-slate-500">
        {empty
          ? 'Schéma vide — trace une canalisation ou pose un regard'
          : `${symbols.length} symbole(s) · ${markers.length} anomalie(s)${hasInk.current ? ' · tracés' : ''}`}
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
              <button type="button" onClick={() => removeMarker(m.id)} className="text-xs font-semibold text-red-600 shrink-0">
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

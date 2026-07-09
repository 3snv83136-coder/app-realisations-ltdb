'use client'

import { useState } from 'react'
import { getGarantieIntervention } from '@/lib/garantie-intervention'

type InterventionLite = {
  id: string
  rapport_json: unknown
}

type Props = {
  interv: InterventionLite
  onSaved: () => void | Promise<void>
  onError: (msg: string) => void
}

export default function StepGaranti({ interv, onSaved, onError }: Props) {
  const existing = getGarantieIntervention(interv.rapport_json)
  const [estGaranti, setEstGaranti] = useState<boolean | null>(existing?.est_garanti ?? null)
  const [commentaire, setCommentaire] = useState(existing?.commentaire || '')
  const [busy, setBusy] = useState(false)

  async function handleContinue() {
    if (estGaranti === null) {
      onError('Indique si l\'intervention est garantie (Oui ou Non).')
      return
    }
    setBusy(true)
    onError('')
    try {
      const res = await fetch(`/api/interventions/${interv.id}/garantie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          est_garanti: estGaranti,
          commentaire: commentaire.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      await fetch(`/api/interventions/${interv.id}/terrain-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', step: 5 }),
      })

      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">🛡️</div>
        <h1 className="text-2xl font-black text-slate-800">Garantie d&apos;intervention</h1>
        <p className="text-sm text-slate-600 mt-2">
          L&apos;intervention réalisée est-elle garantie ? Cette information apparaîtra sur le rapport client.
        </p>
      </header>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Garantie</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setEstGaranti(true)}
            className={`py-4 rounded-xl font-black text-lg transition border-2 ${
              estGaranti === true
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            ✓ Oui
          </button>
          <button
            type="button"
            onClick={() => setEstGaranti(false)}
            className={`py-4 rounded-xl font-black text-lg transition border-2 ${
              estGaranti === false
                ? 'bg-red-600 text-white border-red-700 shadow-lg'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300'
            }`}
          >
            ✕ Non
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">
          Précisions (facultatif)
        </label>
        <textarea
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          rows={4}
          placeholder="Ex. : garantie 1 an sur le débouchage réalisé, hors récidive liée à un défaut structurel…"
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-3 py-2 text-sm resize-y"
        />
      </div>

      {estGaranti === true && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
          Le rapport affichera un encart <strong>vert</strong> « Intervention garantie ».
        </div>
      )}
      {estGaranti === false && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-800">
          Le rapport affichera un encart <strong>rouge</strong> « Intervention non garantie ».
        </div>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={busy || estGaranti === null}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl py-5 font-black text-lg shadow-lg transition"
      >
        {busy ? '⚙ Enregistrement…' : 'Continuer vers la facture →'}
      </button>
    </section>
  )
}

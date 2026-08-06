'use client'
import React, { useState } from "react"

export interface ResendAllIntervention {
  id: string
  reference: string | null
  client_nom: string | null
  client_email: string | null
  ville: string | null
  has_rapport?: boolean
  has_facture?: boolean
}

type SendResult = {
  recipient?: string
  attachments?: { rapport?: boolean; facture?: boolean; accord?: boolean }
  owner_confirmation?: boolean
  warnings: string[]
}

export default function ResendAllButton({ intervention }: { intervention: ResendAllIntervention }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(intervention.client_email || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SendResult | null>(null)

  const canSend = !!(intervention.has_rapport !== false && intervention.has_facture !== false)
  if (!canSend) return null

  async function handleSend(forceResend: boolean) {
    if (!email.trim()) { setError('Email obligatoire'); return }
    setSending(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/notify-rapport-facture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interventionId: intervention.id,
          clientEmail: email.trim(),
          forceResend,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      const warnings: string[] = []
      if (data.warning) warnings.push(String(data.warning))
      if (data.test_mode_warning) warnings.push(String(data.test_mode_warning))
      if (data.accord_warning) warnings.push(String(data.accord_warning))
      if (data.owner_confirmation_warning) warnings.push(`Accusé gérant : ${data.owner_confirmation_warning}`)
      if (data.alreadySent) warnings.unshift('Aucun nouvel envoi — déjà envoyé récemment.')

      setResult({
        recipient: data.recipient || data.client_email || email.trim(),
        attachments: data.attachments,
        owner_confirmation: data.owner_confirmation,
        warnings,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setError('')
          setResult(null)
          setEmail(intervention.client_email || '')
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0e2a52] hover:bg-[#1a3d6e] text-white text-xs font-bold transition"
        title="Renvoyer rapport + facture + accord"
      >
        ✉ Tout renvoyer
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !sending && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-[#0e2a52] text-lg mb-1">Renvoyer tout au client</h3>
            <p className="text-sm text-slate-500 mb-4">
              Rapport + facture{intervention.reference ? ` — ${intervention.reference}` : ''}
              {intervention.client_nom ? ` · ${intervention.client_nom}` : ''}
            </p>
            <p className="text-xs text-slate-600 mb-3">
              L&apos;accord signé est joint automatiquement s&apos;il est archivé en base.
            </p>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email du destinataire
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@client.com"
              autoFocus
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2.5 text-base"
              disabled={sending}
            />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mt-3">
                ⚠ {error}
              </div>
            )}
            {result && (
              <div className={`rounded-lg px-3 py-2 text-sm mt-3 border ${result.warnings.some(w => w.includes('Aucun nouvel')) ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <p className="font-bold">{result.warnings.some(w => w.includes('Aucun nouvel')) ? '⚠ Pas de nouvel envoi' : '✓ Envoyé'}</p>
                <p>Destinataire : <strong>{result.recipient}</strong></p>
                {result.attachments && (
                  <p className="text-xs mt-1">
                    PJ : rapport {result.attachments.rapport ? '✓' : '✗'}
                    {' · '}facture {result.attachments.facture ? '✓' : '✗'}
                    {' · '}accord {result.attachments.accord ? '✓' : '✗'}
                  </p>
                )}
                <p className="text-xs">Accusé gérant : {result.owner_confirmation ? '✓' : '✗'}</p>
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs mt-1">{w}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="flex-1 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => handleSend(false)}
                disabled={sending || !email.trim()}
                className="flex-1 bg-[#0e2a52] text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-[#1a3d6e] disabled:opacity-50"
              >
                {sending ? 'Envoi…' : 'Envoyer'}
              </button>
              <button
                type="button"
                onClick={() => handleSend(true)}
                disabled={sending || !email.trim()}
                className="flex-1 border-2 border-amber-400 text-amber-800 bg-amber-50 rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-amber-100 disabled:opacity-50"
                title="Ignore le délai anti-doublon de 30 minutes"
              >
                Forcer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

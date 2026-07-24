'use client'

import { useEffect, useState } from 'react'

type Props = {
  interventionId: string
  clientNom?: string | null
  clientTelephone?: string | null
  onTelephoneChange?: (tel: string) => void
  className?: string
}

/**
 * Conteneur autonome : SMS « lien avis Google » envoyé via Brevo
 * (API /api/interventions/[id]/send-review-sms).
 */
export default function EnvoyerAvisSmsPanel({
  interventionId,
  clientNom,
  clientTelephone,
  onTelephoneChange,
  className = '',
}: Props) {
  const [telephone, setTelephone] = useState(clientTelephone || '')
  const [smsOk, setSmsOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [apiConfigured, setApiConfigured] = useState(true)

  useEffect(() => {
    setTelephone(clientTelephone || '')
  }, [clientTelephone])

  useEffect(() => {
    fetch('/api/sms', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setApiConfigured(!!j.configured))
      .catch(() => setApiConfigured(false))
  }, [])

  async function handleSend() {
    const phone = telephone.trim()
    if (!phone) {
      setError('Saisis un numéro de mobile valide.')
      return
    }
    setBusy(true)
    setError('')
    setSmsOk(false)
    try {
      const res = await fetch(`/api/interventions/${interventionId}/send-review-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientPhone: phone,
          clientNom: clientNom?.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSmsOk(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={`bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 ${className}`}
    >
      <header>
        <h2 className="text-base font-black text-amber-950 flex items-center gap-2">
          <span aria-hidden>⭐</span>
          <span>Envoyer avis par SMS</span>
        </h2>
        <p className="text-xs sm:text-sm text-amber-900/80 mt-1">
          Envoie immédiatement le lien Google avis au client (Brevo) — sans rapport ni facture.
        </p>
      </header>

      <div>
        <label className="block text-xs uppercase tracking-wider text-amber-900/70 font-bold mb-1">
          Téléphone mobile
        </label>
        <input
          type="tel"
          inputMode="tel"
          value={telephone}
          onChange={e => {
            setTelephone(e.target.value)
            onTelephoneChange?.(e.target.value)
            setError('')
            setSmsOk(false)
          }}
          placeholder="06 12 34 56 78"
          className="w-full border-2 border-amber-200 focus:border-amber-500 outline-none rounded-xl px-3 py-3 text-base bg-white"
          disabled={busy}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-semibold">
          ⚠ {error}
        </div>
      )}

      {smsOk && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-2 text-sm font-semibold">
          ✓ SMS avis Google envoyé
        </div>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={busy || !telephone.trim() || !apiConfigured}
        title={!apiConfigured ? 'SMS Brevo non configuré sur le serveur' : undefined}
        className="w-full min-h-[52px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl py-3.5 font-black text-base shadow-sm transition"
      >
        {busy
          ? '⚙ Envoi…'
          : smsOk
            ? '✓ SMS avis envoyé — renvoyer'
            : '⭐ Envoyer le SMS avis Google'}
      </button>

      {!apiConfigured && (
        <p className="text-xs text-amber-800 font-semibold text-center">
          SMS Brevo indisponible — vérifie BREVO_API_KEY sur Vercel.
        </p>
      )}
    </section>
  )
}

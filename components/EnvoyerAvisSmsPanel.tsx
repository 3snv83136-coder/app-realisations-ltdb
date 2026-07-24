'use client'

import { useEffect, useState } from 'react'

type Props = {
  /** Si fourni → API liée à l’intervention ; sinon → envoi direct (accueil). */
  interventionId?: string
  clientNom?: string | null
  clientTelephone?: string | null
  onTelephoneChange?: (tel: string) => void
  /** Affiche le champ nom (utile sans fiche client). */
  showNom?: boolean
  className?: string
}

/**
 * Conteneur autonome : SMS « lien avis Google » via Brevo.
 */
export default function EnvoyerAvisSmsPanel({
  interventionId,
  clientNom: clientNomProp,
  clientTelephone,
  onTelephoneChange,
  showNom = !interventionId,
  className = '',
}: Props) {
  const [telephone, setTelephone] = useState(clientTelephone || '')
  const [nom, setNom] = useState(clientNomProp || '')
  const [smsOk, setSmsOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [apiConfigured, setApiConfigured] = useState(true)

  useEffect(() => {
    setTelephone(clientTelephone || '')
  }, [clientTelephone])

  useEffect(() => {
    setNom(clientNomProp || '')
  }, [clientNomProp])

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
      const url = interventionId
        ? `/api/interventions/${interventionId}/send-review-sms`
        : '/api/notify-client/review-sms'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientPhone: phone,
          clientNom: (showNom ? nom : clientNomProp)?.trim() || undefined,
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

  const inputCls =
    'w-full border-2 border-amber-700/40 focus:border-amber-600 outline-none rounded-xl px-3 py-3 text-base bg-white text-slate-900 placeholder:text-slate-500'

  return (
    <section
      className={`bg-amber-400 border-2 border-amber-200 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3 ${className}`}
    >
      <header>
        <h2 className="text-lg font-black text-[#1a1208] flex items-center gap-2">
          <span aria-hidden>⭐</span>
          <span>Envoyer avis par SMS</span>
        </h2>
        <p className="text-sm text-[#3d2a10] mt-1 font-medium">
          Envoie immédiatement le lien Google avis au client (Brevo) — sans rapport ni facture.
        </p>
      </header>

      {showNom && (
        <div>
          <label className="block text-xs uppercase tracking-wider text-[#1a1208] font-bold mb-1">
            Nom du client <span className="font-semibold normal-case text-[#3d2a10]">(facultatif)</span>
          </label>
          <input
            type="text"
            value={nom}
            onChange={e => {
              setNom(e.target.value)
              setError('')
              setSmsOk(false)
            }}
            placeholder="ex. Dupont"
            className={inputCls}
            disabled={busy}
          />
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-wider text-[#1a1208] font-bold mb-1">
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
          className={inputCls}
          disabled={busy}
        />
      </div>

      {error && (
        <div className="bg-red-700 text-white rounded-xl px-3 py-2 text-sm font-semibold">
          ⚠ {error}
        </div>
      )}

      {smsOk && (
        <div className="bg-emerald-700 text-white rounded-xl px-3 py-2 text-sm font-semibold">
          ✓ SMS avis Google envoyé
        </div>
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={busy || !telephone.trim() || !apiConfigured}
        title={!apiConfigured ? 'SMS Brevo non configuré sur le serveur' : undefined}
        className="w-full min-h-[52px] bg-[#0e2a52] hover:bg-[#0a2047] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl py-3.5 font-black text-base shadow-md transition border-2 border-[#0a2047]"
      >
        {busy
          ? '⚙ Envoi…'
          : smsOk
            ? '✓ SMS avis envoyé — renvoyer'
            : '⭐ Envoyer le SMS avis Google'}
      </button>

      {!apiConfigured && (
        <p className="text-sm text-[#1a1208] font-bold text-center">
          SMS Brevo indisponible — vérifie BREVO_API_KEY sur Vercel.
        </p>
      )}
    </section>
  )
}

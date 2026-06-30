'use client'

import { useCallback, useEffect, useState } from "react"
import { buildSmsUri, isMobileForSms, openNativeSms } from "@/lib/sms"

export type SendSmsButtonProps = {
  phone?: string
  clientNom?: string
  /** Message pré-rempli (sinon chargé via loadMessage). */
  defaultMessage?: string
  /** Charge le texte au clic (ex. lien avis Google). */
  loadMessage?: () => Promise<string>
  label?: string
  className?: string
  /** Style bouton compact (terrain) ou standard. */
  variant?: 'default' | 'outline' | 'tile'
  disabled?: boolean
  /** Affiche un bouton pour charger le modèle « lien avis Google ». */
  reviewPreset?: boolean
  onSent?: () => void
  onError?: (msg: string) => void
}

/**
 * Bouton d'envoi SMS manuel :
 * - Twilio si configuré (envoi automatique serveur),
 * - sinon ouverture de la messagerie native du téléphone (mobile).
 */
export default function SendSmsButton({
  phone: phoneProp = '',
  clientNom,
  defaultMessage = '',
  loadMessage,
  label = '📱 Envoyer SMS',
  className = '',
  variant = 'default',
  disabled = false,
  reviewPreset = false,
  onSent,
  onError,
}: SendSmsButtonProps) {
  const [twilioOk, setTwilioOk] = useState(false)
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState(phoneProp)
  const [message, setMessage] = useState(defaultMessage)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [smsUri, setSmsUri] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sms', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setTwilioOk(!!j.configured))
      .catch(() => setTwilioOk(false))
  }, [])

  useEffect(() => {
    setPhone(phoneProp)
  }, [phoneProp])

  useEffect(() => {
    if (defaultMessage) setMessage(defaultMessage)
  }, [defaultMessage])

  const openModal = useCallback(async () => {
    setOpen(true)
    setStatus(null)
    setSmsUri(null)
    if (loadMessage && !defaultMessage) {
      setBusy(true)
      try {
        const text = await loadMessage()
        setMessage(text)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setStatus(msg)
        onError?.(msg)
      } finally {
        setBusy(false)
      }
    }
  }, [loadMessage, defaultMessage, onError])

  async function loadReviewTemplate() {
    const to = phone.trim()
    if (!to || to.replace(/\D/g, '').length < 10) {
      const msg = 'Saisis d\'abord un numéro valide.'
      setStatus(msg)
      onError?.(msg)
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const text = await loadReviewSmsDraft(to, clientNom)
      setMessage(text)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleSend() {
    const to = phone.trim()
    const body = message.trim()
    if (!to || to.replace(/\D/g, '').length < 10) {
      const msg = 'Numéro de téléphone invalide.'
      setStatus(msg)
      onError?.(msg)
      return
    }
    if (!body) {
      const msg = 'Message vide.'
      setStatus(msg)
      onError?.(msg)
      return
    }

    setBusy(true)
    setStatus(null)
    setSmsUri(null)

    try {
      if (twilioOk) {
        const res = await fetch('/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, message: body }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        setStatus('SMS envoyé ✓')
        onSent?.()
        setTimeout(() => setOpen(false), 1200)
        return
      }

      if (!isMobileForSms()) {
        const msg = 'Twilio non configuré : ouvre l\'app sur ton smartphone pour envoyer le SMS.'
        setStatus(msg)
        onError?.(msg)
        return
      }
      const uri = buildSmsUri(to, body)
      setSmsUri(uri)
      openNativeSms(to, body)
      setStatus('Messagerie ouverte — envoie le SMS depuis ton téléphone.')
      onSent?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(msg)
      onError?.(msg)
    } finally {
      setBusy(false)
    }
  }

  const btnClass =
    variant === 'outline'
      ? 'bg-white hover:bg-violet-50 disabled:opacity-50 text-violet-900 border-2 border-violet-300 rounded-xl py-3 font-bold text-sm transition w-full'
      : variant === 'tile'
        ? 'relative w-full text-left rounded-xl p-4 border transition-colors bg-violet-50 border-violet-200 hover:bg-violet-100 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
        : 'bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 px-4 font-bold text-sm transition'

  return (
    <>
      {variant === 'tile' ? (
        <button type="button" disabled={disabled} onClick={openModal} className={`${btnClass} ${className}`}>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl">📱</span>
            <span className="font-bold text-sm text-violet-700">{label.replace(/^📱\s*/, '') || 'Envoyer SMS'}</span>
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {twilioOk
              ? 'Envoi automatique via Twilio (lien avis, rappel, message libre)'
              : 'Ouvre la messagerie de ton téléphone (Twilio non configuré)'}
          </div>
        </button>
      ) : (
        <button type="button" disabled={disabled || busy} onClick={openModal} className={`${btnClass} ${className}`}>
          {busy && !open ? 'Chargement…' : label}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Envoyer un SMS</h3>
              <button
                type="button"
                onClick={() => { setOpen(false); setStatus(null) }}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >×</button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              {twilioOk
                ? 'Envoi via Twilio — le client reçoit le SMS directement.'
                : 'Mode manuel : la messagerie de ton téléphone s\'ouvrira avec le message pré-rempli.'}
              {clientNom ? ` · ${clientNom}` : ''}
            </p>

            <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone mobile</label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setStatus(null) }}
              placeholder="06 12 34 56 78"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm mb-3"
              disabled={busy}
            />

            <label className="block text-xs font-medium text-slate-600 mb-1">Message</label>
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); setStatus(null) }}
              rows={5}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0e2a52] outline-none text-sm resize-y min-h-[100px]"
              disabled={busy}
            />

            {reviewPreset && (
              <button
                type="button"
                onClick={loadReviewTemplate}
                disabled={busy}
                className="mt-2 text-xs font-bold text-violet-700 hover:text-violet-900 underline disabled:opacity-50"
              >
                ⭐ Charger le modèle « lien avis Google »
              </button>
            )}

            {status && (
              <div className={`mt-3 text-sm ${status.includes('✓') || status.includes('ouverte') ? 'text-emerald-600' : 'text-red-600'}`}>
                {status}
              </div>
            )}

            {smsUri && (
              <a href={smsUri} className="block mt-2 text-center text-sm font-bold text-violet-700 underline">
                Ouvrir le SMS si la messagerie ne s&apos;est pas lancée
              </a>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setOpen(false); setStatus(null) }}
                className="px-3 py-2 text-sm rounded-xl border border-slate-200 hover:bg-slate-50"
                disabled={busy}
              >Annuler</button>
              <button
                type="button"
                onClick={handleSend}
                disabled={busy}
                className="px-3 py-2 text-sm rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >{busy ? 'Envoi…' : twilioOk ? 'Envoyer le SMS' : 'Ouvrir la messagerie'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Charge le texte SMS « lien avis Google » via l'API existante. */
export async function loadReviewSmsDraft(clientPhone: string, clientNom?: string): Promise<string> {
  const res = await fetch('/api/notify-client/review-sms-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientPhone, clientNom }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data.body || ''
}

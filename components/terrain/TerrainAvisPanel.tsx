'use client'
import { useState } from "react"
import { buildSmsUri, isMobileForSms, openNativeSms } from "@/lib/sms"
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry"

type Props = {
  clientNom: string
  clientEmail: string
  clientTelephone: string
  ville?: string | null
  technicienNom?: string
  onError: (msg: string) => void
  onEmailChange?: (email: string) => void
  onTelephoneChange?: (tel: string) => void
}

export default function TerrainAvisPanel({
  clientNom,
  clientEmail,
  clientTelephone,
  ville,
  technicienNom,
  onError,
  onEmailChange,
  onTelephoneChange,
}: Props) {
  const [email, setEmail] = useState(clientEmail)
  const [telephone, setTelephone] = useState(clientTelephone)
  const [busy, setBusy] = useState<"mail" | "sms" | null>(null)
  const [mailOk, setMailOk] = useState(false)
  const [smsUri, setSmsUri] = useState<string | null>(null)

  async function handleSendReviewMail() {
    const addr = email.trim()
    if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      onError("Saisis un email client valide pour envoyer le lien avis.")
      return
    }
    setBusy("mail")
    onError("")
    setMailOk(false)
    try {
      const tech = technicienNom
        || (typeof window !== "undefined" ? localStorage.getItem("ltdb_technicien") || "" : "")
      const res = await fetch("/api/notify-client/review-only", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: addr,
          clientNom: clientNom.trim() || undefined,
          ville: ville || undefined,
          technicienNom: tech || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMailOk(true)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function handleSendReviewSms() {
    const phone = telephone.trim()
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      onError("Saisis un numéro mobile valide pour le SMS avis.")
      return
    }
    if (!isMobileForSms()) {
      onError("Le SMS s'ouvre depuis un smartphone. Ouvre l'app sur ton téléphone.")
      return
    }
    setBusy("sms")
    onError("")
    setSmsUri(null)
    try {
      const draft = await fetchJsonWithRetry<{ body: string }>("/api/notify-client/review-sms-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientPhone: phone,
          clientNom: clientNom.trim() || undefined,
        }),
        retries: 2,
        timeoutMs: 20_000,
      })
      const uri = buildSmsUri(phone, draft.body)
      setSmsUri(uri)
      openNativeSms(phone, draft.body)
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
      <div>
        <h2 className="text-sm font-black text-amber-900 flex items-center gap-2">
          <span>⭐</span>
          <span>Lien avis Google</span>
        </h2>
        <p className="text-xs text-amber-800 mt-1">
          Envoie uniquement le lien pour laisser un avis — sans rapport ni facture.
        </p>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-amber-900/70 font-bold mb-1">
          Email client
        </label>
        <input
          type="email"
          value={email}
          onChange={e => {
            setEmail(e.target.value)
            onEmailChange?.(e.target.value)
          }}
          placeholder="client@exemple.fr"
          className="w-full border-2 border-amber-200 focus:border-amber-500 outline-none rounded-xl px-3 py-2.5 text-sm bg-white"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-amber-900/70 font-bold mb-1">
          Téléphone mobile
        </label>
        <input
          type="tel"
          value={telephone}
          onChange={e => {
            setTelephone(e.target.value)
            onTelephoneChange?.(e.target.value)
          }}
          placeholder="06 12 34 56 78"
          className="w-full border-2 border-amber-200 focus:border-amber-500 outline-none rounded-xl px-3 py-2.5 text-sm bg-white"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleSendReviewMail}
          disabled={!!busy}
          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl py-3 font-bold text-sm transition"
        >
          {busy === "mail" ? "Envoi…" : mailOk ? "✓ Mail avis envoyé" : "✉ Envoyer lien par mail"}
        </button>
        <button
          type="button"
          onClick={handleSendReviewSms}
          disabled={!!busy}
          className="bg-white hover:bg-amber-100 disabled:opacity-50 text-amber-900 border-2 border-amber-300 rounded-xl py-3 font-bold text-sm transition"
        >
          {busy === "sms" ? "Ouverture…" : "💬 SMS lien avis"}
        </button>
      </div>

      {smsUri && (
        <a
          href={smsUri}
          className="block text-center text-sm font-bold text-amber-900 underline py-1"
        >
          Ouvrir le SMS si la messagerie ne s&apos;est pas lancée
        </a>
      )}
    </div>
  )
}

import { normalizePhoneForSmsUri } from "@/lib/sms"

/**
 * Envoi de SMS via Twilio.
 *
 * Activation : définir les variables d'environnement sur Vercel
 *   - TWILIO_ACCOUNT_SID            : SID du compte (commence par "AC…")
 *   - TWILIO_AUTH_TOKEN             : jeton d'authentification
 *   - TWILIO_FROM                   : numéro expéditeur E.164 (ex. +33757591234)
 *                                    OU sender alphanumérique selon le pays
 *   - TWILIO_MESSAGING_SERVICE_SID  : (optionnel) alternative à TWILIO_FROM
 *
 * Tant que les identifiants ne sont pas définis, l'envoi est désactivé proprement
 * (aucune erreur bloquante), ce qui évite tout coût/échec en l'absence de compte.
 */

export type SmsResult =
  | { ok: true; messageId?: string; status?: string }
  | { ok: false; error: string; disabled?: boolean }

export function isTwilioSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID)
  )
}

/** Destinataire Twilio : format E.164 (+33…). */
export function toTwilioRecipient(raw: string): string | null {
  return normalizePhoneForSmsUri(raw)
}

export async function sendSmsTwilio({ to, content }: { to: string; content: string }): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (!sid || !token || (!from && !messagingServiceSid)) {
    return { ok: false, error: "Identifiants Twilio manquants", disabled: true }
  }

  const recipient = toTwilioRecipient(to)
  if (!recipient) return { ok: false, error: "Numéro de téléphone invalide" }

  const form = new URLSearchParams()
  form.set("To", recipient)
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid)
  else if (from) form.set("From", from)
  // On borne le corps pour éviter les SMS multi-segments involontaires et coûteux.
  form.set("Body", (content || "").slice(0, 640))

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`
  const auth = Buffer.from(`${sid}:${token}`).toString("base64")

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: form.toString(),
    })
    const data = await res.json().catch(() => ({} as Record<string, unknown>))
    if (!res.ok) {
      const msg = (data as { message?: string }).message || `Twilio HTTP ${res.status}`
      return { ok: false, error: msg }
    }
    return {
      ok: true,
      messageId: (data as { sid?: string }).sid,
      status: (data as { status?: string }).status,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

import { normalizePhoneForSmsUri } from "@/lib/sms"

export type SmsResult =
  | { ok: true; messageId?: string | number; provider: "brevo" }
  | { ok: false; error: string; disabled?: boolean; provider: "brevo" }

const BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms"

export function isBrevoSmsConfigured(): boolean {
  return !!process.env.BREVO_API_KEY
}

export function getBrevoSender(): string {
  const raw = (process.env.BREVO_SMS_SENDER || "LTDB").replace(/[^A-Za-z0-9]/g, "")
  return (raw || "LTDB").slice(0, 11)
}

/** Format Brevo : chiffres internationaux sans « + » (ex. 33612345678). */
export function toBrevoRecipient(raw: string): string | null {
  const e164 = normalizePhoneForSmsUri(raw)
  if (!e164) return null
  return e164.replace(/^\+/, "")
}

export async function sendSmsBrevo({ to, content }: { to: string; content: string }): Promise<SmsResult> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY manquante", disabled: true, provider: "brevo" }

  const recipient = toBrevoRecipient(to)
  if (!recipient) return { ok: false, error: "Numéro de téléphone invalide", provider: "brevo" }

  try {
    const res = await fetch(BREVO_SMS_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: getBrevoSender(),
        recipient,
        content: (content || "").slice(0, 640),
        type: "transactional",
      }),
    })
    const data = await res.json().catch(() => ({} as Record<string, unknown>))
    if (!res.ok) {
      const msg = (data as { message?: string }).message || `Brevo HTTP ${res.status}`
      return { ok: false, error: msg, provider: "brevo" }
    }
    return {
      ok: true,
      messageId: (data as { messageId?: string | number }).messageId,
      provider: "brevo",
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), provider: "brevo" }
  }
}

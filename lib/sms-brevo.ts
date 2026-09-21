import { normalizePhoneForSmsUri } from "@/lib/sms"

export type SmsResult =
  | { ok: true; messageId?: string | number; provider: "brevo"; remainingCredits?: number }
  | { ok: false; error: string; disabled?: boolean; provider: "brevo" }

/** Endpoint Brevo transactionnel SMS. */
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

export async function sendSmsBrevo({
  to,
  content,
  tag,
}: {
  to: string
  content: string
  tag?: string
}): Promise<SmsResult> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY manquante", disabled: true, provider: "brevo" }

  const recipient = toBrevoRecipient(to)
  if (!recipient) return { ok: false, error: "Numéro de téléphone invalide", provider: "brevo" }

  // Mobile FR : 06/07 → +336/+337. Les fixes (01–05, 09) ne reçoivent en général pas de SMS.
  if (recipient.startsWith("33") && !/^33[67]/.test(recipient)) {
    return {
      ok: false,
      error: "Ce numéro n’est pas un mobile (06/07). Les SMS avis ne partent que vers un mobile.",
      provider: "brevo",
    }
  }

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
        ...(tag ? { tag } : {}),
      }),
    })
    const data = await res.json().catch(() => ({} as Record<string, unknown>))
    if (!res.ok) {
      const msg =
        (data as { message?: string }).message
        || (data as { error?: string }).error
        || `Brevo HTTP ${res.status}`
      return { ok: false, error: msg, provider: "brevo" }
    }
    return {
      ok: true,
      messageId: (data as { messageId?: string | number }).messageId,
      remainingCredits: (data as { remainingCredits?: number }).remainingCredits,
      provider: "brevo",
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), provider: "brevo" }
  }
}

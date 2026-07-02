import { isBrevoSmsConfigured, sendSmsBrevo } from "@/lib/sms-brevo"
import { isTwilioSmsConfigured, sendSmsTwilio } from "@/lib/sms-twilio"

export type SmsSendResult =
  | { ok: true; messageId?: string | number; provider: "brevo" | "twilio" }
  | { ok: false; error: string; disabled?: boolean }

/** Brevo en priorité (SMS achetés), repli Twilio si configuré. */
export function isSmsConfigured(): boolean {
  return isBrevoSmsConfigured() || isTwilioSmsConfigured()
}

export function smsProviderName(): "brevo" | "twilio" | null {
  if (isBrevoSmsConfigured()) return "brevo"
  if (isTwilioSmsConfigured()) return "twilio"
  return null
}

export async function sendSms({ to, content }: { to: string; content: string }): Promise<SmsSendResult> {
  if (isBrevoSmsConfigured()) {
    const r = await sendSmsBrevo({ to, content })
    if (r.ok) return { ok: true, messageId: r.messageId, provider: "brevo" }
    return { ok: false, error: r.error, disabled: r.disabled }
  }
  if (isTwilioSmsConfigured()) {
    const r = await sendSmsTwilio({ to, content })
    if (r.ok) return { ok: true, messageId: r.messageId, provider: "twilio" }
    return { ok: false, error: r.error, disabled: r.disabled }
  }
  return { ok: false, error: "SMS non configuré (BREVO_API_KEY ou Twilio)", disabled: true }
}

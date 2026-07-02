export type AvisSmsPlanItem = {
  day: number
  send_at: string
  phone: string
  message: string
  sent: boolean
  canceled: boolean
  sent_at?: string | null
  provider?: string | null
  message_id?: string | number | null
}

/** Séquence avis Google : J+1 SMS, J+2 mail, J+4 SMS, J+6 mail puis stop. */
export const AVIS_RELANCE_PLAN = [
  { day: 1, channel: "sms" as const },
  { day: 2, channel: "email" as const },
  { day: 4, channel: "sms" as const },
  { day: 6, channel: "email" as const },
]

export function parseAvisSmsPlan(raw: unknown): AvisSmsPlanItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is AvisSmsPlanItem => {
    if (!x || typeof x !== "object") return false
    const o = x as AvisSmsPlanItem
    return typeof o.day === "number" && typeof o.send_at === "string" && typeof o.phone === "string"
  })
}

/** Relances avis encore en attente (mails Resend + SMS planifiés non envoyés). */
export function countAvisRelancesPendantes(emailIds: unknown, smsPlan: unknown): number {
  const emails = Array.isArray(emailIds) ? emailIds.filter(Boolean).length : 0
  const sms = parseAvisSmsPlan(smsPlan).filter(x => !x.sent && !x.canceled).length
  return emails + sms
}

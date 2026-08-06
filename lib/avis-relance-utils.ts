export type AvisRelanceChannel = "sms" | "email"

/** Élément du plan de relances avis (SMS et/ou mails). */
export type AvisSmsPlanItem = {
  day: number
  send_at: string
  /** Requis pour SMS ; vide pour email. */
  phone: string
  message: string
  sent: boolean
  canceled: boolean
  sent_at?: string | null
  provider?: string | null
  message_id?: string | number | null
  /** Défaut : sms (rétrocompat plans existants). */
  channel?: AvisRelanceChannel
  email?: string | null
  resend_id?: string | null
}

/** Séquence avis Google : 1 seul SMS à J+1 — aucune relance mail/SMS. */
export const AVIS_RELANCE_PLAN: ReadonlyArray<{ day: number; channel: AvisRelanceChannel }> = [
  { day: 1, channel: "sms" },
]

export function avisItemChannel(item: AvisSmsPlanItem): AvisRelanceChannel {
  return item.channel === "email" ? "email" : "sms"
}

export function parseAvisSmsPlan(raw: unknown): AvisSmsPlanItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is AvisSmsPlanItem => {
    if (!x || typeof x !== "object") return false
    const o = x as AvisSmsPlanItem
    if (typeof o.day !== "number" || typeof o.send_at !== "string") return false
    const channel = o.channel === "email" ? "email" : "sms"
    if (channel === "sms") return typeof o.phone === "string"
    return true
  })
}

/** Relances avis encore en attente (mails + SMS non envoyés / non annulés). */
export function countAvisRelancesPendantes(emailIds: unknown, smsPlan: unknown): number {
  const plan = parseAvisSmsPlan(smsPlan)
  const pendingInPlan = plan.filter(x => !x.sent && !x.canceled).length
  const hasEmailInPlan = plan.some(x => x.channel === "email")
  if (hasEmailInPlan) return pendingInPlan
  // Rétrocompat : anciens plans — SMS dans le plan, mails seulement via IDs Resend
  const emails = Array.isArray(emailIds) ? emailIds.filter(Boolean).length : 0
  return pendingInPlan + emails
}

export type AvisEnvoiStatus = "pending" | "sent" | "canceled"

export type AvisEnvoiHistoriqueItem = {
  day: number
  channel: AvisRelanceChannel
  sendAt: string
  status: AvisEnvoiStatus
  sentAt: string | null
  destinataire: string | null
  label: string
}

export function buildAvisEnvoisTimeline(
  plan: AvisSmsPlanItem[],
  emailIdsFallback: string[] = [],
  now = Date.now(),
): AvisEnvoiHistoriqueItem[] {
  const items: AvisEnvoiHistoriqueItem[] = plan.map(p => {
    const channel = avisItemChannel(p)
    let status: AvisEnvoiStatus = "pending"
    if (p.canceled) status = "canceled"
    else if (p.sent) status = "sent"
    else if (channel === "email" && new Date(p.send_at).getTime() <= now) status = "sent"

    return {
      day: p.day,
      channel,
      sendAt: p.send_at,
      status,
      sentAt: p.sent_at || (status === "sent" ? p.send_at : null),
      destinataire: channel === "email" ? (p.email || null) : (p.phone || null),
      label: channel === "email" ? `Mail J+${p.day}` : `SMS J+${p.day}`,
    }
  })

  // Anciens dossiers : IDs Resend sans entrée plan email
  const hasEmailInPlan = items.some(i => i.channel === "email")
  if (!hasEmailInPlan && emailIdsFallback.length > 0) {
    const emailDays = AVIS_RELANCE_PLAN.filter(s => s.channel === "email").map(s => s.day)
    emailIdsFallback.forEach((id, idx) => {
      const day = emailDays[idx] ?? (2 + idx * 4)
      items.push({
        day,
        channel: "email",
        sendAt: "",
        status: "pending",
        sentAt: null,
        destinataire: null,
        label: `Mail J+${day} (programmé)`,
      })
      void id
    })
  }

  return items.sort((a, b) => {
    if (a.sendAt && b.sendAt) return a.sendAt.localeCompare(b.sendAt)
    return a.day - b.day
  })
}

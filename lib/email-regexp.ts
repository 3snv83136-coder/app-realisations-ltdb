export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Nettoie et déduplique une liste d'emails (minuscules). */
export function parseAdditionalEmails(emails: string[], exclude?: string): string[] {
  const skip = exclude?.trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of emails) {
    const e = raw.trim().toLowerCase()
    if (!EMAIL_RE.test(e) || e === skip || seen.has(e)) continue
    seen.add(e)
    out.push(e)
  }
  return out
}

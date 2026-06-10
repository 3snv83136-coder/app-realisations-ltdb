/** Normalise un numéro FR vers E.164 (+33…) pour le lien sms:. */
export function normalizePhoneForSmsUri(raw: string): string | null {
  const cleaned = (raw || "").trim().replace(/[\s.\-()]/g, "")
  if (!cleaned) return null
  if (cleaned.startsWith("+")) {
    const digits = "+" + cleaned.slice(1).replace(/\D/g, "")
    return digits.length >= 11 ? digits : null
  }
  const digits = cleaned.replace(/\D/g, "")
  if (digits.startsWith("33") && digits.length === 11) return `+${digits}`
  if (digits.startsWith("0") && digits.length === 10) return `+33${digits.slice(1)}`
  if (digits.length >= 10) return `+${digits}`
  return null
}

export function isMobileForSms(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
}

function isIosSms(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Limite la taille du corps (URLs longues) pour les liens sms: sur mobile. */
export function truncateSmsBody(body: string, max = 1100): string {
  const t = (body || "").trim()
  if (t.length <= max) return t
  return t.slice(0, max - 3).trimEnd() + "..."
}

/** Construit l'URI sms: — à utiliser dans un <a href> (fiable après async sur iOS). */
export function buildSmsUri(to: string, body: string): string {
  const phone = normalizePhoneForSmsUri(to)
  if (!phone) throw new Error("Numéro de téléphone invalide")
  const safeBody = truncateSmsBody(body)
  const sep = isIosSms() ? "&" : "?"
  return `sms:${phone}${sep}body=${encodeURIComponent(safeBody)}`
}

/**
 * Tente d'ouvrir Messages. Sur iOS, échoue souvent après une opération async
 * (génération PDF) — préférer un lien <a href={buildSmsUri(...)}> visible.
 */
export function openNativeSms(to: string, body: string): boolean {
  const uri = buildSmsUri(to, body)
  try {
    const a = document.createElement("a")
    a.href = uri
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return true
  } catch {
    try {
      window.location.href = uri
      return true
    } catch {
      return false
    }
  }
}

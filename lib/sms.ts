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

/** Ouvre la messagerie SMS native du téléphone (pas de compte tiers). */
export function openNativeSms(to: string, body: string): void {
  const phone = normalizePhoneForSmsUri(to)
  if (!phone) throw new Error("Numéro de téléphone invalide")

  const encoded = encodeURIComponent(body)
  const isIos = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const sep = isIos ? "&" : "?"
  window.location.href = `sms:${phone}${sep}body=${encoded}`
}

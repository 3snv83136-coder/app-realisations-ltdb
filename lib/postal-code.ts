/**
 * Normalise un code postal français (exactement 5 chiffres).
 * Accepte "83000", "83000 Toulon", "F-83000", "CP 83000", etc.
 */
export function normalizeFrenchPostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, "")
  // Prend les 5 premiers chiffres (évite CEDEX collés du type 8300099)
  if (digits.length >= 5) return digits.slice(0, 5)
  return null
}

/** Cherche un CP 5 chiffres dans une adresse libre. */
export function extractPostalCodeFromText(...parts: Array<string | null | undefined>): string | null {
  for (const part of parts) {
    if (!part) continue
    const m = String(part).match(/\b(\d{5})\b/)
    if (m) return m[1]
  }
  return null
}

/**
 * Résout un CP valide pour la publication Django LTDB.
 * Ordre : champs CP explicites → adresse → ville (table Var).
 */
export function resolvePostalCodeForPublish(opts: {
  codePostal?: string | null
  clientCp?: string | null
  adresse?: string | null
  ville?: string | null
  findVilleCp?: (ville: string) => string | null | undefined
}): string | null {
  const direct =
    normalizeFrenchPostalCode(opts.codePostal)
    || normalizeFrenchPostalCode(opts.clientCp)
  if (direct) return direct

  const fromText = extractPostalCodeFromText(opts.adresse, opts.codePostal, opts.clientCp)
  if (fromText) return fromText

  const ville = (opts.ville || "").trim()
  if (ville && opts.findVilleCp) {
    const cp = normalizeFrenchPostalCode(opts.findVilleCp(ville) || null)
    if (cp) return cp
  }

  return null
}

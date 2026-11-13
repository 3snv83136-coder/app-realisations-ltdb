/**
 * Résolution / affichage de l'adresse chantier sur facture & devis PDF.
 */

/** Construit une ligne d'adresse chantier complète (rue + CP ville). */
export function buildAdresseChantierLine(parts: {
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
}): string {
  const rue = (parts.adresse || "").trim()
  const cpVille = [parts.codePostal, parts.ville].filter(Boolean).join(" ").trim()
  return [rue, cpVille].filter(Boolean).join(", ")
}

/**
 * Résout la valeur à afficher sur le PDF.
 * - "idem" / vide → repli sur l'adresse de facturation (lignes client)
 * - sinon l'adresse chantier telle quelle
 */
export function resolveAdresseChantierAffichee(
  adresseChantier: string | null | undefined,
  adresseFacturationLignes: string[],
): string {
  const raw = (adresseChantier || "").trim()
  if (!raw || raw.toLowerCase() === "idem") {
    return adresseFacturationLignes.map((l) => l.trim()).filter(Boolean).join(", ")
  }
  return raw
}

/** Deux adresses désignent le même lieu (accents, casse et ponctuation ignorés). */
export function adressesEquivalent(a: string, b: string): boolean {
  const n = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "")
  const na = n(a)
  const nb = n(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

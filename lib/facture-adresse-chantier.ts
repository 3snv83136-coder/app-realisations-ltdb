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

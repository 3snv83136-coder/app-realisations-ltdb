/**
 * Identité légale LTDB — source KBIS (NAJI MONDOR, RCS Toulon 484 791 546).
 * SIRET confirmé via API recherche-entreprises (établissement siège).
 */

export const LTDB_SIREN = "484791546"

/** Établissement principal — 700 Av. du 15ème Corps, 83200 Toulon */
export const LTDB_SIRET = "48479154600050"

export const LTDB_RCS = "RCS Toulon 484 791 546"

/** Calcul standard FR + clé + SIREN — à confirmer sur l'attestation TVA si besoin */
export const LTDB_TVA_INTRACOM = "FR09484791546"

export const LTDB_FORME_JURIDIQUE = "Entrepreneur individuel"

export const LTDB_BANK = {
  iban: "FR76 1695 8000 0152 7256 3725 930",
  bic: "QNTOFRP1XXX",
} as const

/** Mentions obligatoires facture B2B (pénalités, indemnité 40 €). */
export const FACTURE_MENTIONS_LEGALES = [
  "Entrepreneur individuel — exploitation directe.",
  "En cas de retard de paiement, application d'une pénalité au taux de 3 fois le taux d'intérêt légal en vigueur.",
  "Indemnité forfaitaire pour frais de recouvrement due au créancier en cas de retard de paiement : 40 € (art. L.441-10 et D.441-5 du code de commerce).",
  "Pas d'escompte accordé en cas de paiement anticipé.",
].join(" ")

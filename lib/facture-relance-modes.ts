/** Modes de relance paiement facture — fichier sans deps Node (OK client + serveur). */

export const JOURS_RELANCE_FACTURE = [10, 15, 20] as const
export const JOURS_RELANCE_FACTURE_45 = [45] as const
export const NB_RELANCES_FACTURE = JOURS_RELANCE_FACTURE.length

/** @deprecated Utiliser JOURS_RELANCE_FACTURE */
export const SEMAINES_RELANCE_FACTURE = NB_RELANCES_FACTURE

/** Choix à l'envoi : aucune / classique J+10/15/20 / une seule à J+45. */
export type FactureRelanceMode = 'aucune' | 'classique' | 'j45'

export const FACTURE_RELANCE_MODE_OPTIONS: {
  value: FactureRelanceMode
  label: string
  sub: string
}[] = [
  { value: 'classique', label: 'Classique', sub: 'Relances J+10, J+15 et J+20' },
  { value: 'j45', label: 'J+45', sub: 'Une seule relance 45 jours après l’envoi' },
  { value: 'aucune', label: 'Aucune', sub: 'Pas de relance automatique' },
]

export function normalizeFactureRelanceMode(raw: unknown): FactureRelanceMode {
  if (raw === 'aucune' || raw === 'none' || raw === false) return 'aucune'
  if (raw === 'j45' || raw === '45') return 'j45'
  if (raw === 'classique' || raw === 'classic' || raw === true) return 'classique'
  return 'classique'
}

export function joursForFactureRelanceMode(mode: FactureRelanceMode): number[] {
  if (mode === 'aucune') return []
  if (mode === 'j45') return [...JOURS_RELANCE_FACTURE_45]
  return [...JOURS_RELANCE_FACTURE]
}

export function isFactureReglee(echeance?: string | null): boolean {
  return /^r[ée]gl[ée]e?$/i.test((echeance || "").trim())
}

/** Facture sans relance paiement : statut payé en base OU échéance « réglée ». */
export function isFacturePayeeOuReglee(statut?: string | null, echeance?: string | null): boolean {
  return statut === "paye" || isFactureReglee(echeance)
}

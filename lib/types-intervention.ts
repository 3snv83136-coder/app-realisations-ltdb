/**
 * Types d'intervention LTDB — source unique de vérité.
 * Utilisé par /planning (modal de création), les passerelles rapport/devis → facture
 * pour produire un libellé court et standardisé sur les factures.
 */
export const TYPES_INTERVENTION = [
  'Débouchage canalisation',
  'Débouchage WC',
  'Débouchage évier',
  'Débouchage douche',
  'Hydrocurage',
  'Inspection caméra',
  'Recherche de fuite par caméra',
  'Pompe de relevage',
  'Dépannage pompe de relevage',
  'Vidange fosse septique',
  'Curage canalisation',
  'Attestation de conformité tout-à-l\'égout',
  'Attestation de conformité fosse septique',
  'Devis',
] as const

export type TypeIntervention = typeof TYPES_INTERVENTION[number]

/** Intervention créée pour établir un devis (pas de mode terrain). */
export function isDevisIntervention(type: string | null | undefined): boolean {
  return type === 'Devis'
}

/**
 * Détecte un type d'intervention dans un texte libre (objet d'un rapport / devis).
 * Recherche par mots-clés. Renvoie le type matché, sinon null.
 *
 * Utilisé pour rapport → facture / devis → facture : on essaie d'inférer un libellé
 * court et standardisé (ex. "Débouchage canalisation") même si le rapport / devis
 * contient une phrase complète.
 */
export function detectTypeIntervention(text: string | null | undefined): TypeIntervention | null {
  if (!text) return null
  const t = text.toLowerCase()

  if (/\bdevis\b|estimation|chiffrage/.test(t)) return 'Devis'
  if (/attestation.*conformit[ée].*tout.?[àa].?l.?[ée]gout|tout.?[àa].?l.?[ée]gout.*attestation|conformit[ée].*tout.?[àa].?l.?[ée]gout/.test(t)) {
    return "Attestation de conformité tout-à-l'égout"
  }
  if (/attestation.*conformit[ée].*fosse|fosse.*septique.*attestation|conformit[ée].*fosse/.test(t)) {
    return 'Attestation de conformité fosse septique'
  }
  if (/recherche.*fuite|fuite.*cam[ée]ra|d[ée]tection.*fuite/.test(t)) return 'Recherche de fuite par caméra'
  if (/inspection.*cam[ée]ra|cam[ée]ra.*inspection|cam[ée]ra/.test(t)) return 'Inspection caméra'
  if (/d[ée]pannage.*pompe.*relevage|pompe.*relevage.*d[ée]pannage/.test(t)) return 'Dépannage pompe de relevage'
  if (/pompe.*relevage|relevage/.test(t)) return 'Pompe de relevage'
  if (/hydrocurage|hydro.curage|curage.haute.pression/.test(t)) return 'Hydrocurage'
  if (/vidange.*fosse|fosse.*septique/.test(t)) return 'Vidange fosse septique'
  if (/curage/.test(t)) return 'Curage canalisation'
  if (/d[ée]bouchage.*wc|wc.*bouch/.test(t)) return 'Débouchage WC'
  if (/d[ée]bouchage.*[ée]vier|[ée]vier.*bouch/.test(t)) return 'Débouchage évier'
  if (/d[ée]bouchage.*douche|douche.*bouch/.test(t)) return 'Débouchage douche'
  if (/d[ée]bouchage|bouchon|d[ée]boucher/.test(t)) return 'Débouchage canalisation'

  return null
}

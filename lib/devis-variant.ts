/** Variante de génération / rendu PDF d'un devis LTDB. */
export type DevisVariant = 'classique' | 'travaux-assainissement'

export const DEVIS_VARIANT_LABELS: Record<DevisVariant, string> = {
  classique: 'Débouchage & curage',
  'travaux-assainissement': 'Travaux assainissement',
}

/** Sections types pour structurer un devis travaux (guide IA). */
export const DEVIS_TRAVAUX_SECTIONS = [
  '1. Préparation de chantier & sécurité',
  '2. Terrassement & fouilles',
  '3. Réseaux EU / EP & regards',
  '4. Pompe de relevage & équipements',
  '5. Remise en état & finitions',
  '6. Prestations complémentaires',
] as const

/**
 * Mentions légales et réglementaires pré-remplies pour les devis travaux
 * (assainissement, terrassement, regards, pompes de relevage).
 * L'IA peut les compléter avec les réserves propres au chantier dicté.
 */
export const DEVIS_TRAVAUX_MENTIONS_LEGALES = [
  'Le présent devis est établi conformément aux règles de l\'art applicables aux travaux d\'assainissement et d\'évacuation des eaux usées et pluviales (EU/EP), notamment les DTU pertinents (terrassements, canalisations enterrées, assainissement non collectif) et la réglementation en vigueur sur le territoire de la commune d\'intervention.',
  'Avant tout terrassement ou fouille, le client s\'engage à fournir les plans de réseaux existants et à déclencher, si nécessaire, les démarches DT-DICT / déclaration de travaux auprès des exploitants de réseaux (eau, électricité, gaz, télécoms). LTDB ne saurait être tenue responsable des dommages sur réseaux non repérés ou non signalés par le donneur d\'ordre.',
  'Les travaux de mise en conformité d\'un assainissement non collectif relèvent des obligations SPANC (Service Public d\'Assainissement Non Collectif) : le client reste responsable de la déclaration et du contrôle périodique de son installation, conformément à la réglementation départementale.',
  'Pour les ouvrages enterrés (canalisations, regards, chambres de visite, cuves, drains, raccordements), la garantie décennale s\'applique dans les conditions des articles 1792 et suivants du Code civil, sous réserve du respect des prescriptions techniques et des conditions d\'utilisation normales de l\'installation.',
  'Les pompes de relevage, armoires de commande, flotteurs et accessoires sont fournis et posés selon les recommandations du fabricant et les règles de sécurité électrique (NF C 15-100 pour les circuits dédiés). Une mise en service et un essai de fonctionnement sont réalisés à l\'issue des travaux ; l\'entretien périodique reste à la charge du client.',
  'L\'évacuation des terres, gravats et déchets de chantier (y compris boues de curage le cas échéant) est effectuée vers des filières agréées ; les frais de traitement et de transport sont inclus ou détaillés ligne à ligne selon le présent devis.',
  'Toute découverte imprévue en cours de chantier (réseau non conforme, regard enterré, contre-pente, présence d\'eau, dimensionnement insuffisant, renforcement structurel nécessaire) fera l\'objet d\'un avenant ou d\'un devis complémentaire avant poursuite des travaux.',
  'Le client garantit l\'accès au chantier (portail, parking engin, autorisations de voirie si occupation de domaine public) et la libre disposition des locaux techniques pour l\'installation des équipements.',
  'Assurance responsabilité civile professionnelle et garantie décennale LTDB en cours de validité — attestations sur demande.',
  'Indemnité forfaitaire de recouvrement en cas de retard de paiement : 40 € (art. L.441-10 du Code de commerce). Pas d\'escompte pour paiement anticipé.',
] as const

export function isDevisTravauxVariant(variant: DevisVariant | string | null | undefined): boolean {
  return variant === 'travaux-assainissement'
}

/**
 * Catalogue des prestations standard LTDB — source des prix proposés dans le
 * menu déroulant de la facturation (mode terrain). Prix HT unitaires.
 *
 * Modifier ici met à jour le menu déroulant partout où le catalogue est importé.
 */

export type PrestationCatalogue = {
  id: string
  designation: string
  pu_ht: number
  unite: string
  /** Description par défaut (facultative) injectée dans la ligne. */
  description?: string
}

export const CATALOGUE_PRESTATIONS: PrestationCatalogue[] = [
  { id: 'debouchage_pression', designation: 'Débouchage à pression', pu_ht: 199, unite: 'forfait' },
  { id: 'debouchage_manuel', designation: 'Débouchage manuel', pu_ht: 90, unite: 'forfait' },
  { id: 'debouchage_furet', designation: 'Débouchage au furet électrique', pu_ht: 119, unite: 'forfait' },
  { id: 'passage_camera', designation: 'Passage caméra', pu_ht: 110, unite: 'forfait' },
  { id: 'rapport_camera', designation: 'Fourniture d\u2019un rapport caméra', pu_ht: 90, unite: 'forfait' },
  { id: 'heure_supplementaire', designation: 'Heure supplémentaire', pu_ht: 95, unite: 'h' },
  { id: 'curage', designation: 'Curage', pu_ht: 25, unite: 'ml' },
]

export function findPrestation(id: string): PrestationCatalogue | undefined {
  return CATALOGUE_PRESTATIONS.find((p) => p.id === id)
}

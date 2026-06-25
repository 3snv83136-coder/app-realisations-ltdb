export type SalarieTypeContrat = 'CDI' | 'CDD'

export type SalarieDocumentType = 'permis' | 'mutuelle' | 'autre'

export type RhDocumentGenereType =
  | 'cdi'
  | 'cdd'
  | 'due'
  | 'fin_contrat'
  | 'rupture_conventionnelle'

export type Salarie = {
  id: string
  nom: string
  prenom: string
  adresse: string | null
  code_postal: string | null
  ville: string | null
  email: string | null
  telephone: string | null
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  numero_secu: string | null
  poste: string | null
  qualification: string | null
  coefficient: number | null
  salaire_brut_mensuel: number | null
  temps_travail: string | null
  date_embauche: string | null
  date_fin_contrat: string | null
  type_contrat: string | null
  motif_cdd: string | null
  periode_essai_mois: number | null
  mutuelle: string | null
  permis_numero: string | null
  permis_delivrance: string | null
  permis_categories: string | null
  notes: string | null
  actif: boolean
  created_at: string
  updated_at: string
}

export type SalarieDocument = {
  id: string
  salarie_id: string
  type: string
  url: string
  filename: string | null
  created_at: string
}

export const RH_DOCUMENT_LABELS: Record<RhDocumentGenereType, string> = {
  cdi: 'Contrat CDI',
  cdd: 'Contrat CDD',
  due: 'Déclaration unique d\'embauche (DUE)',
  fin_contrat: 'Attestation de fin de contrat',
  rupture_conventionnelle: 'Rupture conventionnelle',
}

export const RH_SCAN_TYPES: { value: SalarieDocumentType; label: string }[] = [
  { value: 'permis', label: 'Permis de conduire' },
  { value: 'mutuelle', label: 'Carte mutuelle' },
  { value: 'autre', label: 'Autre document' },
]

export function salarieNomComplet(s: Pick<Salarie, 'prenom' | 'nom'>): string {
  return [s.prenom, s.nom].filter(Boolean).join(' ').trim()
}

export function salarieAdresseComplete(s: Pick<Salarie, 'adresse' | 'code_postal' | 'ville'>): string {
  return [s.adresse, [s.code_postal, s.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

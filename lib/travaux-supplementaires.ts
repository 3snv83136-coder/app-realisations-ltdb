/** Prestations proposées au technicien pour les travaux supplémentaires avec accord. */
export const PRESTATIONS_TRAVAUX_SUPP = [
  { id: 'curage', label: 'Curage de canalisation' },
  { id: 'camera', label: 'Passage caméra' },
  { id: 'tampon', label: "Pose d'un tampon hermétique" },
  { id: 'depose_wc', label: "Dépose d'un toilette" },
  { id: 'trappe', label: "Ouverture d'une trappe investigation" },
  { id: 'fosse', label: 'Fosse septique' },
] as const

export type PrestationTravauxSuppId = typeof PRESTATIONS_TRAVAUX_SUPP[number]['id']

export type LigneTravauxSupp = {
  label: string
  prix_ht: number
  quantite: number
  unite: string
  prestation_id?: string | null
}

export type TravauxSupplementairesRecord = {
  id: string
  created_at: string
  signed_at: string
  client_nom: string
  client_email?: string | null
  client_telephone?: string | null
  lignes: LigneTravauxSupp[]
  prestation_manuelle?: string | null
  photo_url?: string | null
  signature_url?: string | null
  total_ht: number
  taux_tva: number
  total_ttc: number
  mail_envoye_at?: string | null
  sms_envoye_at?: string | null
}

export function calculTotauxTravauxSupp(lignes: LigneTravauxSupp[], tauxTva = 10) {
  const total_ht = lignes.reduce((s, l) => s + (Number(l.quantite) || 1) * (Number(l.prix_ht) || 0), 0)
  const total_tva = total_ht * (tauxTva / 100)
  const total_ttc = total_ht + total_tva
  return { total_ht, total_tva, total_ttc }
}

export function getTravauxSupplementaires(rapportJson: unknown): TravauxSupplementairesRecord[] {
  if (!rapportJson || typeof rapportJson !== 'object') return []
  const arr = (rapportJson as { travaux_supplementaires?: unknown }).travaux_supplementaires
  return Array.isArray(arr) ? (arr as TravauxSupplementairesRecord[]) : []
}

/** Garantie d'intervention saisie en mode terrain (stockée dans rapport_json). */
export type GarantieIntervention = {
  est_garanti: boolean
  commentaire?: string
  saisi_at?: string
}

export function getGarantieIntervention(rapportJson: unknown): GarantieIntervention | null {
  if (!rapportJson || typeof rapportJson !== 'object') return null
  const g = (rapportJson as Record<string, unknown>).garantie_intervention
  if (!g || typeof g !== 'object') return null
  const row = g as Record<string, unknown>
  if (typeof row.est_garanti !== 'boolean') return null
  return {
    est_garanti: row.est_garanti,
    commentaire: typeof row.commentaire === 'string' ? row.commentaire.trim() : undefined,
    saisi_at: typeof row.saisi_at === 'string' ? row.saisi_at : undefined,
  }
}

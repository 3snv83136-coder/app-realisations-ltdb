/**
 * Catalogue des prestations LTDB.
 * Source de vérité : table Supabase `tarifs` (via GET /api/tarifs).
 * Le fallback ci-dessous sert hors-ligne / avant chargement.
 */

export type PrestationCatalogue = {
  id: string
  designation: string
  pu_ht: number
  unite: string
  /** Description par défaut (facultative) injectée dans la ligne. */
  description?: string
}

/** Fallback historique (mode terrain) si l'API est indisponible. */
export const CATALOGUE_PRESTATIONS: PrestationCatalogue[] = [
  { id: 'debouchage_pression', designation: 'Débouchage à pression', pu_ht: 199, unite: 'forfait' },
  { id: 'debouchage_manuel', designation: 'Débouchage manuel', pu_ht: 90, unite: 'forfait' },
  { id: 'debouchage_furet', designation: 'Débouchage au furet électrique', pu_ht: 119, unite: 'forfait' },
  { id: 'passage_camera', designation: 'Passage caméra', pu_ht: 110, unite: 'forfait' },
  { id: 'rapport_camera', designation: 'Fourniture d\u2019un rapport caméra', pu_ht: 90, unite: 'forfait' },
  { id: 'heure_supplementaire', designation: 'Heure supplémentaire', pu_ht: 95, unite: 'h' },
  { id: 'curage', designation: 'Curage', pu_ht: 25, unite: 'ml' },
]

export function findPrestation(id: string, list: PrestationCatalogue[] = CATALOGUE_PRESTATIONS): PrestationCatalogue | undefined {
  return list.find((p) => p.id === id)
}

/** Charge le catalogue partagé depuis l'API (tarifs actifs). */
export async function fetchCataloguePrestations(): Promise<PrestationCatalogue[]> {
  try {
    const res = await fetch('/api/tarifs', { cache: 'no-store' })
    const j = await res.json()
    if (!res.ok) return CATALOGUE_PRESTATIONS
    const articles = Array.isArray(j.articles) ? j.articles : []
    if (articles.length === 0) return CATALOGUE_PRESTATIONS
    return articles.map((a: { id: string; designation: string; pu_ht: number; unite: string }) => ({
      id: a.id,
      designation: a.designation,
      pu_ht: Number(a.pu_ht) || 0,
      unite: a.unite || 'forfait',
    }))
  } catch {
    return CATALOGUE_PRESTATIONS
  }
}

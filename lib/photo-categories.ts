/** Catégories sémantiques des photos terrain pour publication E-E-A-T. */
export const PHOTO_CATEGORIES = ['avant', 'pendant', 'apres', 'camera', 'dechets', 'autre'] as const
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  avant: 'Avant intervention',
  pendant: 'Pendant l\'intervention',
  apres: 'Après intervention',
  camera: 'Écran caméra / défaut constaté',
  dechets: 'Déchets extraits',
  autre: 'Autre',
}

export const PHOTO_CATEGORY_ICONS: Record<PhotoCategory, string> = {
  avant: '📷',
  pendant: '🔧',
  apres: '✅',
  camera: '📹',
  dechets: '🪣',
  autre: '🖼',
}

export function isPhotoCategory(v: string): v is PhotoCategory {
  return (PHOTO_CATEGORIES as readonly string[]).includes(v)
}

/** Infère la catégorie depuis la légende ou la position (legacy). */
export function inferCategoryFromLegende(legende: string, index: number): PhotoCategory {
  const leg = (legende || '').toLowerCase()
  if (leg.includes('avant')) return 'avant'
  if (leg.includes('après') || leg.includes('apres')) return 'apres'
  if (leg.includes('caméra') || leg.includes('camera') || leg.includes('écran')) return 'camera'
  if (leg.includes('déchets') || leg.includes('dechets') || leg.includes('racines') || leg.includes('tartre') || leg.includes('extrait')) return 'dechets'
  if (leg.includes('pendant') || leg.includes('travaux')) return 'pendant'
  if (index === 0) return 'avant'
  if (index === 1) return 'apres'
  return 'autre'
}

export function resolvePhotoCategory(
  categories: (string | null | undefined)[] | null | undefined,
  legendes: (string | null | undefined)[] | null | undefined,
  index: number,
): PhotoCategory {
  const raw = categories?.[index]
  if (raw && isPhotoCategory(raw)) return raw
  return inferCategoryFromLegende(legendes?.[index] || '', index)
}

/** Ordre d'affichage sur la page publiée. */
export const PHOTO_CATEGORY_ORDER: PhotoCategory[] = ['avant', 'pendant', 'apres', 'camera', 'dechets', 'autre']

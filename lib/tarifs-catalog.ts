import type { Tarif } from "@/lib/supabase"

export type PrestationCatalogItem = {
  id: string
  type: string
  designation: string
  pu_ht: number
  unite: string
  /** Article seed / standard (non créé manuellement via CUSTOM_). */
  standard: boolean
  actif: boolean
  prix_min: number
  prix_max: number
}

/** Slug stable pour `tarifs.type` à partir d'un libellé. */
export function slugifyTarifType(label: string): string {
  const base = (label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
  return base || "ARTICLE"
}

export function tarifToCatalogItem(t: Tarif): PrestationCatalogItem {
  const prix = Number(t.prix_min)
  return {
    id: t.id,
    type: t.type,
    designation: t.label,
    pu_ht: Number.isFinite(prix) ? prix : 0,
    unite: t.unite || "forfait",
    standard: !isCustomTarifType(t.type),
    actif: t.actif,
    prix_min: Number(t.prix_min) || 0,
    prix_max: Number(t.prix_max) || 0,
  }
}

/** Les customs créés via l'UI ont un type CUSTOM_… */
export function isCustomTarifType(type: string): boolean {
  return type.startsWith("CUSTOM_")
}

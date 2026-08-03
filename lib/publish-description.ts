import type { RapportData, SeoData } from "@/lib/types-documents"
import { finalizeMetaDescription } from "@/lib/publish-seo-text"

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Meta description Django — jamais vide, fermée, avec CTA court. */
export function buildPublishDescription(opts: {
  seo: SeoData
  rapport?: Partial<RapportData> | null
  typeIntervention?: string | null
  ville: string
}): string {
  const { seo, rapport, typeIntervention, ville } = opts
  const candidates: unknown[] = [
    seo.meta_description,
    seo.resume_rich_snippet,
    rapport?.objet,
    rapport?.diagnostic,
    typeIntervention && ville
      ? `${typeIntervention} à ${ville} — diagnostic et intervention Les Techniciens du Débouchage.`
      : null,
    ville ? `Intervention d'assainissement à ${ville}.` : null,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return finalizeMetaDescription(stripHtml(c.trim()), ville)
    }
  }
  return finalizeMetaDescription("", ville)
}

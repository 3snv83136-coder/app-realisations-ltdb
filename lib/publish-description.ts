function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Meta description Django — jamais vide (requis côté LTDB). */
export function buildPublishDescription(opts: {
  seo: Record<string, unknown>
  rapport?: Record<string, unknown> | null
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
      ? `${typeIntervention} à ${ville} — réalisation Les Techniciens du Débouchage.`
      : null,
    ville ? `Intervention d'assainissement à ${ville} — Les Techniciens du Débouchage.` : null,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return stripHtml(c.trim())
  }
  return "Intervention d'assainissement — Les Techniciens du Débouchage, Var."
}

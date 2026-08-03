const BRAND = "Les Techniciens du Débouchage"
const BRAND_RE = new RegExp(
  `\\s*[|–\\-]\\s*${BRAND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`,
  "gi",
)

/** Retire le suffixe marque pour éviter le double `| LTDB | LTDB` côté Django. */
export function stripBrandSuffix(s: string): string {
  let out = (s || "").trim()
  // Répète si le suffixe est dupliqué
  for (let i = 0; i < 3; i++) {
    const next = out.replace(BRAND_RE, " ").replace(/\s+/g, " ").trim()
    if (next === out) break
    out = next
  }
  // Cas où le titre EST uniquement la marque
  if (out.toLowerCase() === BRAND.toLowerCase()) return out
  return out
}

/**
 * Tronque proprement pour Django / SERP.
 * - Coupe au mot (jamais au milieu)
 * - Par défaut sans "..." (H1 / title ne doivent pas finir par des points de suspension)
 * - `ellipsis: true` uniquement pour meta description si vraiment nécessaire
 */
export function truncatePublishField(
  s: string,
  max: number,
  opts?: { ellipsis?: boolean },
): string {
  const t = stripBrandSuffix((s || "").replace(/\s+/g, " ").trim())
  if (!t) return ""
  if (t.length <= max) return t

  const window = t.slice(0, max)
  const lastSpace = window.lastIndexOf(" ")
  let base = (lastSpace >= Math.floor(max * 0.55) ? window.slice(0, lastSpace) : window).trimEnd()
  // Évite un titre qui finit par ":", "—", ","
  base = base.replace(/[:，,;|—–\-]\s*$/, "").trimEnd()
  // Retire une ellipsis déjà présente en fin de chaîne IA
  base = base.replace(/\.{2,}$|…$/, "").trimEnd()

  if (!base) return t.slice(0, max).trimEnd()
  if (opts?.ellipsis && base.length < t.length) {
    const withEllipsis = `${base}…`
    return withEllipsis.length <= max ? withEllipsis : base.slice(0, Math.max(0, max - 1)).trimEnd()
  }
  return base
}

const META_CTA = " Devis gratuit, intervention rapide dans le Var."

/** Assure une meta description fermée + CTA court (≤ 160 car. SERP). */
export function finalizeMetaDescription(raw: string, ville?: string): string {
  let d = stripBrandSuffix((raw || "").replace(/\s+/g, " ").trim())
  d = d.replace(/\.{2,}$|…$/, "").trimEnd()
  if (!d) {
    const v = (ville || "").trim()
    d = v
      ? `Intervention d'assainissement à ${v}. Diagnostic vidéo et devis gratuit, intervention rapide dans le Var.`
      : `Intervention d'assainissement dans le Var. Diagnostic + devis gratuit, intervention rapide.`
  }

  const hasCta = /devis|appelez|contact|gratuit|intervention rapide/i.test(d)
  if (!hasCta) {
    const room = 160 - d.length
    if (room >= META_CTA.length) d = `${d.replace(/[.!?]$/, "")}.${META_CTA}`
    else if (room > 20) {
      const shortCta = " Devis gratuit dans le Var."
      if (160 - d.length >= shortCta.length) d = `${d.replace(/[.!?]$/, "")}.${shortCta}`
    }
  }

  return truncatePublishField(d, 160, { ellipsis: false })
}

/** Meta title SERP : ≤ 60 car. recommandés, sans marque (Django l'ajoute). */
export function finalizeMetaTitle(raw: string): string {
  const t = stripBrandSuffix(raw)
  return truncatePublishField(t, 60, { ellipsis: false })
}

/** H1 visible : phrase fermée, sans ellipsis, limite Django ~95. */
export function finalizeTitreH1(raw: string): string {
  let t = stripBrandSuffix(raw)
  t = t.replace(/\.{2,}$|…$/, "").trimEnd()
  return truncatePublishField(t, 95, { ellipsis: false })
}

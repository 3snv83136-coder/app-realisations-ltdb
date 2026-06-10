import { buildPublishDescription } from "@/lib/publish-description"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function paragraph(s: unknown): string {
  if (typeof s !== "string" || !s.trim()) return ""
  return `<p>${escapeHtml(s.trim())}</p>`
}

function section(title: string, body: string): string {
  if (!body.trim()) return ""
  return `<section class="content-block"><h2>${escapeHtml(title)}</h2>${body}</section>`
}

/** Reconstruit le HTML article quand seo.contenu_principal est vide (mode terrain). */
export function buildContenuPrincipalFromRapport(rapport: Record<string, unknown>): string {
  const parts: string[] = []

  const objet =
    typeof rapport.objet === "string" && rapport.objet.trim()
      ? `<p><strong>${escapeHtml(rapport.objet.trim())}</strong></p>`
      : ""
  const contexte = paragraph(rapport.contexte)
  if (objet || contexte) {
    parts.push(section("Contexte de l'intervention", `${objet}${contexte}`))
  }

  const loc = rapport.localisation
  if (loc && typeof loc === "object") {
    const l = loc as Record<string, unknown>
    const zone = paragraph(l.zone)
    const conf = paragraph(l.configuration)
    if (zone || conf) parts.push(section("Localisation et configuration", `${zone}${conf}`))
  }

  const diag = paragraph(rapport.diagnostic)
  if (diag) parts.push(section("Diagnostic technique", diag))

  let travaux = paragraph(rapport.travaux_realises)
  const phases = Array.isArray(rapport.phases) ? rapport.phases : []
  for (const ph of phases) {
    if (!ph || typeof ph !== "object") continue
    const p = ph as Record<string, unknown>
    const titre = typeof p.titre === "string" ? p.titre.trim() : ""
    const ctx = paragraph(p.contexte)
    const action = paragraph(p.action)
    const resultat = paragraph(p.resultat)
    if (titre || ctx || action || resultat) {
      travaux += `<h3>${escapeHtml(titre || "Étape")}</h3>${ctx}${action}${resultat}`
    }
  }
  const materiel = Array.isArray(rapport.materiel_utilise)
    ? rapport.materiel_utilise.filter((m): m is string => typeof m === "string" && !!m.trim())
    : []
  if (materiel.length > 0) {
    travaux += `<div class="checklist-box"><strong>Matériel utilisé :</strong><ul>${materiel.map((m) => `<li>${escapeHtml(m.trim())}</li>`).join("")}</ul></div>`
  }
  if (travaux.trim()) parts.push(section("Travaux réalisés", travaux))

  const reco = paragraph(rapport.recommandations)
  if (reco) parts.push(section("Recommandations", reco))

  return parts.join("")
}

type PhotoMeta = { legende: string; alt?: string }

export function buildPublishContentHtml(opts: {
  seo: Record<string, unknown>
  rapport?: Record<string, unknown> | null
  typeIntervention?: string | null
  ville: string
  photos?: PhotoMeta[]
}): { content: string; seo: Record<string, unknown> } {
  const { rapport, typeIntervention, ville, photos = [] } = opts
  const seo = { ...opts.seo }

  let contenuPrincipal =
    typeof seo.contenu_principal === "string" ? seo.contenu_principal.trim() : ""
  if (!contenuPrincipal && rapport && typeof rapport === "object") {
    contenuPrincipal = buildContenuPrincipalFromRapport(rapport)
  }
  seo.contenu_principal = contenuPrincipal

  let resumeSnippet =
    typeof seo.resume_rich_snippet === "string" ? seo.resume_rich_snippet.trim() : ""
  if (!resumeSnippet) {
    resumeSnippet = buildPublishDescription({
      seo,
      rapport,
      typeIntervention,
      ville,
    })
  }
  seo.resume_rich_snippet = resumeSnippet

  const resumeHtml = resumeSnippet
    ? `<section class="content-block resume-block"><h2>Résumé de l'intervention</h2><p>${escapeHtml(resumeSnippet)}</p></section>`
    : ""

  const galleryHtml =
    photos.length > 0
      ? `<section class="content-block gallery-block"><h2>Photos de l'intervention</h2><p>Ces photos documentent les étapes clés sur site (avant, pendant, après).</p><div class="photo-grid">${photos
          .map((p, i) => {
            const legendePropre = /^photo \d+$/i.test(p.legende) ? "" : p.legende
            const alt =
              p.alt ||
              `${typeIntervention || "Intervention"} à ${ville}${legendePropre ? ` — ${legendePropre}` : ""}`
            return `<figure class="photo-card"><img src="{PHOTO_${i + 1}_URL}" alt="${escapeHtml(alt)}" loading="lazy"><figcaption>${escapeHtml(p.legende)}</figcaption></figure>`
          })
          .join("")}</div></section>`
      : ""

  const faq = Array.isArray(seo.faq) ? seo.faq : []
  const faqHtml =
    faq.length > 0
      ? `<section class="content-block faq-block"><h2>Questions fréquentes</h2>${faq
          .map((f) => {
            if (!f || typeof f !== "object") return ""
            const item = f as { question?: string; reponse?: string }
            return `<details class="faq-item"><summary>${escapeHtml(item.question || "")}</summary><div class="faq-answer"><p>${escapeHtml(item.reponse || "")}</p></div></details>`
          })
          .join("")}</section>`
      : ""

  const content = `${resumeHtml}${contenuPrincipal}${galleryHtml}${faqHtml}`
  return { content, seo }
}

import { buildPublishDescription } from "@/lib/publish-description"
import {
  PHOTO_CATEGORY_LABELS,
  PHOTO_CATEGORY_ORDER,
  type PhotoCategory,
  resolvePhotoCategory,
} from "@/lib/photo-categories"
import { REALISATION_PAGE_STYLE } from "@/lib/realisationPageCss"

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

function section(title: string, body: string, extraClass = ""): string {
  if (!body.trim()) return ""
  const cls = extraClass ? `content-block ${extraClass}` : "content-block"
  return `<section class="${cls}"><h2>${escapeHtml(title)}</h2>${body}</section>`
}

export type ResumeIntervention = {
  lieu?: string
  probleme?: string
  cause?: string
  solution?: string
  duree?: string
  resultat?: string
}

export type TechnicienPublishInfo = {
  nom: string
  photoUrl?: string | null
  anneesExperience?: number | null
  titreMetier?: string | null
}

type PhotoMeta = {
  legende: string
  alt?: string
  categorie?: PhotoCategory
  /** Index dans le tableau photos trié pour placeholder {PHOTO_N_URL} */
  photoIndex: number
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

function normalizeResumeIntervention(raw: unknown): ResumeIntervention | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const resume: ResumeIntervention = {}
  for (const k of ["lieu", "probleme", "cause", "solution", "duree", "resultat"] as const) {
    if (typeof r[k] === "string" && r[k].trim()) resume[k] = r[k].trim()
  }
  return Object.keys(resume).length > 0 ? resume : null
}

/** Fallback structuré depuis le rapport si l'IA n'a pas généré resume_intervention. */
export function buildResumeFromRapport(
  rapport: Record<string, unknown> | null | undefined,
  ville: string,
  codePostal?: string | null,
): ResumeIntervention | null {
  if (!rapport) return null
  const lieu = codePostal ? `${ville} (${codePostal})` : ville
  const resume: ResumeIntervention = { lieu }

  if (typeof rapport.objet === "string" && rapport.objet.trim()) {
    resume.probleme = rapport.objet.trim()
  } else if (typeof rapport.diagnostic === "string" && rapport.diagnostic.trim()) {
    resume.probleme = rapport.diagnostic.trim().slice(0, 160)
  }

  if (typeof rapport.diagnostic === "string" && rapport.diagnostic.trim()) {
    resume.cause = rapport.diagnostic.trim().slice(0, 200)
  }

  const materiel = Array.isArray(rapport.materiel_utilise)
    ? rapport.materiel_utilise.filter((m): m is string => typeof m === "string" && !!m.trim())
    : []
  if (typeof rapport.travaux_realises === "string" && rapport.travaux_realises.trim()) {
    resume.solution = rapport.travaux_realises.trim().slice(0, 200)
  } else if (materiel.length > 0) {
    resume.solution = materiel.join(" + ")
  }

  if (typeof rapport.duree_intervention === "string" && rapport.duree_intervention.trim()) {
    resume.duree = rapport.duree_intervention.trim()
  }

  if (typeof rapport.travaux_realises === "string") {
    const t = rapport.travaux_realises.toLowerCase()
    if (/rétabli|rétablissement|fonctionnel|écoulement|débouch/i.test(t)) {
      resume.resultat = "Écoulement rétabli"
    }
  }

  const filled = Object.values(resume).filter(Boolean)
  return filled.length >= 2 ? resume : null
}

function buildResumeIaHtml(resume: ResumeIntervention): string {
  const rows: string[] = []
  if (resume.lieu) rows.push(`<li><strong>📍 Lieu :</strong> ${escapeHtml(resume.lieu)}</li>`)
  if (resume.probleme) rows.push(`<li><strong>Problème :</strong> ${escapeHtml(resume.probleme)}</li>`)
  if (resume.cause) rows.push(`<li><strong>Cause :</strong> ${escapeHtml(resume.cause)}</li>`)
  if (resume.solution) rows.push(`<li><strong>Solution :</strong> ${escapeHtml(resume.solution)}</li>`)
  if (resume.duree) rows.push(`<li><strong>Durée :</strong> ${escapeHtml(resume.duree)}</li>`)
  if (resume.resultat) rows.push(`<li><strong>Résultat :</strong> ${escapeHtml(resume.resultat)}</li>`)
  if (rows.length === 0) return ""

  return `<section class="content-block ai-summary-block" itemscope itemtype="https://schema.org/Article">
  <h2>Résumé intervention</h2>
  <ul class="ai-summary-list">${rows.join("")}</ul>
</section>`
}

function buildTechnicienBlockHtml(
  technicien: TechnicienPublishInfo,
  rapport: Record<string, unknown> | null | undefined,
  ville: string,
): string {
  const nom = technicien.nom.trim()
  if (!nom) return ""

  const titre = technicien.titreMetier?.trim() || "technicien déboucheur"
  const annees = technicien.anneesExperience
  const expPhrase = annees && annees > 0
    ? `${titre} dans le Var depuis ${annees} année${annees > 1 ? "s" : ""}`
    : `${titre} sur ${ville} et le Var`

  const materiel = Array.isArray(rapport?.materiel_utilise)
    ? (rapport!.materiel_utilise as unknown[]).filter((m): m is string => typeof m === "string" && !!m.trim())
    : []
  const materielHtml = materiel.length > 0
    ? `<p class="technicien-materiel"><strong>Matériel utilisé :</strong> ${escapeHtml(materiel.join(" + "))}.</p>`
    : ""

  const photoHtml = technicien.photoUrl?.trim()
    ? `<img src="${escapeHtml(technicien.photoUrl.trim())}" alt="${escapeHtml(`${nom}, ${titre}`)}" class="technicien-photo" loading="lazy" width="120" height="120">`
    : `<div class="technicien-photo technicien-photo-placeholder" aria-hidden="true">${escapeHtml(nom.charAt(0).toUpperCase())}</div>`

  return `<section class="content-block technicien-block" itemscope itemtype="https://schema.org/Person">
  <div class="technicien-card">
    ${photoHtml}
    <div class="technicien-info">
      <h2 itemprop="name">Intervention réalisée par ${escapeHtml(nom)}</h2>
      <p class="technicien-role" itemprop="jobTitle">${escapeHtml(expPhrase)}.</p>
      ${materielHtml}
    </div>
  </div>
</section>`
}

function buildExpertiseLocaleHtml(expertise: string): string {
  if (!expertise.trim()) return ""
  return `<section class="content-block expertise-block">
  <h2>Notre retour terrain</h2>
  <div class="info-box"><p>${escapeHtml(expertise.trim())}</p></div>
</section>`
}

function buildGalleryByCategory(
  photos: PhotoMeta[],
  typeIntervention?: string | null,
  ville?: string,
): string {
  if (photos.length === 0) return ""

  const byCat = new Map<PhotoCategory, PhotoMeta[]>()
  for (const p of photos) {
    const cat = p.categorie || "autre"
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(p)
  }

  const sections: string[] = []
  for (const cat of PHOTO_CATEGORY_ORDER) {
    const items = byCat.get(cat)
    if (!items?.length) continue
    const label = PHOTO_CATEGORY_LABELS[cat]
    const cards = items
      .map((p) => {
        const legendePropre = /^photo \d+$/i.test(p.legende) ? label : p.legende
        const alt =
          p.alt ||
          `${typeIntervention || "Intervention"} à ${ville || ""}${legendePropre ? ` — ${legendePropre}` : ""}`
        return `<figure class="photo-card"><img src="{PHOTO_${p.photoIndex + 1}_URL}" alt="${escapeHtml(alt)}" loading="lazy"><figcaption>${escapeHtml(legendePropre)}</figcaption></figure>`
      })
      .join("")
    sections.push(`<div class="photo-category-section"><h3>${escapeHtml(label)}</h3><div class="photo-grid">${cards}</div></div>`)
  }

  if (sections.length === 0) return ""

  return `<section class="content-block gallery-block">
  <h2>Photos de l'intervention</h2>
  <p>Preuves visuelles du chantier : état initial, travaux, résultat et constats techniques.</p>
  ${sections.join("")}
</section>`
}

export function buildPublishContentHtml(opts: {
  seo: Record<string, unknown>
  rapport?: Record<string, unknown> | null
  typeIntervention?: string | null
  ville: string
  codePostal?: string | null
  photos?: Omit<PhotoMeta, "photoIndex">[]
  technicien?: TechnicienPublishInfo | null
}): { content: string; seo: Record<string, unknown> } {
  const { rapport, typeIntervention, ville, codePostal, technicien } = opts
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

  // Résumé structuré « réponse IA »
  let resumeIntervention = normalizeResumeIntervention(seo.resume_intervention)
  if (!resumeIntervention) {
    resumeIntervention = buildResumeFromRapport(rapport, ville, codePostal)
  }
  if (resumeIntervention) {
    seo.resume_intervention = resumeIntervention
  }

  const resumeIaHtml = resumeIntervention ? buildResumeIaHtml(resumeIntervention) : ""

  const technicienHtml =
    technicien?.nom?.trim()
      ? buildTechnicienBlockHtml(technicien, rapport, ville)
      : ""

  const expertiseLocale =
    typeof seo.expertise_locale === "string" ? seo.expertise_locale.trim() : ""
  const expertiseHtml = buildExpertiseLocaleHtml(expertiseLocale)

  const photosWithIndex: PhotoMeta[] = (opts.photos || []).map((p, i) => ({
    ...p,
    photoIndex: i,
  }))
  const galleryHtml = buildGalleryByCategory(photosWithIndex, typeIntervention, ville)

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

  const body = `${resumeIaHtml}${technicienHtml}${contenuPrincipal}${galleryHtml}${expertiseHtml}${faqHtml}`
  const content = `${REALISATION_PAGE_STYLE}${body}`
  return { content, seo }
}

/** Prépare les métadonnées photos avec catégories pour publication. */
export function buildPhotoMetaFromIntervention(
  photosUrls: string[],
  photosLegendes: (string | null | undefined)[],
  photosCategories: (string | null | undefined)[] | null | undefined,
): { legende: string; categorie: PhotoCategory }[] {
  return photosUrls.map((_, i) => ({
    legende: photosLegendes[i]?.trim() || `Photo ${i + 1}`,
    categorie: resolvePhotoCategory(photosCategories, photosLegendes, i),
  }))
}

/** Trie les photos pour Django : avant, après, puis le reste par catégorie. */
export function sortPhotosForPublish<T extends { categorie: PhotoCategory }>(photos: T[]): T[] {
  const order = (cat: PhotoCategory) => PHOTO_CATEGORY_ORDER.indexOf(cat)
  return [...photos].sort((a, b) => order(a.categorie) - order(b.categorie))
}

import { buildPublishJsonLd } from "@/lib/publish-jsonld"
import {
  buildCityPageUrl,
  buildMetaTitleFallback,
  normalizeSeoOutput,
} from "@/lib/seo-normalize"

export function prepareSeoForPublish(opts: {
  seo: Record<string, unknown>
  typeIntervention: string
  ville: string
  codePostal?: string | null
  transcription?: string | null
  interventionDate: string
  publishSlug: string
  technicienNom?: string | null
  technicienTitre?: string | null
  photos?: { url: string; legende?: string; alt?: string }[]
}): Record<string, unknown> {
  let seo = normalizeSeoOutput({ ...opts.seo }, {
    typeIntervention: opts.typeIntervention,
    ville: opts.ville,
    codePostal: opts.codePostal,
    transcription: opts.transcription || "",
  })

  const resume =
    seo.resume_intervention && typeof seo.resume_intervention === "object"
      ? (seo.resume_intervention as Record<string, string>)
      : null

  const metaTitle =
    typeof seo.meta_title === "string" && seo.meta_title.trim()
      ? seo.meta_title.trim()
      : buildMetaTitleFallback(opts.typeIntervention, opts.ville, resume)

  const titreH1 =
    typeof seo.titre_h1 === "string" && seo.titre_h1.trim()
      ? seo.titre_h1.trim()
      : metaTitle

  const metaDescription =
    typeof seo.meta_description === "string" && seo.meta_description.trim()
      ? seo.meta_description.trim()
      : typeof seo.resume_rich_snippet === "string"
        ? seo.resume_rich_snippet.trim()
        : ""

  const resumeSnippet =
    typeof seo.resume_rich_snippet === "string" && seo.resume_rich_snippet.trim()
      ? seo.resume_rich_snippet.trim()
      : metaDescription

  const faq = Array.isArray(seo.faq)
    ? seo.faq
        .filter((f): f is { question: string; reponse: string } =>
          !!f && typeof f === "object"
          && typeof (f as { question?: string }).question === "string"
          && typeof (f as { reponse?: string }).reponse === "string",
        )
        .map((f) => ({ question: f.question, reponse: f.reponse }))
    : []

  const pageUrl = `https://lestechniciensdudebouchage.fr/nos-realisations/${opts.publishSlug}`

  seo.meta_title = metaTitle
  seo.titre_h1 = titreH1
  seo.meta_description = metaDescription
  seo.resume_rich_snippet = resumeSnippet
  seo.slug = opts.publishSlug
  seo.page_url = pageUrl
  seo.city_page_url = buildCityPageUrl(opts.ville, opts.codePostal)
  seo.jsonld = buildPublishJsonLd({
    metaTitle,
    titreH1,
    metaDescription,
    resumeSnippet,
    pageUrl,
    pageSlug: opts.publishSlug,
    ville: opts.ville,
    codePostal: opts.codePostal,
    typeIntervention: opts.typeIntervention,
    interventionDate: opts.interventionDate,
    technicienNom: opts.technicienNom,
    technicienTitre: opts.technicienTitre,
    faq,
    photos: opts.photos,
  })

  return seo
}

/** Tronque pour les CharField Django. */
export function truncatePublishField(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 3).trimEnd() + "..."
}

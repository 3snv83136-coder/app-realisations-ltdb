import { buildPublishJsonLd } from "@/lib/publish-jsonld"
import {
  buildCityPageUrl,
  buildMetaTitleFallback,
  normalizeSeoOutput,
} from "@/lib/seo-normalize"
import {
  finalizeMetaDescription,
  finalizeMetaTitle,
  finalizeTitreH1,
  truncatePublishField,
} from "@/lib/publish-seo-text"
import { formatTechnicienNom } from "@/lib/technicien-nom"
import { dialogueQaToFaqPairs, normalizeDialogueQa } from "@/lib/generer-dialogue-qa"
import type { SeoData } from "@/lib/types-documents"

export { truncatePublishField } from "@/lib/publish-seo-text"

export function prepareSeoForPublish(opts: {
  seo: SeoData
  typeIntervention: string
  ville: string
  codePostal?: string | null
  transcription?: string | null
  interventionDate: string
  publishSlug: string
  technicienNom?: string | null
  technicienTitre?: string | null
  technicienPhotoUrl?: string | null
  photos?: { url: string; legende?: string; alt?: string }[]
}): SeoData {
  let seo = normalizeSeoOutput({ ...opts.seo }, {
    typeIntervention: opts.typeIntervention,
    ville: opts.ville,
    codePostal: opts.codePostal,
    transcription: opts.transcription || "",
  })

  const resume =
    seo.resume_intervention && typeof seo.resume_intervention === "object"
      ? seo.resume_intervention
      : null

  const metaTitleRaw =
    typeof seo.meta_title === "string" && seo.meta_title.trim()
      ? seo.meta_title.trim()
      : buildMetaTitleFallback(opts.typeIntervention, opts.ville, resume)

  const titreH1Raw =
    typeof seo.titre_h1 === "string" && seo.titre_h1.trim()
      ? seo.titre_h1.trim()
      : metaTitleRaw

  const metaDescriptionRaw =
    typeof seo.meta_description === "string" && seo.meta_description.trim()
      ? seo.meta_description.trim()
      : typeof seo.resume_rich_snippet === "string"
        ? seo.resume_rich_snippet.trim()
        : ""

  const metaTitle = finalizeMetaTitle(metaTitleRaw)
  const titreH1 = finalizeTitreH1(titreH1Raw)
  const metaDescription = finalizeMetaDescription(metaDescriptionRaw, opts.ville)

  const resumeSnippet =
    typeof seo.resume_rich_snippet === "string" && seo.resume_rich_snippet.trim()
      ? truncatePublishField(seo.resume_rich_snippet.trim(), 320, { ellipsis: false })
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

  const dialogue = normalizeDialogueQa(seo.dialogue_qa)
  if (dialogue) seo.dialogue_qa = dialogue
  const dialogueFaq = dialogue ? dialogueQaToFaqPairs(dialogue) : []
  const faqMerged = [...faq]
  const seenQ = new Set(faq.map((f) => f.question.trim().toLowerCase()))
  for (const p of dialogueFaq) {
    const key = p.question.trim().toLowerCase()
    if (!key || seenQ.has(key)) continue
    seenQ.add(key)
    faqMerged.push(p)
  }
  seo.faq = faqMerged

  const pageUrl = `https://lestechniciensdudebouchage.fr/nos-realisations/${opts.publishSlug}`
  const technicienNom = formatTechnicienNom(opts.technicienNom)

  seo.meta_title = metaTitle
  seo.titre_h1 = titreH1
  seo.meta_description = metaDescription
  seo.resume_rich_snippet = resumeSnippet
  seo.slug = opts.publishSlug
  seo.page_url = pageUrl
  seo.city_page_url = buildCityPageUrl(opts.ville, opts.codePostal)
  if (technicienNom) {
    seo.technicien = {
      nom: technicienNom,
      titre_metier: opts.technicienTitre || null,
      photo_url: opts.technicienPhotoUrl || null,
    }
  }
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
    technicienNom: technicienNom || null,
    technicienTitre: opts.technicienTitre,
    technicienPhotoUrl: opts.technicienPhotoUrl,
    faq: faqMerged,
    photos: opts.photos,
  })

  return seo
}

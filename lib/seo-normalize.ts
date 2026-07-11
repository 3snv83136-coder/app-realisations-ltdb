import type { ResumeIntervention } from "@/lib/publish-content"

const SITE = "https://lestechniciensdudebouchage.fr"

export function slugifyVille(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function buildCityPageUrl(ville: string, codePostal?: string | null): string {
  const cp = codePostal || "83000"
  return `${SITE}/${slugifyVille(ville)}-${cp}`
}

/** Titre `<title>` SERP — distinct du H1, orienté requête locale. */
export function buildMetaTitleFallback(
  typeIntervention: string,
  ville: string,
  resume?: ResumeIntervention | null,
): string {
  const typeNorm = typeIntervention.trim()
  const typeShort = typeNorm.replace(/^débouchage\s+(de\s+)?/i, "").trim() || "canalisation"
  const blob = `${resume?.cause || ""} ${resume?.probleme || ""}`.toLowerCase()

  let angle = ""
  if (/racine|radicell|végétal|arbre|pin|chêne/i.test(blob)) {
    angle = " – Collecteur bouché par des racines"
  } else if (resume?.probleme) {
    const snippet = resume.probleme.replace(/\.$/, "").slice(0, 45)
    angle = snippet ? ` : ${snippet}` : ""
  }

  const title = `Débouchage ${typeShort} ${ville}${angle}`
  if (title.length <= 70) return title
  return title.slice(0, 67).trimEnd() + "…"
}

/** Caméra annoncée comme future (pas encore passée sur le chantier). */
function cameraPending(text: string): boolean {
  const pending =
    /pr[ée]vu|programm[ée]|dans les jours qui suivent|sera programm|pr[ée]parer le terrain pour|à programmer|sans attendre que le bouchon/i.test(
      text,
    )
  const done =
    /cam[ée]ra (a )?(confirm|montr|rep[ée]r|pass[ée])|inspection (vid[ée]o )?(a )?(confirm|r[ée]alis|effectu)|racines confirm[ée]es par (la )?cam/i.test(
      text,
    )
  return pending && !done
}

function softenExpertiseLocale(text: string, ville: string): string {
  if (!/beaucoup de propriétés|souvent bordées de|beaucoup de maisons/i.test(text)) {
    return text
  }
  return `Lors de nos interventions à ${ville}, nous rencontrons régulièrement des canalisations enterrées à proximité de jardins arborés — un profil à risque pour les intrusions racinaires.`
}

function alignResumeWithCameraStatus(
  resume: Record<string, string>,
  pending: boolean,
): Record<string, string> {
  if (!pending) return resume

  const next = { ...resume }
  if (/confirm/i.test(next.cause || "")) {
    next.cause = (next.cause || "").replace(/confirm[ée]es?/gi, "suspectées")
  }
  if (/confirm/i.test(next.resultat || "")) {
    next.resultat =
      "Écoulement rétabli entre les regards, inspection caméra prévue pour confirmer la cause"
  }
  if (/confirm/i.test(next.solution || "") && /inspection|caméra/i.test(next.solution || "")) {
    next.solution = "Débouchage mécanique du collecteur, passage caméra à programmer"
  }
  return next
}

function alignHtmlCameraHeadings(html: string, pending: boolean): string {
  if (!pending || !html) return html
  return html
    .replace(
      /(<h3[^>]*>\s*)Étape 2\s*[—–-]\s*La confirmation par caméra/gi,
      "$1Étape 2 — Préparation de l'inspection caméra",
    )
    .replace(/racines confirm[ée]es/gi, "forte suspicion de racines")
}

export function normalizeSeoOutput(
  seo: Record<string, unknown>,
  opts: {
    typeIntervention: string
    ville: string
    codePostal?: string | null
    transcription?: string
  },
): Record<string, unknown> {
  const resume =
    seo.resume_intervention && typeof seo.resume_intervention === "object"
      ? (seo.resume_intervention as Record<string, string>)
      : null

  const metaTitleRaw =
    typeof seo.meta_title === "string" && seo.meta_title.trim()
      ? seo.meta_title.trim()
      : buildMetaTitleFallback(opts.typeIntervention, opts.ville, resume)
  seo.meta_title = metaTitleRaw.length <= 70 ? metaTitleRaw : metaTitleRaw.slice(0, 67).trimEnd() + "…"

  const corpus = [
    opts.transcription || "",
    typeof seo.contenu_principal === "string" ? seo.contenu_principal : "",
    typeof seo.resume_rich_snippet === "string" ? seo.resume_rich_snippet : "",
    typeof seo.meta_description === "string" ? seo.meta_description : "",
    resume ? JSON.stringify(resume) : "",
  ].join(" ")

  const camPending = cameraPending(corpus)

  if (resume) {
    seo.resume_intervention = alignResumeWithCameraStatus(resume, camPending)
  }

  if (typeof seo.contenu_principal === "string" && seo.contenu_principal) {
    seo.contenu_principal = alignHtmlCameraHeadings(seo.contenu_principal, camPending)
  }

  if (typeof seo.resume_rich_snippet === "string" && camPending) {
    seo.resume_rich_snippet = seo.resume_rich_snippet.replace(
      /racines confirm[ée]es/gi,
      "forte suspicion de racines",
    )
  }

  if (typeof seo.meta_description === "string" && camPending) {
    seo.meta_description = seo.meta_description
      .replace(/racines confirm[ée]es/gi, "forte suspicion de racines")
      .replace(/confirm[ée]es? par (la )?cam[ée]ra/gi, "inspection caméra prévue")
  }

  if (typeof seo.expertise_locale === "string" && seo.expertise_locale.trim()) {
    seo.expertise_locale = softenExpertiseLocale(seo.expertise_locale.trim(), opts.ville)
  }

  return seo
}

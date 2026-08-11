/**
 * Republie une intervention vers le site (contenu HTML à jour, ex. dialogue Q&A).
 * Usage: npx tsx scripts/republish-intervention.ts [intervention-id]
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { buildPublishContentHtml, sortPhotosForPublish } from "../lib/publish-content"
import { prepareSeoForPublish } from "../lib/publish-seo-prepare"
import { buildPublishDescription } from "../lib/publish-description"
import {
  finalizeMetaDescription,
  finalizeMetaTitle,
  finalizeTitreH1,
} from "../lib/publish-seo-text"
import { buildCityPageUrl } from "../lib/seo-normalize"
import { publishImageUrlForSite } from "../lib/publish-image-url"
import { resolvePhotoCategory } from "../lib/photo-categories"
import {
  buildPhotoFilename,
  buildPhotoLegende,
  buildPhotoNomBase,
  roleFromCategory,
} from "../lib/photo-seo-name"
import { formatTechnicienNom } from "../lib/technicien-nom"
import { normalizeFrenchPostalCode, resolvePostalCodeForPublish } from "../lib/postal-code"
import { findVilleByName } from "../lib/villes-var"
import type { SeoData } from "../lib/types-documents"

function loadEnv(name: string) {
  const p = path.resolve(process.cwd(), name)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
  }
}
loadEnv(".env.local")
loadEnv(".env.vercel")

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch photo ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return new Blob([buf], { type: res.headers.get("content-type") || "image/jpeg" })
}

async function main() {
  const ltdbUrl = process.env.LTDB_API_URL
  const token = process.env.LTDB_PUBLISH_TOKEN
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!ltdbUrl || !token) throw new Error("LTDB_API_URL / LTDB_PUBLISH_TOKEN manquants")
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase non configuré")

  const sb = createClient(supabaseUrl, serviceKey)
  const interventionId = process.argv[2]?.trim() || "2f27f6b7-4146-4697-984e-c26d5a7798d1"

  const { data: interv, error } = await sb
    .from("interventions")
    .select("*")
    .eq("id", interventionId)
    .maybeSingle()
  if (error || !interv) throw new Error(error?.message || "Intervention introuvable")

  let clientNom = ""
  let clientEmail = ""
  let clientAdresse: string | null = null
  let clientVille: string | null = null
  let clientCp: string | null = null
  if (interv.client_id) {
    const { data: c } = await sb
      .from("clients")
      .select("nom, email, adresse, ville, code_postal")
      .eq("id", interv.client_id)
      .maybeSingle()
    clientNom = c?.nom || ""
    clientEmail = c?.email || ""
    clientAdresse = c?.adresse || null
    clientVille = c?.ville || null
    clientCp = c?.code_postal || null
  }

  let technicienNom = ""
  let technicienPhotoUrl: string | null = null
  let technicienAnnees: number | null = null
  let technicienTitre: string | null = null
  if (interv.technicien_id) {
    const { data: t } = await sb
      .from("techniciens")
      .select("nom, photo_url, annees_experience, titre_metier")
      .eq("id", interv.technicien_id)
      .maybeSingle()
    technicienNom = formatTechnicienNom(t?.nom || "") || ""
    technicienPhotoUrl = t?.photo_url || null
    technicienAnnees = t?.annees_experience ?? null
    technicienTitre = t?.titre_metier || null
  }

  const villeRaw = (interv.ville as string) || clientVille || ""
  const ville = villeRaw.trim() || "Var"
  const codePostal = resolvePostalCodeForPublish({
    interventionCp: normalizeFrenchPostalCode(interv.code_postal as string | null),
    clientCp: normalizeFrenchPostalCode(clientCp),
    villeLookup: findVilleByName(ville)?.cp || null,
  }) || ""
  const dateIntervention = String(interv.date_realisee || interv.date_prevue || "").slice(0, 10)
  const adresse = ((interv.adresse_chantier as string) || clientAdresse || "").trim()
  const publishSlug =
    (interv.publie_slug as string) ||
    ((interv.seo_json as SeoData)?.slug as string) ||
    `intervention-${interventionId.slice(0, 8)}`

  const photosUrls: string[] = Array.isArray(interv.photos_urls) ? interv.photos_urls : []
  const legendes: string[] = Array.isArray(interv.photos_legendes) ? interv.photos_legendes : []
  const categories = Array.isArray(interv.photos_categories) ? interv.photos_categories : []
  const nomBase = buildPhotoNomBase({
    typeIntervention: interv.type_intervention as string,
    ville,
  })

  const photosMeta = sortPhotosForPublish(
    photosUrls.map((url, i) => {
      const categorie = resolvePhotoCategory(categories, legendes, i)
      const role = roleFromCategory(categorie)
      const legende = buildPhotoLegende({
        typeIntervention: interv.type_intervention as string,
        ville,
        role,
        custom: legendes[i],
      })
      return {
        url,
        legende,
        categorie,
        filename: buildPhotoFilename({ nomBase, role, index: i, date: dateIntervention }),
      }
    }),
  )

  const validPhotos = []
  for (const p of photosMeta) {
    try {
      const blob = await fetchBlob(p.url)
      validPhotos.push({ ...p, blob })
    } catch (e) {
      console.warn("photo skip", p.url, e)
    }
  }
  if (!validPhotos.length) throw new Error("Aucune photo récupérable")

  const seoData = { ...((interv.seo_json || {}) as SeoData) }
  const seoPrepared = prepareSeoForPublish({
    seo: seoData,
    typeIntervention: (interv.type_intervention as string) || "Intervention",
    ville,
    codePostal,
    transcription: (interv.transcription as string) || "",
    interventionDate: dateIntervention,
    publishSlug,
    technicienNom: technicienNom || null,
    technicienTitre,
    technicienPhotoUrl: publishImageUrlForSite(technicienPhotoUrl),
    photos: validPhotos.map((p) => ({
      url: p.url,
      legende: p.legende,
      alt: `${interv.type_intervention || "Intervention"} à ${ville} — ${p.legende}`,
    })),
  })

  const { content: contentWithContainers, seo: seoForPublish } = buildPublishContentHtml({
    seo: seoPrepared,
    rapport: interv.rapport_json as Record<string, unknown> | null,
    typeIntervention: interv.type_intervention as string,
    ville,
    codePostal,
    cityPageUrl: buildCityPageUrl(ville, codePostal),
    interventionDate: dateIntervention,
    photos: validPhotos.map((p) => ({ legende: p.legende, categorie: p.categorie, url: p.url })),
    technicien: technicienNom
      ? {
          nom: technicienNom,
          photoUrl: publishImageUrlForSite(technicienPhotoUrl),
          anneesExperience: technicienAnnees,
          titreMetier: technicienTitre,
        }
      : null,
  })

  // Sanity : bulles en <p class="ltdb-dlg…">
  if (!contentWithContainers.includes("ltdb-dlg-client")) {
    throw new Error("HTML dialogue sans classes ltdb-dlg — abort")
  }

  const rawTitle =
    (typeof seoForPublish.titre_h1 === "string" && seoForPublish.titre_h1)
    || `${interv.type_intervention || "Intervention"} à ${ville}`
  const rawMetaTitle =
    (typeof seoForPublish.meta_title === "string" && seoForPublish.meta_title)
    || rawTitle
  const rawDesc = buildPublishDescription({
    seo: seoForPublish,
    rapport: interv.rapport_json as Record<string, unknown> | null,
    typeIntervention: interv.type_intervention as string,
    ville,
  })

  const fd = new FormData()
  fd.append("title", finalizeTitreH1(rawTitle))
  fd.append("meta_title", finalizeMetaTitle(rawMetaTitle))
  fd.append("titre_h1", finalizeTitreH1(rawTitle))
  fd.append("slug", publishSlug)
  fd.append("service_type", (interv.type_intervention as string) || "")
  fd.append("location", ville)
  fd.append("intervention_city", ville)
  fd.append("postal_code", codePostal)
  fd.append("intervention_date", dateIntervention)
  fd.append("description", finalizeMetaDescription(rawDesc, ville))
  fd.append(
    "meta_keywords",
    Array.isArray(seoForPublish.meta_keywords) ? seoForPublish.meta_keywords.join(", ") : "",
  )
  fd.append("content", contentWithContainers)
  fd.append(
    "faq_json",
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: (Array.isArray(seoForPublish.faq) ? seoForPublish.faq : []).map(
        (f: { question?: string; reponse?: string }) => ({
          "@type": "Question",
          name: f?.question || "",
          acceptedAnswer: { "@type": "Answer", text: f?.reponse || "" },
        }),
      ),
    }),
  )
  fd.append("jsonld", JSON.stringify(seoForPublish.jsonld || {}))
  fd.append("related_services_json", JSON.stringify(seoForPublish.related_services || []))
  fd.append("is_published", "true")
  fd.append("transcription", (interv.transcription as string) || "")
  fd.append("rapport_json", JSON.stringify(interv.rapport_json))
  fd.append("seo_json", JSON.stringify(seoForPublish))
  fd.append("client_nom", clientNom)
  fd.append("client_email", clientEmail)
  fd.append("client_adresse", `${adresse} ${codePostal} ${ville}`.trim())
  fd.append("intervention_id", interventionId)
  fd.append("technicien_name", technicienNom)

  const toFile = (b: { blob: Blob; filename: string }) =>
    new File([b.blob], b.filename, { type: b.blob.type || "image/jpeg" })
  const beforePhoto = validPhotos.find((p) => p.categorie === "avant") || validPhotos[0]
  const afterPhoto = validPhotos.find((p) => p.categorie === "apres") || validPhotos[1] || validPhotos[0]
  const extraPhotos = validPhotos.filter((p) => p !== beforePhoto && p !== afterPhoto)
  fd.append("before_image", toFile(beforePhoto))
  fd.append("after_image", toFile(afterPhoto))
  extraPhotos.forEach((p, i) => fd.append(`extra_image_${i}`, toFile(p)))
  fd.append("photos_nom_base", nomBase)
  fd.append(
    "photos_json",
    JSON.stringify([
      {
        field: "before_image",
        ordre: 0,
        filename: beforePhoto.filename,
        legende: beforePhoto.legende,
        categorie: beforePhoto.categorie,
      },
      {
        field: "after_image",
        ordre: 1,
        filename: afterPhoto.filename,
        legende: afterPhoto.legende,
        categorie: afterPhoto.categorie,
      },
      ...extraPhotos.map((p, i) => ({
        field: `extra_image_${i}`,
        ordre: i + 2,
        filename: p.filename,
        legende: p.legende,
        categorie: p.categorie,
      })),
    ]),
  )

  const djResp = await fetch(`${ltdbUrl}/api/gallery/publish/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const txt = await djResp.text()
  let data: unknown = null
  try {
    data = JSON.parse(txt)
  } catch {
    /* ignore */
  }
  if (!djResp.ok) {
    console.error(txt.slice(0, 2000))
    throw new Error(`Publish HTTP ${djResp.status}`)
  }

  const slug =
    (data && typeof data === "object" && "slug" in data && String((data as { slug: string }).slug))
    || publishSlug

  await sb.from("interventions").update({ publie_slug: slug, seo_json: seoForPublish }).eq("id", interventionId)

  console.log(JSON.stringify({
    ok: true,
    slug,
    url: `https://lestechniciensdudebouchage.fr/nos-realisations/${slug}`,
    dialogue_p_tags: (contentWithContainers.match(/ltdb-dlg-client/g) || []).length,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

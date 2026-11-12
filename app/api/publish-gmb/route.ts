import { NextRequest, NextResponse } from "next/server"
import { notifyGoogleIndexing } from "@/lib/google-indexing"
import { generateExplicationPage } from "@/lib/gmb-explication"
import { listGmbPosts, createGmbPost } from "@/lib/gmb"
import { generateGmbSummary } from "@/lib/gmb-summary"
import { publishExplicationPage } from "@/lib/publish-explication"
import { getSupabaseOrNull } from "@/lib/supabase"
import type { RapportData, SeoData } from "@/lib/types-documents"

export const dynamic = "force-dynamic"
export const maxDuration = 90

type GmbBody = {
  interventionId?: string
  /** Mode direct (rapport externe) — sans fiche intervention. */
  type?: string
  ville?: string
  codePostal?: string | null
  summary?: string
  photoUrl?: string | null
  slug?: string | null
  rapport?: Partial<RapportData> | null
}

function sameUrl(a: string, b: string): boolean {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "")
}

/**
 * POST /api/publish-gmb — un seul post Google par intervention.
 * « En savoir plus » ouvre la page d'explication, pas la réalisation.
 */
export async function POST(req: NextRequest) {
  let body: GmbBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = (body.interventionId || "").trim()
  let type = (body.type || "").trim()
  let ville = (body.ville || "").trim()
  let codePostal = (body.codePostal || "").trim()
  let photoUrl: string | null = (body.photoUrl || "").trim() || null
  let rapport = body.rapport
  let realisationSlug = (body.slug || "").trim()
  let pageKey = ""
  let seo: SeoData = {}

  if (interventionId) {
    const sb = getSupabaseOrNull()
    if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

    const { data: interv, error } = await sb
      .from("interventions")
      .select("type_intervention, ville, code_postal, seo_json, rapport_json, photos_urls, publie_slug")
      .eq("id", interventionId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

    seo = (interv.seo_json || {}) as SeoData
    type = type || interv.type_intervention || "Intervention"
    ville = ville || interv.ville || ""
    codePostal = codePostal || interv.code_postal || ""
    rapport = interv.rapport_json as Partial<RapportData> | null
    realisationSlug = realisationSlug || interv.publie_slug || ""
    const photos: string[] = Array.isArray(interv.photos_urls) ? interv.photos_urls : []
    photoUrl = photoUrl || photos[0] || null
    pageKey = interventionId
  } else {
    if (!type || !ville) {
      return NextResponse.json(
        { error: "interventionId ou (type + ville) requis" },
        { status: 400 },
      )
    }
    pageKey = realisationSlug ? `externe-${realisationSlug}` : ""
  }

  if (!ville) {
    return NextResponse.json({ error: "La ville de l'intervention est manquante" }, { status: 400 })
  }
  if (!pageKey) {
    return NextResponse.json({ error: "Impossible de rattacher la page à cette intervention" }, { status: 400 })
  }

  try {
    const page = await generateExplicationPage({
      type,
      ville,
      resume: seo.resume_rich_snippet || seo.meta_description || body.summary || "",
      rapport,
    })
    const published = await publishExplicationPage({
      interventionId: pageKey,
      type,
      ville,
      codePostal,
      realisationSlug,
      title: page.title,
      excerpt: page.excerpt,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      contentHtml: page.contentHtml,
    })

    const knownName = (seo.gmb_post_name || "").trim()
    let existingName = knownName
    if (!existingName) {
      try {
        const posts = await listGmbPosts()
        existingName = posts.find(item => item.ctaUrl && sameUrl(item.ctaUrl, published.url))?.name || ""
      } catch (e) {
        console.error("[publish-gmb] liste des posts", e)
      }
    }

    if (interventionId) {
      const sb = getSupabaseOrNull()
      if (sb) {
        await sb.from("interventions").update({
          seo_json: {
            ...seo,
            explication_url: published.url,
            explication_slug: published.slug,
            ...(existingName ? { gmb_post_name: existingName } : {}),
          },
        }).eq("id", interventionId)
      }
    }

    const googleIndexing = await notifyGoogleIndexing(published.url)

    if (existingName) {
      return NextResponse.json({
        ok: true,
        alreadyPublished: true,
        name: existingName,
        explicationUrl: published.url,
        googleIndexing,
      })
    }

    const summary = await generateGmbSummary({
      type,
      ville,
      resume: page.excerpt,
      rapport,
    })
    const result = await createGmbPost({ summary, photoUrl, ctaUrl: published.url })

    if (interventionId && result.name) {
      const sb = getSupabaseOrNull()
      if (sb) {
        await sb.from("interventions").update({
          seo_json: {
            ...seo,
            explication_url: published.url,
            explication_slug: published.slug,
            gmb_post_name: result.name,
          },
        }).eq("id", interventionId)
      }
    }

    return NextResponse.json({
      ok: true,
      ...result,
      explicationUrl: published.url,
      googleIndexing,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec publication GMB" },
      { status: 502 },
    )
  }
}

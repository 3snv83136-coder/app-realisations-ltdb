import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { createGmbPost } from "@/lib/gmb"

export const dynamic = "force-dynamic"
export const maxDuration = 30

const SITE = "https://lestechniciensdudebouchage.fr"

type GmbBody = {
  interventionId?: string
  /** Mode direct (rapport externe) — sans fiche intervention. */
  type?: string
  ville?: string
  summary?: string
  photoUrl?: string | null
  slug?: string | null
  ctaUrl?: string | null
}

/**
 * POST /api/publish-gmb — publie un post Google Business Profile.
 * Body : { interventionId } OU { type, ville, summary, photoUrl?, slug? }
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
  let resume = (body.summary || "").trim()
  let photoUrl: string | null = (body.photoUrl || "").trim() || null
  let ctaUrl = (body.ctaUrl || "").trim()

  if (interventionId) {
    const sb = getSupabaseOrNull()
    if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

    const { data: interv, error } = await sb
      .from("interventions")
      .select("type_intervention, ville, seo_json, photos_urls, publie_slug")
      .eq("id", interventionId)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

    const seo = (interv.seo_json || {}) as {
      resume_rich_snippet?: string
      meta_description?: string
    }
    type = type || interv.type_intervention || "Intervention"
    ville = ville || interv.ville || "Var"
    resume =
      resume
      || seo.resume_rich_snippet
      || seo.meta_description
      || `${type} réalisée à ${ville} par Les Techniciens du Débouchage.`
    const photos: string[] = Array.isArray(interv.photos_urls) ? interv.photos_urls : []
    photoUrl = photoUrl || photos[0] || null
    if (!ctaUrl) {
      ctaUrl = interv.publie_slug
        ? `${SITE}/nos-realisations/${interv.publie_slug}`
        : SITE
    }
  } else {
    if (!type || !ville) {
      return NextResponse.json(
        { error: "interventionId ou (type + ville) requis" },
        { status: 400 },
      )
    }
    if (!resume) {
      resume = `${type} réalisée à ${ville} par Les Techniciens du Débouchage.`
    }
    if (!ctaUrl) {
      const slug = (body.slug || "").trim()
      ctaUrl = slug ? `${SITE}/nos-realisations/${slug}` : SITE
    }
  }

  // Texte sobre : pas de téléphone / URL / promo (CTA porte le lien).
  const summary = [`${type} à ${ville}`, "", resume].join("\n")

  try {
    const result = await createGmbPost({ summary, photoUrl, ctaUrl })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Échec publication GMB" },
      { status: 502 },
    )
  }
}

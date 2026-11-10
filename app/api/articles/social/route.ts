import { NextRequest, NextResponse } from "next/server"
import { requireOwnerAdminApi } from "@/lib/require-owner-admin"
import { buildArticleSocialCaption } from "@/lib/article-social"
import { publishArticleToNetworks } from "@/lib/social"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/articles/social
 * Envoie UN brouillon sur Facebook, Instagram, LinkedIn et TikTok.
 * N'écrit rien sur lestechniciensdudebouchage.fr.
 */
export async function POST(req: NextRequest) {
  const access = await requireOwnerAdminApi()
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { title?: string; meta?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const title = (body.title || "").trim()
  const meta = (body.meta || "").trim()
  if (!title || !meta) {
    return NextResponse.json({ error: "Le titre et la méta-description sont obligatoires." }, { status: 400 })
  }

  try {
    const caption = await buildArticleSocialCaption({ title, meta })
    const results = await publishArticleToNetworks(caption)
    return NextResponse.json({ caption, results, sitePublished: false })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "Diffusion impossible" }, { status: 500 })
  }
}

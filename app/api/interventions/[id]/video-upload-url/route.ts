import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const VIDEOS_BUCKET = process.env.SUPABASE_VIDEOS_BUCKET || "intervention-videos"

const ALLOWED_EXT = new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv", "wmv", "flv", "3gp", "ogv"])

type Params = { params: { id: string } }

/**
 * Crée une URL d'upload signée pour envoyer la vidéo (compressée navigateur)
 * directement vers Supabase Storage — sans passer par le serveur Vercel, ce qui
 * contourne la limite de taille de requête des routes API.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { ext?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const ext = (body.ext || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "")
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Format vidéo non supporté (.${ext})` }, { status: 400 })
  }

  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80)
  const path = `uploads/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data, error } = await sb.storage.from(VIDEOS_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    return NextResponse.json(
      { error: `Création URL d'upload impossible : ${error?.message || "inconnue"}` },
      { status: 502 },
    )
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const VIDEOS_BUCKET = process.env.SUPABASE_VIDEOS_BUCKET || "intervention-videos"

type Params = { params: { id: string } }

/** Persiste l'URL publique d'une vidéo uploadée (après upload direct via signed URL). */
export async function POST(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { path?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const path = (body.path || "").trim()
  if (!path) return NextResponse.json({ error: "Chemin du fichier manquant" }, { status: 400 })

  const { data: pub } = sb.storage.from(VIDEOS_BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) return NextResponse.json({ error: "URL publique introuvable" }, { status: 500 })

  const { data: interv, error: readErr } = await sb
    .from("interventions")
    .select("video_uploads")
    .eq("id", interventionId)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const current: string[] = Array.isArray(interv.video_uploads) ? interv.video_uploads : []
  const next = [...current, url]

  const { error: updErr } = await sb
    .from("interventions")
    .update({ video_uploads: next })
    .eq("id", interventionId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, url, video_uploads: next })
}

/** Retire une vidéo uploadée (DB + storage best-effort). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const url = (body.url || "").trim()
  if (!url) return NextResponse.json({ error: "URL manquante" }, { status: 400 })

  const { data: interv, error: readErr } = await sb
    .from("interventions")
    .select("video_uploads")
    .eq("id", interventionId)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const current: string[] = Array.isArray(interv.video_uploads) ? interv.video_uploads : []
  const next = current.filter((u) => u !== url)

  const { error: updErr } = await sb
    .from("interventions")
    .update({ video_uploads: next })
    .eq("id", interventionId)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Suppression best-effort du fichier dans le bucket.
  const marker = `/${VIDEOS_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx !== -1) {
    const storagePath = url.slice(idx + marker.length)
    await sb.storage.from(VIDEOS_BUCKET).remove([storagePath]).catch(() => {})
  }

  return NextResponse.json({ ok: true, video_uploads: next })
}

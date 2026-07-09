import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/rh/require-admin"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PHOTOS_BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'

type Params = { params: { id: string } }

/** Upload photo portrait d'un technicien (admin). */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const technicienId = params.id?.trim()
  if (!technicienId) return NextResponse.json({ error: 'ID technicien manquant' }, { status: 400 })

  const { data: tech, error: techErr } = await sb
    .from('techniciens')
    .select('id, nom')
    .eq('id', technicienId)
    .maybeSingle()
  if (techErr) return NextResponse.json({ error: techErr.message }, { status: 500 })
  if (!tech) return NextResponse.json({ error: 'Technicien introuvable' }, { status: 404 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart/form-data attendu' }, { status: 400 })
  }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Photo manquante' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo trop lourde (max 5 MB)' }, { status: 413 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Fichier image attendu' }, { status: 400 })
  }

  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase()
  const path = `techniciens/${technicienId.replace(/[^a-zA-Z0-9_-]/g, '-')}/portrait-${Date.now()}${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const upload = await sb.storage
    .from(PHOTOS_BUCKET)
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true })
  if (upload.error) {
    return NextResponse.json({ error: `Upload échoué : ${upload.error.message}` }, { status: 502 })
  }

  const { data: pub } = sb.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
  const photoUrl = pub?.publicUrl
  if (!photoUrl) {
    return NextResponse.json({ error: 'URL publique introuvable' }, { status: 500 })
  }

  const { data: updated, error: upErr } = await sb
    .from('techniciens')
    .update({ photo_url: photoUrl })
    .eq('id', technicienId)
    .select('id, nom, photo_url, annees_experience, titre_metier')
    .single()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, technicien: updated, photo_url: photoUrl })
}

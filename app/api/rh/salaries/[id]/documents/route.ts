import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { requireAdminApi } from "@/lib/rh/require-admin"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const RH_BUCKET = process.env.SUPABASE_RH_BUCKET || process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'

const ALLOWED_TYPES = new Set(['permis', 'mutuelle', 'autre'])

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const { data: salarie } = await sb.from('salaries').select('id').eq('id', params.id).maybeSingle()
  if (!salarie) return NextResponse.json({ error: 'Salarié introuvable' }, { status: 404 })

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Multipart attendu' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop lourd (max 12 Mo)' }, { status: 413 })
  }

  const type = String(formData.get('type') || 'autre')
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 })
  }

  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '.jpg').toLowerCase()
  const path = `rh/${params.id}/${type}-${Date.now()}${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const upload = await sb.storage.from(RH_BUCKET).upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  })
  if (upload.error) {
    return NextResponse.json({ error: `Upload échoué : ${upload.error.message}` }, { status: 502 })
  }

  const { data: pub } = sb.storage.from(RH_BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) return NextResponse.json({ error: 'URL publique introuvable' }, { status: 500 })

  const { data, error } = await sb
    .from('salarie_documents')
    .insert({
      salarie_id: params.id,
      type,
      url,
      filename: file.name,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data })
}

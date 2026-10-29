import { NextRequest, NextResponse } from 'next/server'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'
import { getSupabaseOrNull } from '@/lib/supabase'
import {
  ADMIN_DOCS_BUCKET,
  clearAdminDocMeta,
  getAdminDoc,
  listAdminDocs,
  saveAdminDocMeta,
  type AdminDocKind,
} from '@/lib/admin-documents'
import { storagePathFromPublicUrl } from '@/lib/supabase-pdf-fetch'
import { errorMessage } from '@/lib/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const KINDS = new Set<AdminDocKind>(['kbis', 'rib'])
const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

function parseKind(raw: unknown): AdminDocKind | null {
  const k = String(raw || '').trim().toLowerCase()
  return KINDS.has(k as AdminDocKind) ? (k as AdminDocKind) : null
}

/** Liste Kbis / RIB disponibles. */
export async function GET() {
  const access = await requireOwnerAdminApi()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  try {
    const docs = await listAdminDocs()
    return NextResponse.json({
      ok: true,
      kbis: docs.kbis,
      rib: docs.rib,
    })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || 'Erreur' }, { status: 500 })
  }
}

/** Upload multipart : `kind` = kbis|rib, `file` = PDF/image. */
export async function POST(req: NextRequest) {
  const access = await requireOwnerAdminApi()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart attendu' }, { status: 400 })
  }

  const kind = parseKind(form.get('kind'))
  if (!kind) return NextResponse.json({ error: 'kind doit être kbis ou rib' }, { status: 400 })

  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichier trop lourd (max 12 Mo)' }, { status: 413 })
  }

  const mime = (file.type || '').toLowerCase()
  const extFromName = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '').toLowerCase()
  const okExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(extFromName)
  if (mime && !ALLOWED_MIME.has(mime) && !okExt) {
    return NextResponse.json({ error: 'Format accepté : PDF, JPG, PNG, WEBP' }, { status: 400 })
  }

  // Remplace l’ancien fichier s’il existe
  const previous = await getAdminDoc(kind)
  if (previous?.url) {
    const oldPath = storagePathFromPublicUrl(previous.url, ADMIN_DOCS_BUCKET)
    if (oldPath) {
      await sb.storage.from(ADMIN_DOCS_BUCKET).remove([oldPath]).catch(() => {})
    }
  }

  const ext = extFromName || (mime === 'application/pdf' ? '.pdf' : '.jpg')
  const path = `admin-docs/${kind}${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  const upload = await sb.storage.from(ADMIN_DOCS_BUCKET).upload(path, buf, {
    contentType: mime || (ext === '.pdf' ? 'application/pdf' : 'application/octet-stream'),
    upsert: true,
  })
  if (upload.error) {
    return NextResponse.json({ error: `Upload échoué : ${upload.error.message}` }, { status: 502 })
  }

  const { data: pub } = sb.storage.from(ADMIN_DOCS_BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) return NextResponse.json({ error: 'URL publique introuvable' }, { status: 500 })

  const safeName = file.name.replace(/[^\w.\-àâäéèêëïîôùûüç\s]/gi, '_').slice(0, 120)
    || (kind === 'kbis' ? 'Kbis-LTDB.pdf' : 'RIB-LTDB.pdf')

  const saved = await saveAdminDocMeta(kind, url, safeName)
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error || 'Métadonnées non enregistrées' }, { status: 500 })
  }

  const doc = await getAdminDoc(kind)
  return NextResponse.json({ ok: true, document: doc })
}

/** Suppression : body JSON `{ kind: 'kbis' | 'rib' }`. */
export async function DELETE(req: NextRequest) {
  const access = await requireOwnerAdminApi()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let body: { kind?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const kind = parseKind(body.kind)
  if (!kind) return NextResponse.json({ error: 'kind doit être kbis ou rib' }, { status: 400 })

  const sb = getSupabaseOrNull()
  const previous = await getAdminDoc(kind)
  if (previous?.url && sb) {
    const path = storagePathFromPublicUrl(previous.url, ADMIN_DOCS_BUCKET)
    if (path) await sb.storage.from(ADMIN_DOCS_BUCKET).remove([path]).catch(() => {})
  }

  const cleared = await clearAdminDocMeta(kind)
  if (!cleared.ok) {
    return NextResponse.json({ error: cleared.error || 'Suppression métadonnées échouée' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

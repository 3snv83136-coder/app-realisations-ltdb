/**
 * Documents administratifs LTDB (Kbis, RIB) — URLs stockées dans `parametres`,
 * fichiers dans Supabase Storage.
 */
import { getParametre, setParametre } from '@/lib/parametres'
import { getSupabaseOrNull } from '@/lib/supabase'
import { storagePathFromPublicUrl } from '@/lib/supabase-pdf-fetch'

export const ADMIN_DOCS_BUCKET =
  process.env.SUPABASE_ADMIN_DOCS_BUCKET ||
  process.env.SUPABASE_PDFS_BUCKET ||
  'intervention-pdfs'

export type AdminDocKind = 'kbis' | 'rib'

export type AdminDocMeta = {
  kind: AdminDocKind
  url: string
  filename: string
  uploadedAt?: string
}

const KEYS: Record<AdminDocKind, { url: string; filename: string; at: string; label: string }> = {
  kbis: {
    url: 'DOC_KBIS_URL',
    filename: 'DOC_KBIS_FILENAME',
    at: 'DOC_KBIS_UPLOADED_AT',
    label: 'Kbis',
  },
  rib: {
    url: 'DOC_RIB_URL',
    filename: 'DOC_RIB_FILENAME',
    at: 'DOC_RIB_UPLOADED_AT',
    label: 'RIB',
  },
}

export function adminDocLabel(kind: AdminDocKind): string {
  return KEYS[kind].label
}

export async function getAdminDoc(kind: AdminDocKind): Promise<AdminDocMeta | null> {
  const keys = KEYS[kind]
  const url = (await getParametre(keys.url, '')).trim()
  if (!url) return null
  const filename = (await getParametre(keys.filename, '')).trim() || defaultFilename(kind)
  const uploadedAt = (await getParametre(keys.at, '')).trim() || undefined
  return { kind, url, filename, uploadedAt }
}

export async function listAdminDocs(): Promise<{ kbis: AdminDocMeta | null; rib: AdminDocMeta | null }> {
  const [kbis, rib] = await Promise.all([getAdminDoc('kbis'), getAdminDoc('rib')])
  return { kbis, rib }
}

export async function saveAdminDocMeta(
  kind: AdminDocKind,
  url: string,
  filename: string,
): Promise<{ ok: boolean; error?: string }> {
  const keys = KEYS[kind]
  const r1 = await setParametre(keys.url, url, `URL document ${keys.label}`)
  if (!r1.ok) return r1
  const r2 = await setParametre(keys.filename, filename, `Nom fichier ${keys.label}`)
  if (!r2.ok) return r2
  return setParametre(keys.at, new Date().toISOString(), `Date upload ${keys.label}`)
}

export async function clearAdminDocMeta(kind: AdminDocKind): Promise<{ ok: boolean; error?: string }> {
  const keys = KEYS[kind]
  const r1 = await setParametre(keys.url, '', `URL document ${keys.label}`)
  if (!r1.ok) return r1
  const r2 = await setParametre(keys.filename, '', `Nom fichier ${keys.label}`)
  if (!r2.ok) return r2
  return setParametre(keys.at, '', `Date upload ${keys.label}`)
}

function defaultFilename(kind: AdminDocKind): string {
  return kind === 'kbis' ? 'Kbis-LTDB.pdf' : 'RIB-LTDB.pdf'
}

/** Télécharge un fichier Storage (ou URL publique) en base64 pour Resend. */
export async function fetchAdminDocAsAttachment(
  kind: AdminDocKind,
): Promise<{ filename: string; content: string } | null> {
  const meta = await getAdminDoc(kind)
  if (!meta?.url) return null

  const sb = getSupabaseOrNull()
  let buf: ArrayBuffer | null = null

  if (sb) {
    const path = storagePathFromPublicUrl(meta.url, ADMIN_DOCS_BUCKET)
    if (path) {
      try {
        const { data, error } = await sb.storage.from(ADMIN_DOCS_BUCKET).download(path)
        if (!error && data) buf = await data.arrayBuffer()
      } catch {
        /* fallback HTTP */
      }
    }
  }

  if (!buf) {
    try {
      const res = await fetch(meta.url, { cache: 'no-store' })
      if (!res.ok) return null
      buf = await res.arrayBuffer()
    } catch {
      return null
    }
  }

  if (!buf || buf.byteLength < 50) return null
  return {
    filename: meta.filename || defaultFilename(kind),
    content: Buffer.from(buf).toString('base64'),
  }
}

/** Pièces jointes optionnelles pour l’envoi facture. */
export async function buildFactureExtraAttachments(opts: {
  joindreKbis?: boolean
  joindreRib?: boolean
}): Promise<{ filename: string; content: string }[]> {
  const out: { filename: string; content: string }[] = []
  if (opts.joindreKbis) {
    const a = await fetchAdminDocAsAttachment('kbis')
    if (a) out.push(a)
  }
  if (opts.joindreRib) {
    const a = await fetchAdminDocAsAttachment('rib')
    if (a) out.push(a)
  }
  return out
}

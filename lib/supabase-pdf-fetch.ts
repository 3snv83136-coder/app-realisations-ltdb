import type { SupabaseClient } from "@supabase/supabase-js"

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || "intervention-pdfs"

export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0])
}

async function bufferToBase64(buf: ArrayBuffer): Promise<string> {
  return Buffer.from(buf).toString("base64")
}

/** Télécharge un PDF Supabase Storage (service role) puis fallback HTTP public. */
export async function fetchPdfAsBase64Robust(
  sb: SupabaseClient | null,
  url: string,
  bucket = PDFS_BUCKET,
): Promise<string | null> {
  if (!url) return null

  if (sb) {
    const path = storagePathFromPublicUrl(url, bucket)
    if (path) {
      try {
        const { data, error } = await sb.storage.from(bucket).download(path)
        if (!error && data) {
          return bufferToBase64(await data.arrayBuffer())
        }
      } catch {
        /* fallback HTTP */
      }
    }
  }

  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    return bufferToBase64(await res.arrayBuffer())
  } catch {
    return null
  }
}

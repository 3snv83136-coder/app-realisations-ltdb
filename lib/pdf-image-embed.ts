import fs from "node:fs"
import path from "node:path"
import { proxyImageUrlAbsolute } from "@/lib/proxyImageUrl"

const FETCH_TIMEOUT_MS = 12_000

function toDataUri(buf: Buffer, contentType: string): string {
  const ct = contentType.split(";")[0].trim() || "image/jpeg"
  return `data:${ct};base64,${buf.toString("base64")}`
}

/** Signature LTDB depuis /public — pas de requête HTTP sur Vercel. */
export function getLtdbSignatureDataUri(): string | null {
  try {
    const file = path.join(process.cwd(), "public", "signature-ltdb.png")
    if (!fs.existsSync(file)) return null
    return toDataUri(fs.readFileSync(file), "image/png")
  } catch {
    return null
  }
}

/**
 * Convertit une URL (ou data URI) en data URI pour @react-pdf/renderer côté serveur.
 * Retourne null si l'image est inaccessible (évite un PDF vide/corrompu).
 */
export async function embedImageForPdf(
  src: string | null | undefined,
  baseUrl?: string,
): Promise<string | null> {
  const raw = (src || "").trim()
  if (!raw) return null
  if (raw.startsWith("data:image/")) return raw

  const url = baseUrl && !raw.startsWith("data:")
    ? proxyImageUrlAbsolute(raw, baseUrl)
    : raw

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 32) return null
    const ct = res.headers.get("content-type") || "image/jpeg"
    if (!ct.startsWith("image/")) return null
    return toDataUri(buf, ct)
  } catch {
    return null
  }
}

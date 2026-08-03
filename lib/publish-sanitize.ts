/**
 * Empêche d'envoyer des data:image base64 à Django.
 * Sinon content + seo_json + fichiers photos dépassent souvent la limite
 * → HTTP 400 Bad Request vide côté LTDB.
 */

const DATA_IMG_SRC_RE = /\s*src=(["'])data:image\/[^"']*\1/gi
const DATA_URL_RE = /^data:/i

/** Retire les src data: des balises img (laisse la balise sans src). */
export function stripDataImageSrcFromHtml(html: string): string {
  if (!html || !html.includes("data:image")) return html
  return html.replace(DATA_IMG_SRC_RE, ' src=""')
}

/** Ne garde que les URLs http(s) pour le JSON-LD / SEO photos. */
export function onlyHttpPhotoUrls<T extends { url?: string | null }>(
  photos: T[] | undefined | null,
): T[] {
  if (!photos?.length) return []
  return photos.filter((p) => {
    const u = (p.url || "").trim()
    return u.startsWith("http://") || u.startsWith("https://")
  })
}

/** Nettoie récursivement les data: URLs dans un objet JSON (seo / jsonld). */
export function stripDataUrlsFromJson(value: unknown): unknown {
  if (typeof value === "string") {
    if (DATA_URL_RE.test(value)) return ""
    if (value.includes("data:image")) return stripDataImageSrcFromHtml(value)
    return value
  }
  if (Array.isArray(value)) return value.map(stripDataUrlsFromJson)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripDataUrlsFromJson(v)
    }
    return out
  }
  return value
}

/** Applique le sanitizing sur les champs texte d'un FormData publish. */
export function sanitizePublishFormData(formData: FormData): void {
  const content = formData.get("content")
  if (typeof content === "string" && content.includes("data:image")) {
    formData.set("content", stripDataImageSrcFromHtml(content))
  }

  for (const key of ["seo_json", "jsonld", "rapport_json", "faq_json"] as const) {
    const raw = formData.get(key)
    if (typeof raw !== "string" || !raw.includes("data:")) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      formData.set(key, JSON.stringify(stripDataUrlsFromJson(parsed)))
    } catch {
      /* JSON invalide : on laisse tel quel */
    }
  }
}

/**
 * Transforme une URL d'image externe en URL passant par notre proxy
 * `/api/proxy-image`. Indispensable pour @react-pdf/renderer côté browser
 * qui requiert des images servies avec `Access-Control-Allow-Origin: *`.
 *
 * - URLs internes (relatives ou même origin) → retournées telles quelles
 * - URLs externes → préfixées par le proxy
 */
export function proxyImageUrl(url: string): string {
  if (!url) return url
  if (!/^https?:\/\//i.test(url)) return url

  if (typeof window !== 'undefined') {
    try {
      const u = new URL(url)
      if (u.origin === window.location.origin) return url
    } catch {
      return url
    }
  }

  return `/api/proxy-image?url=${encodeURIComponent(url)}`
}

/** Variante serveur : URL absolue pour le rendu PDF côté API. */
export function proxyImageUrlAbsolute(url: string, baseUrl: string): string {
  if (!url) return url
  const base = baseUrl.replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith('/')) return `${base}${url}`
    return url
  }
  try {
    const u = new URL(url)
    const appOrigin = new URL(base).origin
    if (u.origin === appOrigin) return url
  } catch {
    return url
  }
  return `${base}/api/proxy-image?url=${encodeURIComponent(url)}`
}

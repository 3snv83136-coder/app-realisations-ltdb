/** Extrait un message lisible depuis une réponse Django (400/500). */
export function formatDjangoPublishError(data: unknown, rawBody: string, status: number): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error.trim()
    if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim()
    if (Array.isArray(obj.detail) && obj.detail.length > 0) {
      return obj.detail.map((x) => String(x)).join(" · ")
    }
    const parts = Object.entries(obj)
      .filter(([k]) => !["error", "detail", "bodyPreview", "fieldSizes"].includes(k))
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${v.map(String).join(", ")}`
        if (v && typeof v === "object") return `${k}: ${JSON.stringify(v)}`
        return `${k}: ${String(v)}`
      })
    if (parts.length > 0) return parts.join(" · ")
  }
  const trimmed = rawBody.trim()
  if (trimmed && trimmed.length <= 600 && !trimmed.startsWith("<")) return trimmed
  return `HTTP ${status}`
}

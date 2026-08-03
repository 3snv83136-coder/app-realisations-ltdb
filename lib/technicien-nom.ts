/**
 * Normalise le nom affiché du technicien (H2, alt, JSON-LD author).
 * « mondor » → « Mondor », « jean-pierre » → « Jean-Pierre ».
 */
export function formatTechnicienNom(raw: string | null | undefined): string {
  const s = (raw || "").trim().replace(/\s+/g, " ")
  if (!s) return ""
  return s
    .split(/([\s'-]+)/)
    .map((part) => {
      if (/^[\s'-]+$/.test(part)) return part
      const lower = part.toLocaleLowerCase("fr-FR")
      return lower.charAt(0).toLocaleUpperCase("fr-FR") + lower.slice(1)
    })
    .join("")
}

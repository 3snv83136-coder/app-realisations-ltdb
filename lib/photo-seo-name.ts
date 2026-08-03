/**
 * Nommage SEO des photos de réalisation :
 * « type-ville-date-role » — ex. debouchage-canalisation-toulon-20260803-avant.jpg
 */

export type PhotoSeoRole = "avant" | "apres" | "pendant" | "camera" | "autre"

function slugifyPart(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Date ISO / FR → YYYYMMDD */
export function photoDateStamp(date: string | null | undefined): string {
  const raw = (date || "").trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw)
  if (fr) return `${fr[3]}${fr[2]}${fr[1]}`
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/** Base commune : type-ville-date */
export function buildPhotoNomBase(opts: {
  typeIntervention: string
  ville: string
  date?: string | null
}): string {
  const type = slugifyPart(opts.typeIntervention || "intervention") || "intervention"
  const ville = slugifyPart(opts.ville || "var") || "var"
  const date = photoDateStamp(opts.date)
  return `${type}-${ville}-${date}`
}

/** Légende / alt lisibles : « Débouchage canalisation à Toulon — Avant · 03/08/2026 » */
export function buildPhotoLegende(opts: {
  typeIntervention: string
  ville: string
  date?: string | null
  role: PhotoSeoRole
  index?: number
}): string {
  const type = (opts.typeIntervention || "Intervention").trim()
  const ville = (opts.ville || "").trim()
  const roleLabel =
    opts.role === "avant" ? "Avant"
    : opts.role === "apres" ? "Après"
    : opts.role === "pendant" ? "Pendant"
    : opts.role === "camera" ? "Caméra"
    : opts.index != null ? `Photo ${opts.index + 1}` : "Photo"
  const stamp = photoDateStamp(opts.date)
  const dateFr = stamp.length === 8
    ? `${stamp.slice(6, 8)}/${stamp.slice(4, 6)}/${stamp.slice(0, 4)}`
    : ""
  const lieu = ville ? ` à ${ville}` : ""
  const datePart = dateFr ? ` · ${dateFr}` : ""
  return `${type}${lieu} — ${roleLabel}${datePart}`
}

export function buildPhotoFilename(opts: {
  typeIntervention: string
  ville: string
  date?: string | null
  role: PhotoSeoRole
  index?: number
  ext?: string
}): string {
  const base = buildPhotoNomBase(opts)
  const role =
    opts.role === "autre" && opts.index != null
      ? `photo-${opts.index + 1}`
      : opts.role
  const ext = (opts.ext || ".jpg").startsWith(".") ? (opts.ext || ".jpg") : `.${opts.ext}`
  return `${base}-${role}${ext.toLowerCase()}`
}

/** Renomme un File avec le schéma SEO (conserve le contenu). */
export function renamePhotoFile(
  file: File,
  opts: {
    typeIntervention: string
    ville: string
    date?: string | null
    role: PhotoSeoRole
    index?: number
  },
): File {
  const ext = (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".jpg").toLowerCase()
  const name = buildPhotoFilename({ ...opts, ext })
  return new File([file], name, { type: file.type || "image/jpeg" })
}

export function roleFromCategory(cat?: string | null, index = 0): PhotoSeoRole {
  const c = (cat || "").toLowerCase()
  if (c === "avant" || c === "before") return "avant"
  if (c === "apres" || c === "après" || c === "after") return "apres"
  if (c === "pendant") return "pendant"
  if (c === "camera" || c === "caméra") return "camera"
  if (index === 0) return "avant"
  if (index === 1) return "apres"
  return "autre"
}

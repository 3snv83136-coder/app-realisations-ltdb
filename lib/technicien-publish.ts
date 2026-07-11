import type { SupabaseClient } from "@supabase/supabase-js"
import { publishImageUrlForSite } from "@/lib/publish-image-url"
import type { TechnicienPublishInfo } from "@/lib/publish-content"

export type TechnicienRow = {
  nom: string
  photo_url: string | null
  annees_experience: number | null
  titre_metier: string | null
}

export async function loadTechnicienById(
  sb: SupabaseClient,
  technicienId: string,
): Promise<TechnicienRow | null> {
  const { data } = await sb
    .from("techniciens")
    .select("nom, photo_url, annees_experience, titre_metier")
    .eq("id", technicienId)
    .maybeSingle()
  return data || null
}

/** Recherche par nom (insensible à la casse) — flux /nouveau sans technicien_id. */
export async function loadTechnicienByNom(
  sb: SupabaseClient,
  nom: string,
): Promise<TechnicienRow | null> {
  const q = nom.trim()
  if (!q) return null
  const { data } = await sb
    .from("techniciens")
    .select("nom, photo_url, annees_experience, titre_metier")
    .ilike("nom", q)
    .eq("actif", true)
    .limit(1)
    .maybeSingle()
  return data || null
}

export function toTechnicienPublishInfo(row: TechnicienRow | null, fallbackNom?: string): TechnicienPublishInfo | null {
  const nom = row?.nom?.trim() || fallbackNom?.trim()
  if (!nom) return null
  return {
    nom,
    photoUrl: publishImageUrlForSite(row?.photo_url),
    anneesExperience: row?.annees_experience ?? null,
    titreMetier: row?.titre_metier || null,
  }
}

/** Télécharge le portrait pour l'envoyer à Django (`technicien_photo`). */
export async function fetchTechnicienPhotoFile(
  photoUrl: string,
  slugHint: string,
): Promise<File | null> {
  const url = publishImageUrlForSite(photoUrl)
  if (!url) return null
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size === 0) return null
    const safe = (slugHint || "technicien").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40)
    const ext = blob.type === "image/png" ? ".png" : ".jpg"
    return new File([blob], `${safe}-portrait${ext}`, {
      type: blob.type || "image/jpeg",
    })
  } catch (e) {
    console.error("[technicien-publish] fetchTechnicienPhotoFile", e)
    return null
  }
}

export async function appendTechnicienPhotoToFormData(
  fd: FormData,
  photoUrl: string | null | undefined,
  slugHint: string,
): Promise<string | null> {
  const publicUrl = publishImageUrlForSite(photoUrl)
  if (!publicUrl) return null
  fd.append("technicien_photo_url", publicUrl)
  const file = await fetchTechnicienPhotoFile(publicUrl, slugHint)
  if (file) fd.append("technicien_photo", file)
  return publicUrl
}

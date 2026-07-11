/**
 * URL d'image utilisable sur le site public (lestechniciensdudebouchage.fr).
 * Le sanitizer du frontend bloque les images hébergées sur l'app back-office
 * (proxy Vercel) — on envoie donc l'URL publique Supabase directement.
 */
export function publishImageUrlForSite(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) return null
  return u
}

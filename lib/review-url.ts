import { getSupabaseOrNull } from "@/lib/supabase"

const FALLBACK_REVIEW_URL =
  process.env.GOOGLE_REVIEW_URL
  || "https://www.google.com/maps/place/Les+Techniciens+du+Débouchage"

/** URL avis Google (paramètre Supabase ou variable d'environnement). */
export async function getGoogleReviewUrl(): Promise<string> {
  let reviewUrl = FALLBACK_REVIEW_URL
  try {
    const sb = getSupabaseOrNull()
    if (sb) {
      const { data } = await sb
        .from("parametres")
        .select("valeur")
        .eq("cle", "google_review_url")
        .maybeSingle()
      if (data?.valeur?.trim()) reviewUrl = data.valeur.trim()
    }
  } catch { /* best-effort */ }
  return reviewUrl
}

export function buildReviewOnlySmsText(opts: {
  clientNom?: string | null
  reviewUrl: string
  tel: string
}): string {
  const nom = (opts.clientNom || "").trim()
  return [
    nom ? `Bonjour ${nom},` : "Bonjour,",
    "merci pour votre confiance suite a notre intervention.",
    "Si vous etes satisfait, laissez-nous un avis Google :",
    opts.reviewUrl,
    `Les Techniciens du Debouchage · ${opts.tel}`,
  ].join(" ")
}

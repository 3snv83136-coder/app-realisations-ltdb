import { getSupabaseOrNull } from "@/lib/supabase"

const FALLBACK_REVIEW_URL =
  process.env.GOOGLE_REVIEW_URL
  || "https://g.page/r/CascWzNKHgyEEAE/review"

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

/** Lien court brandé (cliquable dans le SMS) → redirige vers Google avis. */
export const SMS_REVIEW_LINK =
  process.env.SMS_REVIEW_URL?.trim()
  || "https://lestechniciensdudebouchage.fr/avis"

/**
 * SMS relance avis Google.
 * Seule l'URL est cliquable sur un téléphone — on la met seule sur sa ligne.
 * `reviewUrl` / `tel` restent acceptés pour compat appelants (mails / drafts).
 */
export function buildReviewOnlySmsText(opts: {
  clientNom?: string | null
  reviewUrl: string
  tel: string
}): string {
  void opts.reviewUrl
  void opts.tel
  const nom = (opts.clientNom || "").trim()
  const salut = nom ? `Bonjour ${nom},` : "Bonjour,"
  return [
    salut,
    "",
    "30 secondes pour vous, un vrai coup de pouce pour nous.",
    "",
    "Vous êtes satisfait de notre intervention ou de nos conseils ? Partagez votre expérience en laissant un avis Google :",
    "",
    SMS_REVIEW_LINK,
    "",
    "Merci pour votre confiance.",
  ].join("\n")
}


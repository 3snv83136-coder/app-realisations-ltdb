import { getSupabaseOrNull } from "@/lib/supabase"

const FALLBACK_REVIEW_URL =
  process.env.GOOGLE_REVIEW_URL
  || "https://g.page/r/CascWzNKHgyEEAE/review"

/** Lien Pages Jaunes « laisser un avis » (sollicitation LTDB). */
export const PAGES_JAUNES_REVIEW_URL =
  process.env.PAGES_JAUNES_REVIEW_URL?.trim()
  || "https://www.pagesjaunes.fr/contribution/votre-avis/63850881?code_origine_sollicitation=slm&id_callback_sollicitation=7d2ec41affc340d2b53e756a928d4a9e&email=mondornaji@gmail.com"

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
 * Lien SMS Pages Jaunes — URL contribution directe (fiable hors auth app).
 * Optionnel : SMS_PAGES_JAUNES_URL=https://app-realisations-ltdb.vercel.app/avis-pj
 */
export const SMS_PAGES_JAUNES_LINK =
  process.env.SMS_PAGES_JAUNES_URL?.trim()
  || PAGES_JAUNES_REVIEW_URL

/**
 * SMS relance avis Google + Pages Jaunes.
 * Seules les URLs sont cliquables sur un téléphone — une URL = une ligne.
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
    "Vous êtes satisfait de notre intervention ou de nos conseils ? Partagez votre expérience :",
    "",
    "⭐ Google :",
    SMS_REVIEW_LINK,
    "",
    "📒 Pages Jaunes (même geste, merci) :",
    SMS_PAGES_JAUNES_LINK,
    "",
    "Merci pour votre confiance.",
  ].join("\n")
}

import { google } from "googleapis"

const INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing"

export type GoogleIndexingResult = {
  ok: boolean
  skipped?: boolean
  error?: string
}

/** URL canonique d'une réalisation publiée sur le site public. */
export function realisationPublicUrl(slug: string): string {
  return `https://lestechniciensdudebouchage.fr/nos-realisations/${slug}`
}

function readServiceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_INDEXING_JSON?.trim()
  if (!raw) return null
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")
  const parsed = JSON.parse(text) as { client_email?: string; private_key?: string }
  if (!parsed.client_email || !parsed.private_key) return null
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
  }
}

/**
 * Demande à Google de recrawler une URL déjà en ligne (Indexing API).
 * N'échoue jamais la publication : sans clé, l'envoi est ignoré.
 */
export async function notifyGoogleIndexing(url: string): Promise<GoogleIndexingResult> {
  try {
    const credentials = readServiceAccount()
    if (!credentials) {
      return { ok: false, skipped: true, error: "GOOGLE_INDEXING_JSON absent" }
    }
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [INDEXING_SCOPE],
    })
    const indexing = google.indexing({ version: "v3", auth })
    await indexing.urlNotifications.publish({
      requestBody: { url, type: "URL_UPDATED" },
    })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    console.error("[google-indexing]", url, error)
    return { ok: false, error }
  }
}

import { google, youtube_v3 } from "googleapis"
import { OAuth2Client } from "google-auth-library"
import { getSupabase } from "./supabase"
import { getTelPrincipal } from "./parametres"
import { Readable } from "node:stream"

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
const PLATFORM = "youtube"

function buildOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("OAuth Google non configuré (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI)")
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getAuthUrl(): string {
  const oauth = buildOAuthClient()
  return oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    include_granted_scopes: true,
  })
}

export async function exchangeCodeAndStore(code: string): Promise<{ email?: string }> {
  const oauth = buildOAuthClient()
  const { tokens } = await oauth.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error("Refresh token absent — révoque l'accès et relance avec prompt=consent")
  }

  let email: string | undefined
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString())
      email = payload?.email
    } catch {
      /* ignore */
    }
  }

  const sb = getSupabase()
  const { error } = await sb
    .from("social_tokens")
    .upsert(
      {
        platform: PLATFORM,
        account_email: email || null,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token || null,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope || SCOPES.join(" "),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" },
    )
  if (error) throw new Error(`DB upsert social_tokens: ${error.message}`)
  return { email }
}

async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from("social_tokens")
    .select("refresh_token")
    .eq("platform", PLATFORM)
    .maybeSingle()
  if (error) throw new Error(`DB lecture social_tokens: ${error.message}`)
  if (!data?.refresh_token) throw new Error("Aucun token YouTube — connecte le compte via /api/oauth/google")

  const oauth = buildOAuthClient()
  oauth.setCredentials({ refresh_token: data.refresh_token })
  return oauth
}

export type YouTubeUploadInput = {
  videoUrl: string
  title: string
  description: string
  tags?: string[]
  privacyStatus?: "public" | "unlisted" | "private"
  categoryId?: string
}

export async function uploadVideoToYouTube(input: YouTubeUploadInput): Promise<{ videoId: string; url: string }> {
  const auth = await getAuthenticatedClient()
  const yt = google.youtube({ version: "v3", auth })

  const res = await fetch(input.videoUrl)
  if (!res.ok || !res.body) throw new Error(`Téléchargement vidéo échoué : HTTP ${res.status}`)
  const arrayBuf = await res.arrayBuffer()
  const stream = Readable.from(Buffer.from(arrayBuf))

  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title: input.title.slice(0, 100),
      description: input.description.slice(0, 5000),
      tags: input.tags?.slice(0, 30),
      categoryId: input.categoryId || "26", // Howto & Style
      defaultLanguage: "fr",
      defaultAudioLanguage: "fr",
    },
    status: {
      privacyStatus: input.privacyStatus || "public",
      selfDeclaredMadeForKids: false,
    },
  }

  const insert = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody,
    media: { body: stream },
  })

  const videoId = insert.data.id
  if (!videoId) throw new Error("YouTube n'a pas retourné d'ID vidéo")
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` }
}

export async function buildVideoMetadata(opts: {
  typeIntervention?: string | null
  ville?: string | null
  reference?: string | null
  rapport?: any
}): Promise<{ title: string; description: string; tags: string[] }> {
  const type = opts.typeIntervention || "Intervention plomberie"
  const ville = opts.ville || "Var"
  const ref = opts.reference ? ` · Réf ${opts.reference}` : ""
  const title = `${type} à ${ville} — LTDB Plombier 24h/24${ref}`

  const summary =
    opts.rapport?.resume_court ||
    opts.rapport?.resume ||
    `Intervention de ${type.toLowerCase()} réalisée à ${ville} par Les Techniciens du Débouchage.`

  const tel = await getTelPrincipal()

  const description = [
    summary,
    "",
    "🔧 Les Techniciens du Débouchage — Var (83) — 24h/24, 7j/7",
    `📞 ${tel}`,
    "🌐 https://lestechniciensdudebouchage.fr",
    "📍 Toulon, Hyères, Fréjus, Draguignan, Brignoles et tout le Var",
    "",
    "Tarif débouchage à partir de 99€ TTC.",
    "",
    `#debouchage #plomberie #${ville.toLowerCase().replace(/\s+/g, "")} #var #urgence #ltdb`,
  ].join("\n")

  const tags = [
    "débouchage",
    "plombier",
    "plomberie",
    "var",
    "83",
    ville,
    type,
    "urgence plombier",
    "débouchage canalisation",
    "ltdb",
    "les techniciens du debouchage",
  ].filter(Boolean) as string[]

  return { title, description, tags }
}

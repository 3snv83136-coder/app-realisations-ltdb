import { google } from "googleapis"
import { OAuth2Client } from "google-auth-library"
import { getSupabase } from "./supabase"

/**
 * OAuth Google Business Profile (GMB).
 * Calqué sur lib/youtube.ts — même table `social_tokens`, plateforme "gmb".
 * Projet Cloud dédié : lestechniciensdudebouchage-gbp (≠ projet vidéo/YouTube).
 */
const SCOPES = ["https://www.googleapis.com/auth/business.manage"]
const PLATFORM = "gmb"

function buildOAuthClient(): OAuth2Client {
  const clientId = process.env.GMB_CLIENT_ID
  const clientSecret = process.env.GMB_CLIENT_SECRET
  const redirectUri = process.env.GMB_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "OAuth GMB non configuré (GMB_CLIENT_ID / GMB_CLIENT_SECRET / GMB_REDIRECT_URI)",
    )
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/** URL de consentement Google à ouvrir pour connecter le compte Business Profile. */
export function getAuthUrl(): string {
  return buildOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    include_granted_scopes: true,
  })
}

/** Échange le code OAuth contre les jetons et les stocke dans `social_tokens`. */
export async function exchangeCodeAndStore(code: string): Promise<{ email?: string }> {
  const oauth = buildOAuthClient()
  const { tokens } = await oauth.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error(
      "Refresh token absent — révoque l'accès du compte sur myaccount.google.com/permissions puis relance la connexion.",
    )
  }

  let email: string | undefined
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString(),
      )
      email = payload?.email
    } catch {
      /* id_token non décodable — sans gravité */
    }
  }

  const sb = getSupabase()
  const { error } = await sb.from("social_tokens").upsert(
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

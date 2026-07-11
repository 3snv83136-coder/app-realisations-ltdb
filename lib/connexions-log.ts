import { getSupabaseOrNull } from "@/lib/supabase"
import type { AuthAccount } from "@/lib/auth-users"

export type ConnexionLogRow = {
  id: string
  login: string
  role: string
  technicien_id: string | null
  is_demo: boolean
  ip: string | null
  country_code: string | null
  city: string | null
  user_agent: string | null
  created_at: string
}

function firstForwardedIp(header: string | null): string | null {
  if (!header) return null
  const first = header.split(",")[0]?.trim()
  return first || null
}

/** Extrait IP / pays / ville des headers Vercel (vides en local). */
export function extractRequestGeo(req: Request): {
  ip: string | null
  countryCode: string | null
  city: string | null
  userAgent: string | null
} {
  const h = req.headers
  const ip = firstForwardedIp(h.get("x-forwarded-for")) || h.get("x-real-ip")
  const countryCode = h.get("x-vercel-ip-country")
  const rawCity = h.get("x-vercel-ip-city")
  const city = rawCity ? decodeURIComponent(rawCity) : null
  const userAgent = h.get("user-agent")
  return { ip, countryCode, city, userAgent }
}

/** Enregistre une connexion réussie. Ne doit jamais faire échouer le login. */
export async function logConnexion(
  account: AuthAccount,
  geo: { ip: string | null; countryCode: string | null; city: string | null; userAgent: string | null },
): Promise<void> {
  try {
    const sb = getSupabaseOrNull()
    if (!sb) return
    await sb.from("connexions_log").insert({
      login: account.login,
      role: account.role,
      technicien_id: account.technicienId,
      is_demo: account.isDemo ?? false,
      ip: geo.ip,
      country_code: geo.countryCode,
      city: geo.city,
      user_agent: geo.userAgent,
    })
  } catch {
    // Le suivi des connexions ne doit jamais bloquer une connexion réelle.
  }
}

export async function getRecentConnexions(limit = 200): Promise<ConnexionLogRow[]> {
  const sb = getSupabaseOrNull()
  if (!sb) return []
  const { data } = await sb
    .from("connexions_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

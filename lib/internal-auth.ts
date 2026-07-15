import { timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"

/**
 * Appels serveur→serveur (scripts E2E, cron) authentifiés via x-internal-auth.
 *
 * Le secret dédié INTERNAL_API_SECRET est prioritaire ; NEXTAUTH_SECRET reste
 * accepté en repli pour ne pas casser les scripts existants. Comparaison en
 * temps constant pour éviter les attaques par timing.
 */
export function isInternalApiCall(req: NextRequest): boolean {
  const provided = req.headers.get("x-internal-auth")
  if (!provided) return false
  const secrets = [process.env.INTERNAL_API_SECRET, process.env.NEXTAUTH_SECRET]
  return secrets.some(secret => secret && safeEqual(provided, secret))
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

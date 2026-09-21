import type { NextRequest } from "next/server"

/**
 * Auth des routes `/api/cron/*`.
 * - Si `CRON_SECRET` est défini : exige `Authorization: Bearer <secret>`
 *   (Vercel l’envoie automatiquement sur les Cron Jobs).
 * - Sinon : accepte l’en-tête `x-vercel-cron: 1` (toujours présent sur les
 *   invocations Cron Vercel) — sinon les SMS avis ne partent jamais en prod
 *   quand CRON_SECRET n’est pas configuré.
 * - En local (hors production) : ouvert si aucun secret.
 */
export function verifyCronAuth(req: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET || "").trim()
  const auth = req.headers.get("authorization") || ""
  if (secret) {
    return auth === `Bearer ${secret}`
  }
  if (req.headers.get("x-vercel-cron") === "1") {
    return true
  }
  return process.env.NODE_ENV !== "production"
}

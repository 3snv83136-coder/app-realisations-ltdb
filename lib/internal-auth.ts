import type { NextRequest } from "next/server"

/** Appels serveur→serveur (scripts E2E, cron) authentifiés via x-internal-auth. */
export function isInternalApiCall(req: NextRequest): boolean {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return false
  return req.headers.get("x-internal-auth") === secret
}

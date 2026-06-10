import type { AuthRole } from "@/lib/auth-users"

/** Pages accessibles aux techniciens (espace restreint). */
export const TECH_PAGE_PREFIXES = [
  "/mes-interventions",
  "/intervention/",
  "/login",
] as const

const TECH_API_PREFIXES = [
  "/api/auth",
  "/api/interventions",
  "/api/generate",
  "/api/save-rapport",
  "/api/transcribe",
  "/api/notify-rapport-facture",
  "/api/notify-rapport-facture-sms",
  "/api/notify-devis",
  "/api/proxy-image",
  "/api/health",
] as const

export function isTechPageAllowed(pathname: string): boolean {
  if (pathname === "/") return false
  return TECH_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(p))
}

export function isTechApiAllowed(pathname: string): boolean {
  return TECH_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p))
}

export function homePathForRole(role: AuthRole | undefined): string {
  return role === "tech" ? "/mes-interventions" : "/"
}

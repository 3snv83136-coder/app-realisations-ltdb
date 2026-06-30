import type { AuthRole } from "@/lib/auth-users"
import { isAccordFinDeMois } from "@/lib/fin-de-mois"

/** Pages accessibles aux techniciens (espace restreint). */
export const TECH_PAGE_PREFIXES = [
  "/planning",
  "/mes-interventions",
  "/intervention/",
  "/accord",
  "/login",
] as const

const TECH_API_PREFIXES = [
  "/api/auth",
  "/api/interventions",
  "/api/accords",
  "/api/generate",
  "/api/save-rapport",
  "/api/transcribe",
  "/api/notify-rapport-facture",
  "/api/notify-rapport-facture-sms",
  "/api/notify-devis",
  "/api/notify-client",
  "/api/proxy-image",
  "/api/siret",
  "/api/sms",
  "/api/health",
] as const

export function isTechPageAllowed(pathname: string): boolean {
  if (pathname === "/") return false
  if (pathname.startsWith("/accord") && !isAccordFinDeMois()) return false
  return TECH_PAGE_PREFIXES.some(p => pathname === p || pathname.startsWith(p))
}

export function isTechApiAllowed(pathname: string): boolean {
  return TECH_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p))
}

export function homePathForRole(role: AuthRole | undefined): string {
  return role === "tech" ? "/planning" : "/"
}

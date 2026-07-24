import { auth } from "@/lib/auth"
import { homePathForRole, isTechApiAllowed, isTechPageAllowed } from "@/lib/auth-routes"
import { isDemoAccessActive } from "@/lib/demo-access"
import { isCompteTechActive } from "@/lib/comptes-tech"
import { NextResponse } from "next/server"

const INTERVENTION_FICHE = /^\/intervention\/([^/]+)$/

/** Comparaison en temps constant (Edge runtime — pas de node:crypto ici). */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

const PUBLIC_PREFIXES = [
  "/login",
  "/mirabella",
  "/recup",
  "/api/auth",
  "/api/health",
  "/api/calendar.ics",
  "/api/oauth",
  "/api/proxy-image",
  "/api/notify-client/stop-review",
  "/api/quote-complementaire/stop-reminders",
  "/api/facture/stop-reminders",
  "/api/cron/",
]

export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const role = req.auth?.user?.role
  const isDemo = req.auth?.user?.isDemo === true

  if (!process.env.AUTH_USER_1 && !process.env.AUTH_TECH_1) {
    return NextResponse.next()
  }

  if (PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const internal = req.headers.get("x-internal-auth")
  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.NEXTAUTH_SECRET
  if (internal && internalSecret && constantTimeEqual(internal, internalSecret)) {
    return NextResponse.next()
  }

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }
    const loginUrl = new URL("/login", req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // Accès démo révoqué ou expiré → déconnexion forcée
  if (isDemo) {
    const login = req.auth.user?.name || ""
    const stillActive = login ? await isDemoAccessActive(login) : false
    if (!stillActive) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Accès révoqué", revoked: true }, { status: 401 })
      }
      const signOutUrl = new URL("/api/auth/signout", req.nextUrl.origin)
      signOutUrl.searchParams.set("callbackUrl", "/login?revoked=1")
      return NextResponse.redirect(signOutUrl)
    }
  }

  // Compte technicien en base désactivé → déconnexion forcée
  if (req.auth.user?.isDbTech === true) {
    const login = req.auth.user?.name || ""
    const stillActive = login ? await isCompteTechActive(login) : false
    if (!stillActive) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Compte désactivé", revoked: true }, { status: 401 })
      }
      const signOutUrl = new URL("/api/auth/signout", req.nextUrl.origin)
      signOutUrl.searchParams.set("callbackUrl", "/login?revoked=1")
      return NextResponse.redirect(signOutUrl)
    }
  }

  const demoMgmtBlocked =
    pathname.startsWith("/acces-demo")
    || pathname.startsWith("/connexions")
    || pathname.startsWith("/api/connexions")
    || pathname.startsWith("/admin")
    || pathname.startsWith("/api/admin")
    || (pathname.startsWith("/api/demo-access") && !pathname.startsWith("/api/demo-access/check"))

  if (isDemo && demoMgmtBlocked) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
    }
    return NextResponse.redirect(new URL("/", req.nextUrl.origin))
  }

  if (role === "tech") {
    if (pathname === "/" || pathname === "/mes-interventions") {
      return NextResponse.redirect(new URL(homePathForRole("tech"), req.nextUrl.origin))
    }
    const ficheMatch = pathname.match(INTERVENTION_FICHE)
    if (ficheMatch) {
      return NextResponse.redirect(
        new URL(`/intervention/${ficheMatch[1]}/terrain`, req.nextUrl.origin),
      )
    }
    if (pathname.startsWith("/api/")) {
      if (!isTechApiAllowed(pathname)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
      }
    } else if (!isTechPageAllowed(pathname)) {
      return NextResponse.redirect(new URL(homePathForRole("tech"), req.nextUrl.origin))
    }
  }

  return NextResponse.next()
})

export const config = {
  // "/api/:path*" force TOUTES les routes API à passer par l'auth, y compris
  // celles dont un segment dynamique contient un point (ex. /api/x/1.2) qui
  // échappaient à l'ancien matcher "tout sauf les chemins avec un point".
  matcher: [
    "/api/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
}

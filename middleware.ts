import { auth } from "@/lib/auth"
import { homePathForRole, isTechApiAllowed, isTechPageAllowed } from "@/lib/auth-routes"
import { NextResponse } from "next/server"

const INTERVENTION_FICHE = /^\/intervention\/([^/]+)$/

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/calendar",
  "/api/oauth",
  "/api/proxy-image",
  "/api/notify-client/stop-review",
  "/api/quote-complementaire/stop-reminders",
  "/api/facture/stop-reminders",
  "/api/cron/",
]

export default auth((req) => {
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
  if (process.env.NEXTAUTH_SECRET && internal === process.env.NEXTAUTH_SECRET) {
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

  if (isDemo && (pathname.startsWith("/acces-demo") || pathname.startsWith("/api/demo-access"))) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
}

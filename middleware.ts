import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Routes publiques par conception — accessibles sans session :
 * - /login + endpoints NextAuth (/api/auth)
 * - /api/health : monitoring
 * - /api/calendar(.ics) : abonnement iCal externe (protégé par son propre token)
 * - /api/oauth : callbacks OAuth des réseaux sociaux (redirections externes)
 * - /api/proxy-image : proxy d'images utilisé par le rendu des PDF
 * - liens « stop » cliqués par les clients depuis les emails (pas de session)
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth',
  '/api/health',
  '/api/calendar',
  '/api/oauth',
  '/api/proxy-image',
  '/api/notify-client/stop-review',
  '/api/quote-complementaire/stop-reminders',
  '/api/facture/stop-reminders',
]

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Fail-open : tant qu'aucun compte n'est configuré (AUTH_USER_1 absent de
  // l'environnement), on n'enforce rien. Évite de verrouiller toute l'app si
  // les variables d'auth ne sont pas (encore) définies côté Vercel.
  if (!process.env.AUTH_USER_1) return NextResponse.next()

  if (PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Appels internes serveur→serveur (ex : interventions → notify-technicien) :
  // pas de cookie de session, authentifiés par un header secret partagé.
  const internal = req.headers.get('x-internal-auth')
  if (process.env.NEXTAUTH_SECRET && internal === process.env.NEXTAUTH_SECRET) {
    return NextResponse.next()
  }

  if (req.auth) return NextResponse.next()

  // Non authentifié
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const loginUrl = new URL('/login', req.nextUrl.origin)
  loginUrl.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
})

export const config = {
  // Tout sauf les assets statiques et les fichiers (extension = contient un point).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
}

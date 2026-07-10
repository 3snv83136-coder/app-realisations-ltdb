import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isDemoAccessActive } from '@/lib/demo-access'

export const dynamic = 'force-dynamic'

/** GET /api/demo-access/check — vérifie si l'accès démo courant est encore actif. */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ valid: false, revoked: true }, { status: 401 })
  }

  if (!session.user.isDemo) {
    return NextResponse.json({ valid: true })
  }

  const login = session.user.name || ''
  const active = await isDemoAccessActive(login)
  if (!active) {
    return NextResponse.json({ valid: false, revoked: true }, { status: 401 })
  }

  return NextResponse.json({ valid: true })
}

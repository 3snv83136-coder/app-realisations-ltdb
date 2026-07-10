import { NextRequest, NextResponse } from 'next/server'
import { createDemoAccess, listDemoAccess } from '@/lib/demo-access'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'

export const dynamic = 'force-dynamic'

/** GET /api/demo-access — liste des accès démo (gérant uniquement). */
export async function GET() {
  const auth = await requireOwnerAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const rows = await listDemoAccess(true)
    return NextResponse.json({ access: rows })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 },
    )
  }
}

type Body = {
  login?: string
  password?: string
  label?: string
  expires_at?: string | null
}

/** POST /api/demo-access — crée un accès démo admin complet. */
export async function POST(req: NextRequest) {
  const auth = await requireOwnerAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const login = (body.login || '').trim()
  const password = body.password || ''
  const label = (body.label || '').trim()
  let expiresAt: string | null = null
  if (body.expires_at) {
    const d = new Date(body.expires_at)
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'Date d\'expiration invalide' }, { status: 400 })
    }
    expiresAt = d.toISOString()
  }

  try {
    const row = await createDemoAccess({
      login,
      password,
      label: label || undefined,
      expiresAt,
      createdBy: auth.session.user?.name || null,
    })
    return NextResponse.json({ ok: true, access: row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Création impossible' },
      { status: 400 },
    )
  }
}

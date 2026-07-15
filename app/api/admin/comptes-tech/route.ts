import { NextRequest, NextResponse } from 'next/server'
import { createCompteTech, listComptesTech } from '@/lib/comptes-tech'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'
import { errorMessage } from '@/lib/error-message'

export const dynamic = 'force-dynamic'

/** GET /api/admin/comptes-tech — liste des comptes techniciens (gérant uniquement). */
export async function GET() {
  const auth = await requireOwnerAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const rows = await listComptesTech()
    return NextResponse.json({ comptes: rows })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || 'Erreur' }, { status: 500 })
  }
}

type Body = {
  login?: string
  password?: string
  technicien_id?: string
}

/** POST /api/admin/comptes-tech — crée un compte technicien (accès restreint rôle tech). */
export async function POST(req: NextRequest) {
  const auth = await requireOwnerAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  try {
    const row = await createCompteTech({
      login: (body.login || '').trim(),
      password: body.password || '',
      technicienId: (body.technicien_id || '').trim(),
      createdBy: auth.session.user?.name || null,
    })
    return NextResponse.json({ ok: true, compte: row })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || 'Création impossible' }, { status: 400 })
  }
}

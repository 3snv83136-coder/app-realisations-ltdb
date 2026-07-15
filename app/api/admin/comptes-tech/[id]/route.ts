import { NextRequest, NextResponse } from 'next/server'
import { resetCompteTechPassword, setCompteTechActif } from '@/lib/comptes-tech'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'
import { errorMessage } from '@/lib/error-message'

export const dynamic = 'force-dynamic'

type Body = {
  actif?: boolean
  password?: string
}

/**
 * PATCH /api/admin/comptes-tech/[id] — gérant uniquement.
 * { actif: false }        → désactive le compte (déconnexion forcée au prochain hit)
 * { actif: true }         → réactive le compte
 * { password: "nouveau" } → réinitialise le mot de passe
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireOwnerAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (typeof body.actif !== 'boolean' && !body.password) {
    return NextResponse.json({ error: 'Rien à modifier (actif ou password attendu)' }, { status: 400 })
  }

  try {
    if (typeof body.actif === 'boolean') {
      await setCompteTechActif(params.id, body.actif)
    }
    if (body.password) {
      await resetCompteTechPassword(params.id, body.password)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || 'Modification impossible' }, { status: 400 })
  }
}

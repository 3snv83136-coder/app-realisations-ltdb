import { NextResponse } from 'next/server'
import { revokeDemoAccess } from '@/lib/demo-access'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/** DELETE /api/demo-access/[id] — révoque un accès démo. */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireOwnerAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const id = params.id
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

  try {
    await revokeDemoAccess(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Révocation impossible' },
      { status: 400 },
    )
  }
}

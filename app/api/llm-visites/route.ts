import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchLlmVisites } from '@/lib/llm-visits'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'admin' || session.user.isDemo) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  try {
    const report = await fetchLlmVisites()
    return NextResponse.json(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lecture impossible'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

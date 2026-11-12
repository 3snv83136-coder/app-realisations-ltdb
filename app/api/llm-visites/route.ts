import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchLlmVisites, fetchLlmVisitesCsv, type LlmVisitesQuery } from '@/lib/llm-visits'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function queryFrom(req: NextRequest): LlmVisitesQuery {
  const source = req.nextUrl.searchParams
  const query: LlmVisitesQuery = {}
  const debut = source.get('debut') || ''
  const fin = source.get('fin') || ''
  const moteur = source.get('moteur') || ''
  const kind = source.get('kind') || ''
  const q = source.get('q') || ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(debut)) query.debut = debut
  if (/^\d{4}-\d{2}-\d{2}$/.test(fin)) query.fin = fin
  if (moteur) query.moteur = moteur.slice(0, 40)
  if (kind === 'robot' || kind === 'clic' || kind === 'requete') query.kind = kind
  if (q) query.q = q.slice(0, 120)
  return query
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'admin' || session.user.isDemo) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  const query = queryFrom(req)
  try {
    if (req.nextUrl.searchParams.get('format') === 'csv') {
      const file = await fetchLlmVisitesCsv(query)
      return new NextResponse(file.body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${file.filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    }
    const report = await fetchLlmVisites(query)
    return NextResponse.json(report)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lecture impossible'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

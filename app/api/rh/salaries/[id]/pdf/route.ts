import { NextRequest, NextResponse } from "next/server"
import { createElement, type ReactElement } from "react"
import { getSupabaseOrNull } from "@/lib/supabase"
import { requireAdminApi } from "@/lib/rh/require-admin"
import type { RhDocumentGenereType, Salarie } from "@/lib/rh/types"
import { RhDocumentPdf, rhPdfFilename } from "@/components/rh/RhDocumentsPDF"

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_TYPES = new Set<RhDocumentGenereType>([
  'cdi', 'cdd', 'due', 'fin_contrat', 'rupture_conventionnelle',
])

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let body: { type?: string; dateDocument?: string; lieuSignature?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const type = body.type as RhDocumentGenereType
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 })
  }

  const { data: salarie, error } = await sb.from('salaries').select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!salarie) return NextResponse.json({ error: 'Salarié introuvable' }, { status: 404 })

  const ctx = {
    salarie: salarie as Salarie,
    dateDocument: body.dateDocument,
    lieuSignature: body.lieuSignature || 'Toulon',
  }

  const { renderToBuffer } = await import('@react-pdf/renderer')
  const buf = await renderToBuffer(
    createElement(RhDocumentPdf, { type, ctx }) as ReactElement,
  )

  await sb.from('salarie_documents_generes').insert({
    salarie_id: params.id,
    type,
    metadata: { dateDocument: ctx.dateDocument, lieuSignature: ctx.lieuSignature },
  })

  const filename = rhPdfFilename(type, salarie as Salarie)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

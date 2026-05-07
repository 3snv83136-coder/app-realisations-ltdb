import { NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'no supabase' }, { status: 500 })

  const url = process.env.SUPABASE_URL || null
  const urlPrefix = url ? url.slice(0, url.indexOf('.')) : null

  const [rawAll, rawNotAnnule, rawWithLimit] = await Promise.all([
    sb.from('documents').select('id, type, numero, statut, client_id, created_at').order('created_at', { ascending: false }),
    sb.from('documents').select('id, type, numero, statut, client_id, created_at').neq('statut', 'annule').order('created_at', { ascending: false }),
    sb.from('documents').select('id, type, numero, statut, client_id, created_at').neq('statut', 'annule').order('created_at', { ascending: false }).limit(100),
  ])

  return NextResponse.json({
    supabase_url_prefix: urlPrefix,
    raw_all_count: rawAll.data?.length ?? null,
    raw_all_error: rawAll.error?.message ?? null,
    raw_not_annule_count: rawNotAnnule.data?.length ?? null,
    raw_not_annule_error: rawNotAnnule.error?.message ?? null,
    raw_with_limit_count: rawWithLimit.data?.length ?? null,
    raw_with_limit_error: rawWithLimit.error?.message ?? null,
    raw_all_sample: rawAll.data?.slice(0, 20) ?? null,
  })
}

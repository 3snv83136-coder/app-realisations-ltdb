import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      clients: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 50)

  let query = sb
    .from('clients')
    .select('id, nom, email, telephone, adresse, code_postal, ville')
    .order('nom', { ascending: true })
    .limit(limit)

  if (q) {
    // Recherche dans nom OU email OU ville (insensible à la casse)
    const safe = q.replace(/[%,]/g, ' ')
    query = query.or(`nom.ilike.%${safe}%,email.ilike.%${safe}%,ville.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message, clients: [] }, { status: 500 })
  return NextResponse.json({ clients: data || [] })
}

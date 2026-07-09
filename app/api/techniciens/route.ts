import { NextRequest, NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/rh/require-admin"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

const UPDATABLE = new Set(['nom', 'email', 'telephone', 'agence', 'actif', 'photo_url', 'annees_experience', 'titre_metier'])

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      techniciens: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const all = url.searchParams.get('all') === '1'

  let query = sb
    .from('techniciens')
    .select('id, nom, email, telephone, agence, actif, photo_url, annees_experience, titre_metier, created_at')
    .order('nom', { ascending: true })

  if (!all) query = query.eq('actif', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message, techniciens: [] }, { status: 500 })
  return NextResponse.json({ techniciens: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
  if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const insert = {
    nom,
    email: typeof body.email === 'string' ? body.email.trim() || null : null,
    telephone: typeof body.telephone === 'string' ? body.telephone.trim() || null : null,
    agence: typeof body.agence === 'string' ? body.agence.trim() || null : null,
    actif: typeof body.actif === 'boolean' ? body.actif : true,
    titre_metier: typeof body.titre_metier === 'string' ? body.titre_metier.trim() || 'technicien déboucheur' : 'technicien déboucheur',
    annees_experience: typeof body.annees_experience === 'number' ? body.annees_experience : null,
  }

  const { data, error } = await sb
    .from('techniciens')
    .insert(insert)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technicien: data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (!UPDATABLE.has(k)) continue
    if (k === 'annees_experience') {
      update[k] = typeof v === 'number' ? v : v === null ? null : Number(v) || null
      continue
    }
    update[k] = v
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('techniciens')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ technicien: data })
}

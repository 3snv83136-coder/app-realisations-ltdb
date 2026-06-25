import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { requireAdminApi } from "@/lib/rh/require-admin"

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const { data: salarie, error } = await sb.from('salaries').select('*').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!salarie) return NextResponse.json({ error: 'Salarié introuvable' }, { status: 404 })

  const [docs, generes] = await Promise.all([
    sb.from('salarie_documents').select('*').eq('salarie_id', params.id).order('created_at', { ascending: false }),
    sb.from('salarie_documents_generes').select('*').eq('salarie_id', params.id).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    salarie,
    documents: docs.data || [],
    documents_generes: generes.data || [],
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const allowed = [
    'nom', 'prenom', 'adresse', 'code_postal', 'ville', 'email', 'telephone',
    'date_naissance', 'lieu_naissance', 'nationalite', 'numero_secu', 'poste',
    'qualification', 'coefficient', 'salaire_brut_mensuel', 'temps_travail',
    'date_embauche', 'date_fin_contrat', 'type_contrat', 'motif_cdd',
    'periode_essai_mois', 'mutuelle', 'permis_numero', 'permis_delivrance',
    'permis_categories', 'notes', 'actif',
  ] as const

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await sb.from('salaries').update(patch).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ salarie: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const { error } = await sb.from('salaries').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

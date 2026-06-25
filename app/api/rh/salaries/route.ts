import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { requireAdminApi } from "@/lib/rh/require-admin"

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const { data, error } = await sb
    .from('salaries')
    .select('*')
    .order('nom')
    .order('prenom')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ salaries: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const nom = String(body.nom || '').trim()
  const prenom = String(body.prenom || '').trim()
  if (!nom || !prenom) {
    return NextResponse.json({ error: 'Nom et prénom obligatoires' }, { status: 400 })
  }

  const row = {
    nom,
    prenom,
    adresse: strOrNull(body.adresse),
    code_postal: strOrNull(body.code_postal),
    ville: strOrNull(body.ville),
    email: strOrNull(body.email),
    telephone: strOrNull(body.telephone),
    date_naissance: strOrNull(body.date_naissance),
    lieu_naissance: strOrNull(body.lieu_naissance),
    nationalite: strOrNull(body.nationalite) || 'Française',
    numero_secu: strOrNull(body.numero_secu),
    poste: strOrNull(body.poste),
    qualification: strOrNull(body.qualification),
    coefficient: numOrNull(body.coefficient),
    salaire_brut_mensuel: numOrNull(body.salaire_brut_mensuel),
    temps_travail: strOrNull(body.temps_travail) || '35 heures par semaine',
    date_embauche: strOrNull(body.date_embauche),
    date_fin_contrat: strOrNull(body.date_fin_contrat),
    type_contrat: strOrNull(body.type_contrat) || 'CDI',
    motif_cdd: strOrNull(body.motif_cdd),
    periode_essai_mois: intOrNull(body.periode_essai_mois) ?? 2,
    mutuelle: strOrNull(body.mutuelle),
    permis_numero: strOrNull(body.permis_numero),
    permis_delivrance: strOrNull(body.permis_delivrance),
    permis_categories: strOrNull(body.permis_categories),
    notes: strOrNull(body.notes),
    actif: body.actif !== false,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await sb.from('salaries').insert(row).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ salarie: data })
}

function strOrNull(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s || null
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function intOrNull(v: unknown): number | null {
  const n = numOrNull(v)
  return n == null ? null : Math.round(n)
}

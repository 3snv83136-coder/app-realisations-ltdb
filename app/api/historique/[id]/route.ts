import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, type DocumentStatut } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

const ALLOWED_STATUTS: DocumentStatut[] = [
  'brouillon', 'envoye', 'paye', 'annule', 'accepte', 'refuse', 'expire',
]

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }
  const id = ctx.params.id
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { data, error } = await sb
    .from('documents')
    .select('id, type, numero, agence, date_emission, echeance, statut, montant_ht, montant_ttc, tva_taux, payload, pdf_url, envoye_email, envoye_at, intervention_id, client_id, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  return NextResponse.json({ document: data })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  const { error } = await sb
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

/**
 * Mise à jour partielle d'un document — typiquement le statut (paye, annule, envoye…).
 * Body attendu : { statut?: DocumentStatut, envoye_at?: string|null, envoye_email?: string|null }
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  const id = ctx.params.id
  if (!id) {
    return NextResponse.json({ error: 'id manquant' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const update: Record<string, any> = {}
  if (typeof body.statut === 'string') {
    if (!ALLOWED_STATUTS.includes(body.statut as DocumentStatut)) {
      return NextResponse.json({ error: `Statut invalide. Attendus : ${ALLOWED_STATUTS.join(', ')}` }, { status: 400 })
    }
    update.statut = body.statut
  }
  if ('envoye_at' in body) update.envoye_at = body.envoye_at || null
  if ('envoye_email' in body) update.envoye_email = body.envoye_email || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('documents')
    .update(update)
    .eq('id', id)
    .select('id, statut, envoye_at, envoye_email')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, document: data })
}

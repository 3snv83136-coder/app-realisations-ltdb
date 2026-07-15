import { NextRequest, NextResponse } from 'next/server'
import { buildClientDossier, resolveClientForDossier } from '@/lib/client-dossier'
import { getSupabaseOrNull } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/clients/dossier — dossier complet d'un client (rapports, factures, devis, accords).
 * Paramètres : client_id OU (nom + email optionnel).
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const url = new URL(req.url)
  const clientId = (url.searchParams.get('client_id') || '').trim()
  const nom = (url.searchParams.get('nom') || '').trim()
  const email = (url.searchParams.get('email') || '').trim()

  if (!clientId && !nom) {
    return NextResponse.json({
      error: 'Paramètre client_id ou nom requis.',
    }, { status: 400 })
  }

  try {
    const client = await resolveClientForDossier(sb, { clientId, nom, email })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable.' }, { status: 404 })
    }
    const dossier = await buildClientDossier(sb, client)
    return NextResponse.json({ dossier })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de chargement'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

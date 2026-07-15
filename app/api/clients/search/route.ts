import { NextRequest, NextResponse } from 'next/server'
import { searchClientSummaries } from '@/lib/client-dossier'
import { hasClientSearchFilters, type ClientSearchFilters } from '@/lib/client-search'
import { getSupabaseOrNull } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function parseFilters(url: URL): ClientSearchFilters {
  return {
    nom: (url.searchParams.get('nom') || '').trim(),
    telephone: (url.searchParams.get('telephone') || '').trim(),
    email: (url.searchParams.get('email') || '').trim(),
    ville: (url.searchParams.get('ville') || '').trim(),
  }
}

/**
 * GET /api/clients/search — liste légère (nom, tél, email, dernière intervention).
 * Au moins un filtre requis.
 */
export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré', results: [] }, { status: 500 })
  }

  const filters = parseFilters(new URL(req.url))
  if (!hasClientSearchFilters(filters)) {
    return NextResponse.json({
      error: 'Indique au moins un critère : nom, téléphone, email ou ville.',
      results: [],
    }, { status: 400 })
  }

  try {
    const results = await searchClientSummaries(sb, filters)
    return NextResponse.json({ results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de recherche'
    return NextResponse.json({ error: msg, results: [] }, { status: 500 })
  }
}

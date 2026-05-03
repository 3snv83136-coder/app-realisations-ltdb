import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, upsertClient } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

/**
 * Enregistre un rapport d'intervention dans Supabase sans le publier sur le site.
 * Permet à l'utilisateur de retrouver son brouillon dans l'historique pour le
 * télécharger / le facturer plus tard.
 */
export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const {
    interventionId,
    clientNom, clientEmail, clientAdresse,
    ville, codePostal,
    typeIntervention, dateIntervention,
    transcription, rapport, seo,
    technicienNom, // log only
  } = body || {}

  if (!rapport || typeof rapport !== 'object') {
    return NextResponse.json({ error: 'Champ rapport manquant' }, { status: 400 })
  }

  // Upsert client
  const clientId = await upsertClient({
    nom: clientNom, email: clientEmail, adresse: clientAdresse,
    ville, code_postal: codePostal,
  })

  // Si on a déjà un interventionId (rapport déjà rattaché à une intervention planifiée),
  // on met juste à jour les champs rapport_json / seo_json / transcription / statut.
  if (interventionId) {
    const { error } = await sb.from('interventions').update({
      client_id: clientId,
      type_intervention: typeIntervention || null,
      adresse_chantier: clientAdresse || null,
      ville: ville || null,
      code_postal: codePostal || null,
      date_realisee: dateIntervention || null,
      statut: 'terminee',
      transcription: transcription || null,
      rapport_json: rapport,
      seo_json: seo || null,
    }).eq('id', interventionId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: interventionId, mode: 'update' })
  }

  // Sinon insert avec retry sur collision de reference unique.
  const baseRef: string | null = (rapport as any)?.reference || null
  let currentRef: string | null = baseRef
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await sb.from('interventions').insert({
      reference: currentRef,
      client_id: clientId,
      type_intervention: typeIntervention || null,
      adresse_chantier: clientAdresse || null,
      ville: ville || null,
      code_postal: codePostal || null,
      date_realisee: dateIntervention || null,
      statut: 'terminee',
      transcription: transcription || null,
      rapport_json: rapport,
      seo_json: seo || null,
    }).select('id').single()
    if (!error && data?.id) {
      return NextResponse.json({ ok: true, id: data.id, mode: 'insert' })
    }
    if (error?.code === '23505' && currentRef) {
      const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
      currentRef = `${baseRef}-${suffix}`
      continue
    }
    return NextResponse.json({ error: error?.message || 'Erreur insertion' }, { status: 500 })
  }
  return NextResponse.json({
    error: 'Référence en collision après 5 tentatives',
  }, { status: 500 })
}

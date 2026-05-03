import { NextRequest, NextResponse } from "next/server"
import { saveDocument, upsertClient } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const {
    devis, clientNom, clientEmail, clientAdresse, clientCP, ville,
    agence, numero, totalHT, totalTTC, tvaTaux, validiteJours,
  } = body || {}

  if (!devis || typeof devis !== 'object') {
    return NextResponse.json({ error: 'Champ devis manquant' }, { status: 400 })
  }

  try {
    const clientId = await upsertClient({
      nom: clientNom, email: clientEmail, adresse: clientAdresse,
      code_postal: clientCP, ville,
    })
    const id = await saveDocument({
      type: 'devis',
      numero: numero || devis?.numero || null,
      agence: agence || null,
      date_emission: devis?.date_devis || null,
      echeance: typeof validiteJours === 'number' ? `${validiteJours} jours` : null,
      statut: 'brouillon',
      montant_ht: typeof totalHT === 'number' ? totalHT : null,
      montant_ttc: typeof totalTTC === 'number' ? totalTTC : null,
      tva_taux: typeof tvaTaux === 'number' ? tvaTaux : null,
      payload: devis,
      client_id: clientId,
    })
    if (!id) {
      return NextResponse.json({
        error: "Sauvegarde impossible (Supabase non configuré ou erreur d'insertion)",
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur de sauvegarde' }, { status: 500 })
  }
}

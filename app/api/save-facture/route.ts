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
    facture, clientNom, clientEmail, clientAdresse, clientCP, ville,
    agence, numero, totalHT, totalTTC, tvaTaux, echeance,
  } = body || {}

  if (!facture || typeof facture !== 'object') {
    return NextResponse.json({ error: 'Champ facture manquant' }, { status: 400 })
  }

  try {
    const clientId = await upsertClient({
      nom: clientNom, email: clientEmail, adresse: clientAdresse,
      code_postal: clientCP, ville,
    })
    const id = await saveDocument({
      type: 'facture',
      numero: numero || facture?.numero || null,
      agence: agence || null,
      date_emission: facture?.date_facture || null,
      echeance: echeance || facture?.echeance || null,
      // Brouillon car non envoyé. Si déjà réglée → paye.
      statut: /^r[ée]gl[ée]e?$/i.test((echeance || facture?.echeance || '').trim()) ? 'paye' : 'brouillon',
      montant_ht: typeof totalHT === 'number' ? totalHT : null,
      montant_ttc: typeof totalTTC === 'number' ? totalTTC : null,
      tva_taux: typeof tvaTaux === 'number' ? tvaTaux : null,
      payload: facture,
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

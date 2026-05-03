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
    attestation, clientNom, clientEmail, clientAdresse, clientCP, ville,
    agence, numero, variante, dateAttestation,
  } = body || {}

  if (!attestation || typeof attestation !== 'object') {
    return NextResponse.json({ error: 'Champ attestation manquant' }, { status: 400 })
  }

  try {
    const clientId = await upsertClient({
      nom: clientNom, email: clientEmail, adresse: clientAdresse,
      code_postal: clientCP, ville,
    })
    const id = await saveDocument({
      type: 'attestation',
      numero: numero || attestation?.numero || null,
      agence: agence || null,
      date_emission: attestation?.date || dateAttestation || null,
      statut: 'brouillon',
      payload: { ...(attestation || {}), variante: variante || attestation?.variante || null },
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

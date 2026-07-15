import { NextRequest, NextResponse } from "next/server"
import { persistAttestation, type PersistAttestationInput } from "@/lib/persist"
import { errorMessage } from "@/lib/error-message"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: Partial<PersistAttestationInput>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body?.attestation || typeof body.attestation !== 'object') {
    return NextResponse.json({ error: 'Champ attestation manquant' }, { status: 400 })
  }

  try {
    const id = await persistAttestation({ ...body, attestation: body.attestation, emailSent: false })
    if (!id) {
      return NextResponse.json({
        error: "Sauvegarde impossible (Supabase non configuré ou erreur d'insertion)",
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || 'Erreur de sauvegarde' }, { status: 500 })
  }
}

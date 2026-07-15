import { NextRequest, NextResponse } from "next/server"
import { persistFacture, type PersistFactureInput } from "@/lib/persist"
import { errorMessage } from "@/lib/error-message"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: Partial<PersistFactureInput>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body?.facture || typeof body.facture !== 'object') {
    return NextResponse.json({ error: 'Champ facture manquant' }, { status: 400 })
  }

  try {
    const id = await persistFacture({ ...body, facture: body.facture, emailSent: false })
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

import { NextRequest, NextResponse } from "next/server"
import { persistDevis, type PersistDevisInput } from "@/lib/persist"
import { errorMessage } from "@/lib/error-message"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: Partial<PersistDevisInput>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body?.devis || typeof body.devis !== 'object') {
    return NextResponse.json({ error: 'Champ devis manquant' }, { status: 400 })
  }

  try {
    const id = await persistDevis({ ...body, devis: body.devis, emailSent: false })
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

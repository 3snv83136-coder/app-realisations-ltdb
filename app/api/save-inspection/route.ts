import { NextRequest, NextResponse } from "next/server"
import { persistInspection, type PersistInspectionInput } from "@/lib/persist"
import { errorMessage } from "@/lib/error-message"

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: Partial<PersistInspectionInput>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body?.inspection || typeof body.inspection !== 'object') {
    return NextResponse.json({ error: 'Champ inspection manquant' }, { status: 400 })
  }

  const numero = body.inspection.numero || body.numero
  if (!numero || typeof numero !== 'string') {
    return NextResponse.json({ error: 'Numéro de rapport manquant' }, { status: 400 })
  }

  const clientNom = body.clientNom || body.inspection.client?.nom
  if (!clientNom || typeof clientNom !== 'string' || !clientNom.trim()) {
    return NextResponse.json({ error: 'Nom client manquant' }, { status: 400 })
  }

  try {
    const id = await persistInspection({
      ...body,
      inspection: body.inspection as PersistInspectionInput['inspection'],
      emailSent: false,
    })
    if (!id) {
      return NextResponse.json({
        error: "Sauvegarde impossible (Supabase non configuré, contrainte type non migrée, ou erreur d'insertion)",
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || 'Erreur de sauvegarde' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"
import { allocateNumero, type DocSequenceType } from "@/lib/numero"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"

/**
 * Alloue un numéro séquentiel (facture/devis) pour les flux qui génèrent le PDF
 * côté navigateur. Le numéro est figé ici (atomique) avant la construction du
 * PDF, garantissant que le PDF et la DB portent le même numéro.
 *
 * POST { type: "facture" | "devis" } → { numero: "FA-2026-0001" }
 */
export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { type?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body JSON attendu" }, { status: 400 })
  }

  const type = body.type
  if (type !== "facture" && type !== "devis") {
    return NextResponse.json({ error: 'type doit être "facture" ou "devis"' }, { status: 400 })
  }

  try {
    const numero = await allocateNumero(sb, type as DocSequenceType)
    return NextResponse.json({ numero })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "Allocation impossible" }, { status: 500 })
  }
}

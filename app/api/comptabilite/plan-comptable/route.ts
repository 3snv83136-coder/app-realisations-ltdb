import { NextResponse } from "next/server"
import { COMPTES_AFFECTABLES, GROUPE_LABELS } from "@/lib/compta-plan"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    comptes: COMPTES_AFFECTABLES,
    groupes: GROUPE_LABELS,
  })
}

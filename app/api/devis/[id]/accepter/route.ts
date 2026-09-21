import { NextRequest, NextResponse } from "next/server"
import { accepterDevis } from "@/lib/devis-accepter"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { id: string } }

/**
 * Marque un devis comme accepté :
 *  1. stoppe toutes les relances encore planifiées,
 *  2. crée l'intervention planning si elle n'existe pas,
 *  3. passe le statut du document à "accepte".
 */
export async function POST(req: NextRequest, { params }: Params) {
  const result = await accepterDevis(params.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result)
}

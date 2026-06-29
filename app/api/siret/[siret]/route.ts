import { NextRequest, NextResponse } from "next/server"
import { cleanSiret, isSiretShape, lookupSiret } from "@/lib/siret"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Recherche d'entreprise par SIRET via l'API publique recherche-entreprises.api.gouv.fr
 * (pas de clé requise). Renvoie raison sociale + adresse + activité.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { siret: string } },
) {
  const siret = cleanSiret(params.siret)
  if (!isSiretShape(siret)) {
    return NextResponse.json({ error: "SIRET invalide (14 chiffres attendus)" }, { status: 400 })
  }

  try {
    const result = await lookupSiret(siret)
    if (!result) {
      return NextResponse.json({ error: "SIRET introuvable" }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({
      error: `API recherche-entreprises injoignable : ${msg}`,
    }, { status: 502 })
  }
}

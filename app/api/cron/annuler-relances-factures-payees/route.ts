import { NextRequest, NextResponse } from "next/server"
import { annulerRelancesToutesFacturesPayees } from "@/lib/facture-relance"

export const dynamic = "force-dynamic"
export const maxDuration = 120

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  const auth = req.headers.get("authorization") || ""
  return auth === `Bearer ${secret}`
}

/** Rétroactif + filet de sécurité : stoppe les relances sur factures déjà payées. */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const result = await annulerRelancesToutesFacturesPayees()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  const auth = req.headers.get("authorization") || ""
  return auth === `Bearer ${secret}`
}

/** Anciennement : SMS avis Google planifiés. Désactivé — avis demandé sur place au téléphone. */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    disabled: true,
    message: "Relances SMS avis Google désactivées (demande manuelle sur place).",
    scanned: 0,
    sent: 0,
    errors: [] as string[],
  })
}

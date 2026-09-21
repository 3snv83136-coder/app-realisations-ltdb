import { NextRequest, NextResponse } from "next/server"
import { envoyerSmsAvisEchus } from "@/lib/avis-relance"
import { verifyCronAuth } from "@/lib/cron-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/** Envoie les SMS avis Google échus (mails déjà planifiés côté Resend). */
export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  try {
    const result = await envoyerSmsAvisEchus()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}

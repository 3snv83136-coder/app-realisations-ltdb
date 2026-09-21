import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { envoyerSmsAvisEchus } from "@/lib/avis-relance"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST /api/relances/avis/run-sms
 * Déclenche immédiatement l'envoi des SMS avis échus (même logique que le cron).
 * Réservé admin / gérant.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  if (session.user.role === "tech") {
    return NextResponse.json({ error: "Réservé au gérant" }, { status: 403 })
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

import { NextRequest, NextResponse } from "next/server"
import {
  getSessionUser,
  technicienFilterForSession,
} from "@/lib/intervention-access"
import { listPendingRelances } from "@/lib/relances-hub"

export const dynamic = "force-dynamic"

/** Liste des relances actives (avis, devis, factures), groupées par client. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const technicienId = technicienFilterForSession(user)
  const snapshot = await listPendingRelances(technicienId)

  return NextResponse.json({ ok: true, ...snapshot })
}

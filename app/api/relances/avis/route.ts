import { NextResponse } from "next/server"
import {
  getSessionUser,
  technicienFilterForSession,
} from "@/lib/intervention-access"
import { listAvisGoogleRelances } from "@/lib/avis-relance"

export const dynamic = "force-dynamic"

/** Campagnes de relances avis Google (actives + historique SMS/mails). */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const technicienId = technicienFilterForSession(user)
  const snapshot = await listAvisGoogleRelances(technicienId)

  return NextResponse.json({ ok: true, ...snapshot })
}

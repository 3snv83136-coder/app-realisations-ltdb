import { NextRequest, NextResponse } from "next/server"
import {
  getSessionUser,
  technicienFilterForSession,
  assertInterventionAccess,
} from "@/lib/intervention-access"
import { annulerRelancesAvis, listAvisGoogleRelances } from "@/lib/avis-relance"

export const dynamic = "force-dynamic"

type StopBody =
  | { scope: "all" }
  | { scope: "item"; interventionId: string }

/** Arrête des relances avis Google (une intervention ou toutes les actives). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  let body: StopBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  if (!body?.scope || !["all", "item"].includes(body.scope)) {
    return NextResponse.json({ error: "scope invalide" }, { status: 400 })
  }

  const technicienId = technicienFilterForSession(user)
  const snapshot = await listAvisGoogleRelances(technicienId)
  const details: string[] = []
  let stopped = 0

  const targets =
    body.scope === "all"
      ? snapshot.campagnes.filter(c => c.active || c.pendingCount > 0)
      : snapshot.campagnes.filter(c => c.interventionId === body.interventionId)

  if (body.scope === "item") {
    if (!body.interventionId) {
      return NextResponse.json({ error: "interventionId requis" }, { status: 400 })
    }
    const access = await assertInterventionAccess(body.interventionId, user)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
  }

  for (const c of targets) {
    try {
      const r = await annulerRelancesAvis(c.interventionId)
      const n = r.emailsCanceled + r.smsCanceled
      stopped += n || c.pendingCount
      details.push(`${c.clientNom} (${c.reference}) : ${n} annulée(s)`)
    } catch (e) {
      details.push(`${c.clientNom} : ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, stopped, details })
}

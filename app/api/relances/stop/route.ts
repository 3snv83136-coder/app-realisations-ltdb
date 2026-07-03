import { NextRequest, NextResponse } from "next/server"
import {
  getSessionUser,
  technicienFilterForSession,
} from "@/lib/intervention-access"
import {
  listPendingRelances,
  stopRelances,
  type RelanceKind,
  type StopRelanceTarget,
} from "@/lib/relances-hub"

export const dynamic = "force-dynamic"

type StopBody =
  | { scope: "all" }
  | { scope: "client"; clientKey: string }
  | { scope: "item"; kind: RelanceKind; id: string }

/** Arrête des relances (un item, un client, ou tout). */
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

  if (!body?.scope || !["all", "client", "item"].includes(body.scope)) {
    return NextResponse.json({ error: "scope invalide" }, { status: 400 })
  }

  if (body.scope === "client" && !body.clientKey) {
    return NextResponse.json({ error: "clientKey requis" }, { status: 400 })
  }

  if (body.scope === "item" && (!body.kind || !body.id)) {
    return NextResponse.json({ error: "kind et id requis" }, { status: 400 })
  }

  const technicienId = technicienFilterForSession(user)
  const snapshot = await listPendingRelances(technicienId)

  let target: StopRelanceTarget
  if (body.scope === "all") {
    target = { scope: "all" }
  } else if (body.scope === "client") {
    target = { scope: "client", clientKey: body.clientKey }
  } else {
    target = { scope: "item", kind: body.kind, id: body.id }
  }

  const result = await stopRelances(target, snapshot)

  return NextResponse.json({
    ok: true,
    stopped: result.stopped,
    details: result.details,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { setParametre } from "@/lib/parametres"
import { requireAdminApi } from "@/lib/rh/require-admin"

export const dynamic = "force-dynamic"

/** Enregistre la fiche Google Business cible pour les publications. */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { locationPath?: string; label?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const locationPath = (body.locationPath || "").trim()
  if (!locationPath || !locationPath.includes("locations/")) {
    return NextResponse.json({ error: "locationPath invalide" }, { status: 400 })
  }

  const label = (body.label || "").trim()
  const r1 = await setParametre(
    "GMB_LOCATION",
    locationPath,
    "Chemin API Google Business (accounts/…/locations/…)",
  )
  if (!r1.ok) {
    return NextResponse.json({ error: r1.error || "Échec enregistrement" }, { status: 500 })
  }

  if (label) {
    await setParametre("GMB_LOCATION_LABEL", label, "Nom affiché de la fiche GMB")
  }

  return NextResponse.json({ ok: true, locationPath, label: label || null })
}

import { NextResponse } from "next/server"
import { getGmbConnectionStatus } from "@/lib/gmb"
import { getParametre } from "@/lib/parametres"
import { requireAdminApi } from "@/lib/rh/require-admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAdminApi()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const [status, locationPath, locationLabel] = await Promise.all([
      getGmbConnectionStatus(),
      getParametre("GMB_LOCATION", ""),
      getParametre("GMB_LOCATION_LABEL", ""),
    ])
    return NextResponse.json({
      ...status,
      locationPath: locationPath || null,
      locationLabel: locationLabel || null,
      ready: status.connected && !!locationPath,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur statut GMB" },
      { status: 500 },
    )
  }
}

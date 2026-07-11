import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getRecentConnexions } from "@/lib/connexions-log"

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "admin" || session.user.isDemo) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }
  const rows = await getRecentConnexions()
  return NextResponse.json({ rows })
}

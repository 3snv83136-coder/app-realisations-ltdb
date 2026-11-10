import { NextResponse } from "next/server"
import { getLinkedInAuthUrl } from "@/lib/social"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.redirect(getLinkedInAuthUrl())
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "OAuth LinkedIn init failed" }, { status: 500 })
  }
}

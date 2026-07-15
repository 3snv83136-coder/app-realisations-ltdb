import { NextResponse } from "next/server"
import { getFacebookAuthUrl } from "@/lib/social"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.redirect(getFacebookAuthUrl())
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "OAuth Facebook init failed" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getTikTokAuthUrl } from "@/lib/social"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.redirect(getTikTokAuthUrl())
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "OAuth TikTok init failed" }, { status: 500 })
  }
}

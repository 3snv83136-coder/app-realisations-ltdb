import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/youtube"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const url = getAuthUrl()
    return NextResponse.redirect(url)
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "OAuth init failed" }, { status: 500 })
  }
}

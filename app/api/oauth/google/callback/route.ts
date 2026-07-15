import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeAndStore } from "@/lib/youtube"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  if (error) {
    return NextResponse.redirect(new URL(`/?youtube_oauth=error&reason=${encodeURIComponent(error)}`, req.url))
  }
  if (!code) {
    return NextResponse.json({ error: "Code OAuth manquant" }, { status: 400 })
  }
  try {
    const { email } = await exchangeCodeAndStore(code)
    const target = new URL("/", req.url)
    target.searchParams.set("youtube_oauth", "ok")
    if (email) target.searchParams.set("email", email)
    return NextResponse.redirect(target)
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "OAuth callback failed" }, { status: 500 })
  }
}

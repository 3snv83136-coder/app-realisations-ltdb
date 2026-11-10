import { NextRequest, NextResponse } from "next/server"
import { exchangeLinkedInCode } from "@/lib/social"
import { errorMessage } from "@/lib/error-message"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const error = req.nextUrl.searchParams.get("error")
  if (error) {
    return NextResponse.redirect(new URL(`/?linkedin_oauth=error&reason=${encodeURIComponent(error)}`, req.url))
  }
  if (!code) {
    return NextResponse.json({ error: "Code OAuth manquant" }, { status: 400 })
  }
  try {
    await exchangeLinkedInCode(code)
    const target = new URL("/articles", req.url)
    target.searchParams.set("linkedin_oauth", "ok")
    return NextResponse.redirect(target)
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) || "OAuth LinkedIn callback failed" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { PAGES_JAUNES_REVIEW_URL } from "@/lib/review-url"

/** Redirection courte → formulaire avis Pages Jaunes. */
export function GET() {
  return NextResponse.redirect(PAGES_JAUNES_REVIEW_URL, 302)
}

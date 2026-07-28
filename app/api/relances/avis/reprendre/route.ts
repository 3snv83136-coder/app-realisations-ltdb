import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import {
  getSessionUser,
  assertInterventionAccess,
} from "@/lib/intervention-access"
import { reprendreRelancesAvis } from "@/lib/avis-relance"
import { getResendFromEmail } from "@/lib/email-utils"
import { getGoogleReviewUrl } from "@/lib/review-url"
import { getTelPrincipal } from "@/lib/parametres"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function getBaseUrl(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (env) return env.replace(/\/+$/, "")
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") || "https"
  return host ? `${proto}://${host}` : "https://app-realisations-ltdb.vercel.app"
}

/** Reprend / continue les relances avis Google d'une intervention. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  let body: { interventionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = body.interventionId?.trim()
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId requis" }, { status: 400 })
  }

  const access = await assertInterventionAccess(interventionId, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY manquant" }, { status: 500 })
  }

  const [reviewUrl, tel] = await Promise.all([getGoogleReviewUrl(), getTelPrincipal()])
  const signSecret =
    process.env.REVIEW_STOP_SECRET
    || process.env.NEXTAUTH_SECRET
    || process.env.RESEND_API_KEY
    || ""

  const result = await reprendreRelancesAvis(interventionId, {
    resend: new Resend(resendKey),
    fromEmail: getResendFromEmail(),
    baseUrl: getBaseUrl(req),
    reviewUrl,
    tel,
    signSecret,
    technicienNom: user.login || undefined,
  })

  if (result.resumed === 0 && result.errors.length > 0) {
    return NextResponse.json({
      error: result.errors[0],
      errors: result.errors,
    }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    resumed: result.resumed,
    errors: result.errors,
  })
}

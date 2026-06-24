import { NextRequest, NextResponse } from "next/server"
import { buildReviewOnlySmsText, getGoogleReviewUrl } from "@/lib/review-url"
import { getTelPrincipal } from "@/lib/parametres"
import { normalizePhoneForSmsUri } from "@/lib/sms"

/** Prépare un SMS court avec uniquement le lien avis Google (sans PDF). */
export async function POST(req: NextRequest) {
  let body: { clientPhone?: string; clientNom?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const clientPhone = (body.clientPhone || "").trim()
  if (!clientPhone || !normalizePhoneForSmsUri(clientPhone)) {
    return NextResponse.json({ error: "Numéro de téléphone client invalide" }, { status: 400 })
  }

  const [reviewUrl, tel] = await Promise.all([getGoogleReviewUrl(), getTelPrincipal()])
  const smsBody = buildReviewOnlySmsText({
    clientNom: body.clientNom,
    reviewUrl,
    tel,
  })

  return NextResponse.json({ body: smsBody, reviewUrl })
}

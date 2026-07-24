import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildReviewOnlySmsText, getGoogleReviewUrl } from "@/lib/review-url"
import { getTelPrincipal } from "@/lib/parametres"
import { normalizePhoneForSmsUri } from "@/lib/sms"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Envoi direct d’un SMS « lien avis Google » (sans intervention liée).
 * Utilisé depuis l’accueil pour un envoi immédiat.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  if (!isSmsConfigured()) {
    return NextResponse.json(
      { error: "SMS non configuré : ajoute BREVO_API_KEY (+ BREVO_SMS_SENDER) sur Vercel." },
      { status: 400 },
    )
  }

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
  const message = buildReviewOnlySmsText({
    clientNom: body.clientNom,
    reviewUrl,
    tel,
  })

  const r = await sendSms({ to: clientPhone, content: message })
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    messageId: r.messageId,
    provider: r.provider,
  })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { buildReviewOnlySmsText, getGoogleReviewUrl } from "@/lib/review-url"
import { getTelPrincipal } from "@/lib/parametres"
import { normalizePhoneForSmsUri } from "@/lib/sms"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import { avisSmsProviderId, registerRelances } from "@/lib/relances-registry"
import { getBrevoSender, toBrevoRecipient } from "@/lib/sms-brevo"

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
  const e164 = normalizePhoneForSmsUri(clientPhone)
  if (!clientPhone || !e164) {
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

  const nowIso = new Date().toISOString()
  const recipient = toBrevoRecipient(clientPhone) || e164
  try {
    await registerRelances([{
      kind: "avis",
      sourceType: "dashboard_avis_sms",
      sourceId: `dashboard:${nowIso}:${recipient}`,
      providerId: avisSmsProviderId(`dashboard-${recipient}`, 0, nowIso),
      channel: "sms",
      sendAt: nowIso,
      status: "sent",
      clientNom: body.clientNom?.trim() || null,
      clientEmail: null,
      label: "Avis Google — SMS dashboard",
      href: "/mail",
      metadata: {
        day: 0,
        phone: recipient,
        manual: true,
        dashboard: true,
        messageId: r.messageId ?? null,
        provider: r.provider,
        sender: getBrevoSender(),
      },
    }])
  } catch (e) {
    console.error("[review-sms] journal", e)
  }

  return NextResponse.json({
    ok: true,
    messageId: r.messageId,
    provider: r.provider,
    to: e164,
    toDigits: recipient,
    sender: getBrevoSender(),
  })
}

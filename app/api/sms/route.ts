import { NextRequest, NextResponse } from "next/server"
import { isSmsConfigured, sendSms, smsProviderName } from "@/lib/sms-provider"

export const dynamic = "force-dynamic"
export const maxDuration = 20

/** État de configuration (pour afficher/masquer les boutons SMS côté UI). */
export async function GET() {
  return NextResponse.json({
    configured: isSmsConfigured(),
    provider: smsProviderName(),
  })
}

/** Envoi d'un SMS. Body : { to: string, message: string } */
export async function POST(req: NextRequest) {
  if (!isSmsConfigured()) {
    return NextResponse.json(
      { error: "SMS non configuré : ajoute BREVO_API_KEY (+ BREVO_SMS_SENDER) ou Twilio sur Vercel." },
      { status: 400 },
    )
  }

  let body: { to?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const to = (body.to || "").trim()
  const message = (body.message || "").trim()
  if (!to || !message) {
    return NextResponse.json({ error: "Champs requis : to, message" }, { status: 400 })
  }

  const r = await sendSms({ to, content: message })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true, messageId: r.messageId, provider: r.provider })
}

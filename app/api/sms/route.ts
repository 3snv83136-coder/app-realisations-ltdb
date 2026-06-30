import { NextRequest, NextResponse } from "next/server"
import { isTwilioSmsConfigured, sendSmsTwilio } from "@/lib/sms-twilio"

export const dynamic = "force-dynamic"
export const maxDuration = 20

/** État de configuration (pour afficher/masquer les boutons SMS côté UI). */
export async function GET() {
  return NextResponse.json({ configured: isTwilioSmsConfigured() })
}

/** Envoi d'un SMS. Body : { to: string, message: string } */
export async function POST(req: NextRequest) {
  if (!isTwilioSmsConfigured()) {
    return NextResponse.json(
      { error: "SMS non configuré : ajoute TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM sur Vercel." },
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

  const r = await sendSmsTwilio({ to, content: message })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 })
  return NextResponse.json({ ok: true, messageId: r.messageId, status: r.status })
}

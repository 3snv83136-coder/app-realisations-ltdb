import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { auth } from "@/lib/auth"
import { getResendFromEmail } from "@/lib/email-utils"
import { envoyerAvisManuel } from "@/lib/avis-relance"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * POST /api/relances/avis/envoyer
 * Envoi manuel immédiat d'un avis Google (mail ou SMS) pour une intervention.
 * Body: { interventionId, channel: 'email'|'sms', email?, phone? }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  let body: {
    interventionId?: string
    channel?: string
    email?: string
    phone?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = (body.interventionId || "").trim()
  const channel = body.channel === "sms" ? "sms" : body.channel === "email" ? "email" : null
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId manquant" }, { status: 400 })
  }
  if (!channel) {
    return NextResponse.json({ error: "channel invalide (email | sms)" }, { status: 400 })
  }

  if (channel === "email") {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: "RESEND_API_KEY manquante" }, { status: 500 })
    }
    const result = await envoyerAvisManuel({
      interventionId,
      channel: "email",
      email: body.email || null,
      resend: new Resend(resendKey),
      fromEmail: getResendFromEmail(),
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true, channel, messageId: result.messageId, provider: result.provider })
  }

  const result = await envoyerAvisManuel({
    interventionId,
    channel: "sms",
    phone: body.phone || null,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true, channel, messageId: result.messageId, provider: result.provider })
}

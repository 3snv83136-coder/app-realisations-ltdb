import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { buildReviewOnlySmsText, getGoogleReviewUrl } from "@/lib/review-url"
import { getTelPrincipal } from "@/lib/parametres"
import { normalizePhoneForSmsUri } from "@/lib/sms"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import { getSupabaseOrNull, patchClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { id: string } }

/** Envoie immédiatement un SMS « lien avis Google » via Brevo (ou Twilio en repli). */
export async function POST(req: NextRequest, { params }: Params) {
  const interventionId = params.id
  if (!interventionId) {
    return NextResponse.json({ error: "ID intervention manquant" }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
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

  const sb = getSupabaseOrNull()
  if (sb) {
    const { data: interv } = await sb
      .from("interventions")
      .select("client_id")
      .eq("id", interventionId)
      .maybeSingle()
    if (interv?.client_id) {
      await patchClient(interv.client_id as string, {
        ...(body.clientNom?.trim() ? { nom: body.clientNom.trim() } : {}),
        telephone: clientPhone,
      })
    }
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

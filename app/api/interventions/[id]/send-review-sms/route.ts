import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { buildReviewOnlySmsText, getGoogleReviewUrl } from "@/lib/review-url"
import { getTelPrincipal } from "@/lib/parametres"
import { normalizePhoneForSmsUri } from "@/lib/sms"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import { getSupabaseOrNull, patchClient } from "@/lib/supabase"
import { avisSmsProviderId, registerRelances } from "@/lib/relances-registry"
import { getBrevoSender, toBrevoRecipient } from "@/lib/sms-brevo"

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
  const e164 = normalizePhoneForSmsUri(clientPhone)
  if (!clientPhone || !e164) {
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

  const nowIso = new Date().toISOString()
  const recipient = toBrevoRecipient(clientPhone) || e164
  try {
    await registerRelances([{
      kind: "avis",
      sourceType: "intervention_avis",
      sourceId: interventionId,
      providerId: avisSmsProviderId(interventionId, 0, nowIso),
      channel: "sms",
      sendAt: nowIso,
      status: "sent",
      clientNom: body.clientNom?.trim() || null,
      label: "Avis Google — SMS manuel",
      interventionId,
      href: `/intervention/${interventionId}`,
      metadata: {
        day: 0,
        phone: recipient,
        manual: true,
        messageId: r.messageId ?? null,
        provider: r.provider,
        sender: getBrevoSender(),
      },
    }])
  } catch (e) {
    console.error("[send-review-sms] journal", e)
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

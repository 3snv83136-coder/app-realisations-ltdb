import crypto from "crypto"
import type { Resend } from "resend"
import { escapeHtml } from "@/lib/email-utils"
import { getSupabaseOrNull } from "@/lib/supabase"
import { buildReviewOnlySmsText } from "@/lib/review-url"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import {
  AVIS_RELANCE_PLAN,
  parseAvisSmsPlan,
  type AvisSmsPlanItem,
} from "@/lib/avis-relance-utils"

export { AVIS_RELANCE_PLAN, parseAvisSmsPlan, countAvisRelancesPendantes } from "@/lib/avis-relance-utils"
export type { AvisSmsPlanItem } from "@/lib/avis-relance-utils"

function signStopPayload(payload: string, exp: number, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${payload}.${exp}`).digest("hex")
}

export function buildAvisStopUrl(
  baseUrl: string,
  emailIds: string[],
  interventionId: string,
  secret: string,
): string {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(
    JSON.stringify({ ids: emailIds, interventionId, kind: "avis" }),
    "utf-8",
  ).toString("base64url")
  const sig = signStopPayload(payload, exp, secret)
  return `${baseUrl.replace(/\/+$/, "")}/api/notify-client/stop-review?p=${encodeURIComponent(payload)}&exp=${exp}&sig=${sig}`
}

function relanceSubject(jour: number, prenom: string): string {
  if (jour === 2) return `${prenom}, tout est rentré dans l'ordre ?`
  return `Dernière chance — partagez votre expérience`
}

function emailRelanceAvis(opts: {
  clientNom: string
  technicienNom: string
  ville: string
  reviewUrl: string
  jour: number
  tel: string
  stopUrl?: string
}): string {
  const cn = escapeHtml(opts.clientNom || "Madame, Monsieur")
  const tn = escapeHtml(opts.technicienNom)
  const v = escapeHtml(opts.ville)
  const ru = encodeURI(opts.reviewUrl)
  const su = opts.stopUrl ? encodeURI(opts.stopUrl) : ""
  const accroche = opts.jour === 2
    ? `Nous espérons que tout est rentré dans l'ordre depuis notre intervention${v ? ` à ${v}` : ""}.`
    : `Nous ne voudrions pas vous solliciter davantage — c'est la dernière fois.`

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
<tr><td style="background:#0e2a52;padding:24px;color:#fff;text-align:center">
<div style="font-size:36px">⭐⭐⭐⭐⭐</div>
<h1 style="margin:10px 0 0;font-size:20px">Votre avis compte pour nous</h1>
</td></tr>
<tr><td style="padding:30px;color:#1a1a1a">
<p>Bonjour ${cn},</p>
<p>${accroche}</p>
<p>Une petite étoile prend moins d'<strong>une minute</strong> et nous aide énormément.</p>
<div style="text-align:center;margin:30px 0">
<a href="${ru}" style="display:inline-block;background:#e67e22;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:15px">⭐ Laisser un avis sur Google</a>
</div>
<p style="font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong><br>Les Techniciens du Débouchage · ${escapeHtml(opts.tel)}</p>
${su ? `<p style="margin-top:16px;font-size:12px;color:#64748b">Vous avez déjà laissé un avis ? <a href="${su}" style="color:#2c5fa8">Cliquez ici pour ne plus recevoir de relance</a>.</p>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

function smsRelanceText(opts: {
  clientNom?: string
  reviewUrl: string
  tel: string
  day: number
}): string {
  const base = buildReviewOnlySmsText({
    clientNom: opts.clientNom,
    reviewUrl: opts.reviewUrl,
    tel: opts.tel,
  })
  if (opts.day === 4) {
    return base.replace(
      "Si vous etes satisfait",
      "Petit rappel : si vous etes satisfait",
    )
  }
  return base
}

export type PlanifierAvisRelancesInput = {
  interventionId: string
  baseUrl: string
  resend: Resend
  fromEmail: string
  recipient: string
  clientPhone?: string | null
  clientNom?: string
  technicienNom: string
  ville?: string
  reviewUrl: string
  tel: string
  signSecret: string
  anchorAt?: string
}

export type PlanifierAvisRelancesResult = {
  emailIds: string[]
  smsPlanned: number
  errors: string[]
  stopUrl: string
}

export async function planifierAvisRelances(
  input: PlanifierAvisRelancesInput,
): Promise<PlanifierAvisRelancesResult> {
  const anchor = input.anchorAt ? new Date(input.anchorAt) : new Date()
  const emailIds: string[] = []
  const errors: string[] = []
  const smsPlan: AvisSmsPlanItem[] = []
  const phone = (input.clientPhone || "").trim()
  const prenom = (input.clientNom || "Client").split(" ").slice(-1)[0]
  const stopUrl = buildAvisStopUrl(input.baseUrl, [], input.interventionId, input.signSecret)

  for (const step of AVIS_RELANCE_PLAN) {
    const sendAt = new Date(anchor.getTime() + step.day * 24 * 60 * 60 * 1000)

    if (step.channel === "email") {
      try {
        const r = await input.resend.emails.send({
          from: `Les Techniciens du Débouchage <${input.fromEmail}>`,
          to: input.recipient,
          subject: relanceSubject(step.day, prenom),
          html: emailRelanceAvis({
            clientNom: input.clientNom || "",
            technicienNom: input.technicienNom,
            ville: input.ville || "",
            reviewUrl: input.reviewUrl,
            jour: step.day,
            tel: input.tel,
            stopUrl,
          }),
          scheduledAt: sendAt.toISOString(),
        })
        if (r.data?.id) emailIds.push(r.data.id)
        if (r.error) errors.push(`J+${step.day} mail: ${r.error.message || "erreur"}`)
      } catch (e) {
        errors.push(`J+${step.day} mail: ${e instanceof Error ? e.message : String(e)}`)
      }
    } else if (phone.replace(/\D/g, "").length < 10) {
      errors.push(`J+${step.day} SMS ignoré : numéro client manquant`)
    } else if (!isSmsConfigured()) {
      errors.push(`J+${step.day} SMS ignoré : Brevo/Twilio non configuré`)
    } else {
      smsPlan.push({
        day: step.day,
        send_at: sendAt.toISOString(),
        phone,
        message: smsRelanceText({
          clientNom: input.clientNom,
          reviewUrl: input.reviewUrl,
          tel: input.tel,
          day: step.day,
        }),
        sent: false,
        canceled: false,
      })
    }
  }

  const sb = getSupabaseOrNull()
  if (sb) {
    try {
      await sb
        .from("interventions")
        .update({
          avis_relance_ids: emailIds,
          avis_sms_plan: smsPlan,
        })
        .eq("id", input.interventionId)
    } catch {
      /* colonne avis_sms_plan absente si migration non appliquée */
    }
  }

  return {
    emailIds,
    smsPlanned: smsPlan.length,
    errors,
    stopUrl,
  }
}

/** Annule relances avis (mails Resend + SMS planifiés) pour une intervention. */
export async function annulerRelancesAvis(interventionId: string): Promise<{
  emailsCanceled: number
  smsCanceled: number
}> {
  const sb = getSupabaseOrNull()
  if (!sb) return { emailsCanceled: 0, smsCanceled: 0 }

  const { data: interv } = await sb
    .from("interventions")
    .select("avis_relance_ids, avis_sms_plan")
    .eq("id", interventionId)
    .maybeSingle()

  const emailIds = Array.isArray(interv?.avis_relance_ids)
    ? (interv.avis_relance_ids as string[]).filter(Boolean)
    : []

  let emailsCanceled = 0
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey && emailIds.length > 0) {
    const { Resend } = await import("resend")
    const resend = new Resend(resendKey)
    for (const id of emailIds) {
      try {
        const r = await resend.emails.cancel(id)
        if (!r.error) emailsCanceled++
      } catch { /* ignore */ }
    }
  }

  const plan = parseAvisSmsPlan(interv?.avis_sms_plan)
  let smsCanceled = 0
  const updatedPlan = plan.map(item => {
    if (!item.sent && !item.canceled) {
      smsCanceled++
      return { ...item, canceled: true }
    }
    return item
  })

  await sb
    .from("interventions")
    .update({
      avis_relance_ids: [],
      avis_sms_plan: updatedPlan,
      avis_recu: true,
    })
    .eq("id", interventionId)

  return { emailsCanceled, smsCanceled }
}

/** Envoie les SMS avis dont la date est échue (cron). */
export async function envoyerSmsAvisEchus(): Promise<{
  scanned: number
  sent: number
  errors: string[]
}> {
  const sb = getSupabaseOrNull()
  if (!sb) return { scanned: 0, sent: 0, errors: ["Supabase non configuré"] }

  const { data: rows, error } = await sb
    .from("interventions")
    .select("id, avis_sms_plan, avis_recu")
    .eq("avis_recu", false)

  if (error) return { scanned: 0, sent: 0, errors: [error.message] }

  const now = Date.now()
  let sent = 0
  const errors: string[] = []
  let scanned = 0

  for (const row of rows || []) {
    const plan = parseAvisSmsPlan(row.avis_sms_plan)
    if (plan.length === 0) continue

    let changed = false
    const updated = [...plan]

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i]
      if (item.sent || item.canceled) continue
      if (new Date(item.send_at).getTime() > now) continue
      scanned++

      if (row.avis_recu) {
        updated[i] = { ...item, canceled: true }
        changed = true
        continue
      }

      const r = await sendSms({ to: item.phone, content: item.message })
      if (r.ok) {
        updated[i] = {
          ...item,
          sent: true,
          sent_at: new Date().toISOString(),
          provider: r.provider,
          message_id: r.messageId ?? null,
        }
        sent++
        changed = true
      } else {
        errors.push(`${row.id} J+${item.day}: ${r.error}`)
      }
    }

    if (changed) {
      await sb.from("interventions").update({ avis_sms_plan: updated }).eq("id", row.id)
    }
  }

  return { scanned, sent, errors }
}

import crypto from "crypto"
import type { Resend } from "resend"
import { escapeHtml } from "@/lib/email-utils"
import { getSupabaseOrNull } from "@/lib/supabase"
import { buildReviewOnlySmsText } from "@/lib/review-url"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import {
  AVIS_RELANCE_PLAN,
  avisItemChannel,
  buildAvisEnvoisTimeline,
  parseAvisSmsPlan,
  type AvisEnvoiHistoriqueItem,
  type AvisSmsPlanItem,
} from "@/lib/avis-relance-utils"

export {
  AVIS_RELANCE_PLAN,
  parseAvisSmsPlan,
  countAvisRelancesPendantes,
  buildAvisEnvoisTimeline,
} from "@/lib/avis-relance-utils"
export type { AvisSmsPlanItem, AvisEnvoiHistoriqueItem } from "@/lib/avis-relance-utils"

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
  if (jour === 1) return `${prenom}, votre avis nous aide beaucoup`
  if (jour === 4) return `${prenom}, tout est rentré dans l'ordre ?`
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
  const accroche = opts.jour === 1
    ? `Suite à notre intervention${v ? ` à ${v}` : ""}, nous serions ravis de connaître votre ressenti.`
    : opts.jour === 4
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
  void opts.day
  return buildReviewOnlySmsText({
    clientNom: opts.clientNom,
    reviewUrl: opts.reviewUrl,
    tel: opts.tel,
  })
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
        smsPlan.push({
          day: step.day,
          channel: "email",
          send_at: sendAt.toISOString(),
          phone: "",
          email: input.recipient,
          message: relanceSubject(step.day, prenom),
          resend_id: r.data?.id || null,
          sent: false,
          canceled: false,
        })
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
        channel: "sms",
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
    smsPlanned: smsPlan.filter((x) => (x.channel || "sms") === "sms").length,
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
      if (item.channel !== "email") smsCanceled++
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

/** Envoie les SMS avis dont la date est échue (cron) ; marque les mails échus comme envoyés. */
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

      // Mails Resend : déjà planifiés côté Resend — on marque juste « envoyé » à échéance
      if (item.channel === "email") {
        updated[i] = {
          ...item,
          sent: true,
          sent_at: new Date().toISOString(),
          provider: "resend",
        }
        sent++
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

export type AvisGoogleCampagne = {
  interventionId: string
  reference: string
  clientNom: string
  clientEmail: string | null
  clientTelephone: string | null
  ville: string | null
  mailEnvoyeAt: string | null
  avisRecu: boolean
  active: boolean
  pendingCount: number
  sentCount: number
  canceledCount: number
  envois: AvisEnvoiHistoriqueItem[]
  href: string
}

export type AvisGoogleSnapshot = {
  campagnes: AvisGoogleCampagne[]
  totals: {
    actives: number
    arretees: number
    pending: number
    sent: number
  }
}

/** Liste les campagnes de relances avis Google (actives + historique). */
export async function listAvisGoogleRelances(
  technicienId: string | null,
): Promise<AvisGoogleSnapshot> {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return {
      campagnes: [],
      totals: { actives: 0, arretees: 0, pending: 0, sent: 0 },
    }
  }

  let query = sb
    .from("interventions")
    .select(
      "id, reference, ville, client_id, technicien_id, avis_recu, avis_relance_ids, avis_sms_plan, mail_envoye_at",
    )
    .order("mail_envoye_at", { ascending: false })
    .limit(150)

  if (technicienId) query = query.eq("technicien_id", technicienId)

  const { data: rows } = await query

  const clientIds = new Set<string>()
  for (const row of rows || []) {
    if (row.client_id) clientIds.add(row.client_id as string)
  }

  const clientMap = new Map<string, { nom: string; email: string | null; telephone: string | null }>()
  if (clientIds.size > 0) {
    const { data: clients } = await sb
      .from("clients")
      .select("id, nom, email, telephone")
      .in("id", Array.from(clientIds))
    for (const c of clients || []) {
      clientMap.set(c.id, {
        nom: c.nom || "Client",
        email: c.email || null,
        telephone: c.telephone || null,
      })
    }
  }

  const campagnes: AvisGoogleCampagne[] = []

  for (const row of rows || []) {
    const plan = parseAvisSmsPlan(row.avis_sms_plan)
    const emailIds = Array.isArray(row.avis_relance_ids)
      ? (row.avis_relance_ids as string[]).filter(Boolean)
      : []
    const hasActivity =
      plan.length > 0
      || emailIds.length > 0
      || !!row.mail_envoye_at
      || !!row.avis_recu

    if (!hasActivity) continue

    const client = row.client_id ? clientMap.get(row.client_id as string) : null
    const envois = buildAvisEnvoisTimeline(plan, emailIds)
    const pendingCount = envois.filter(e => e.status === "pending").length
    const sentCount = envois.filter(e => e.status === "sent").length
    const canceledCount = envois.filter(e => e.status === "canceled").length
    const avisRecu = !!row.avis_recu
    const active = !avisRecu && pendingCount > 0

    // Si aucune ligne d'envoi mais mail rapport envoyé → entrée minimale
    if (envois.length === 0 && row.mail_envoye_at) {
      envois.push({
        day: 0,
        channel: "email",
        sendAt: row.mail_envoye_at as string,
        status: "sent",
        sentAt: row.mail_envoye_at as string,
        destinataire: client?.email || null,
        label: "Mail rapport + facture (lien avis)",
      })
    }

    campagnes.push({
      interventionId: row.id as string,
      reference: (row.reference as string) || (row.id as string).slice(0, 8),
      clientNom: client?.nom || "Client",
      clientEmail: client?.email || null,
      clientTelephone: client?.telephone || null,
      ville: (row.ville as string) || null,
      mailEnvoyeAt: (row.mail_envoye_at as string) || null,
      avisRecu,
      active,
      pendingCount,
      sentCount: sentCount || (row.mail_envoye_at ? 1 : 0),
      canceledCount,
      envois,
      href: `/intervention/${row.id}`,
    })
  }

  // Actives d'abord, puis par date mail
  campagnes.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return (b.mailEnvoyeAt || "").localeCompare(a.mailEnvoyeAt || "")
  })

  return {
    campagnes,
    totals: {
      actives: campagnes.filter(c => c.active).length,
      arretees: campagnes.filter(c => c.avisRecu).length,
      pending: campagnes.reduce((s, c) => s + c.pendingCount, 0),
      sent: campagnes.reduce((s, c) => s + c.sentCount, 0),
    },
  }
}

export type ReprendreAvisDeps = {
  resend: Resend
  fromEmail: string
  baseUrl: string
  reviewUrl: string
  tel: string
  signSecret: string
  technicienNom?: string
}

/**
 * Reprend les relances avis stoppées : réactive les envois futurs annulés
 * (reprogramme les mails Resend) et remet avis_recu = false.
 */
export async function reprendreRelancesAvis(
  interventionId: string,
  deps: ReprendreAvisDeps,
): Promise<{ resumed: number; errors: string[] }> {
  const sb = getSupabaseOrNull()
  if (!sb) return { resumed: 0, errors: ["Supabase non configuré"] }

  const { data: interv } = await sb
    .from("interventions")
    .select("id, reference, ville, client_id, avis_sms_plan, avis_relance_ids, avis_recu")
    .eq("id", interventionId)
    .maybeSingle()

  if (!interv) return { resumed: 0, errors: ["Intervention introuvable"] }

  let clientNom = "Client"
  let clientEmail: string | null = null
  let clientPhone: string | null = null
  if (interv.client_id) {
    const { data: client } = await sb
      .from("clients")
      .select("nom, email, telephone")
      .eq("id", interv.client_id)
      .maybeSingle()
    if (client) {
      clientNom = client.nom || clientNom
      clientEmail = client.email || null
      clientPhone = client.telephone || null
    }
  }

  const plan = parseAvisSmsPlan(interv.avis_sms_plan)
  const now = Date.now()
  const errors: string[] = []
  let resumed = 0
  const emailIds: string[] = []
  const prenom = clientNom.split(" ").slice(-1)[0]
  const stopUrl = buildAvisStopUrl(deps.baseUrl, [], interventionId, deps.signSecret)
  const tech = deps.technicienNom || "votre technicien"

  const updated = [...plan]

  for (let i = 0; i < updated.length; i++) {
    const item = updated[i]
    if (item.sent) {
      if (item.channel === "email" && item.resend_id) emailIds.push(item.resend_id)
      continue
    }
    if (!item.canceled) {
      if (item.channel === "email" && item.resend_id) emailIds.push(item.resend_id)
      continue
    }
    // Annulé et déjà passé → on laisse annulé
    if (new Date(item.send_at).getTime() <= now) continue

    if (avisItemChannel(item) === "email") {
      const recipient = (item.email || clientEmail || "").trim()
      if (!recipient) {
        errors.push(`J+${item.day} mail : email client manquant`)
        continue
      }
      try {
        const r = await deps.resend.emails.send({
          from: `Les Techniciens du Débouchage <${deps.fromEmail}>`,
          to: recipient,
          subject: relanceSubject(item.day, prenom),
          html: emailRelanceAvis({
            clientNom,
            technicienNom: tech,
            ville: (interv.ville as string) || "",
            reviewUrl: deps.reviewUrl,
            jour: item.day,
            tel: deps.tel,
            stopUrl,
          }),
          scheduledAt: item.send_at,
        })
        if (r.error) {
          errors.push(`J+${item.day} mail : ${r.error.message || "erreur"}`)
          continue
        }
        const newId = r.data?.id || null
        if (newId) emailIds.push(newId)
        updated[i] = {
          ...item,
          canceled: false,
          email: recipient,
          resend_id: newId,
        }
        resumed++
      } catch (e) {
        errors.push(`J+${item.day} mail : ${e instanceof Error ? e.message : String(e)}`)
      }
    } else {
      updated[i] = { ...item, canceled: false }
      resumed++
    }
  }

  // Si plus rien à reprendre mais avis était stoppé → replanifier une nouvelle séquence
  if (resumed === 0 && interv.avis_recu) {
    const hasFuturePending = updated.some(
      x => !x.sent && !x.canceled && new Date(x.send_at).getTime() > now,
    )
    if (!hasFuturePending) {
      const recipient = (clientEmail || "").trim()
      if (!recipient && !(clientPhone || "").replace(/\D/g, "").length) {
        return {
          resumed: 0,
          errors: ["Impossible de reprendre : email et téléphone client manquants"],
        }
      }
      if (recipient) {
        const rel = await planifierAvisRelances({
          interventionId,
          baseUrl: deps.baseUrl,
          resend: deps.resend,
          fromEmail: deps.fromEmail,
          recipient,
          clientPhone,
          clientNom,
          technicienNom: tech,
          ville: (interv.ville as string) || "",
          reviewUrl: deps.reviewUrl,
          tel: deps.tel,
          signSecret: deps.signSecret,
        })
        await sb
          .from("interventions")
          .update({ avis_recu: false })
          .eq("id", interventionId)
        return {
          resumed: rel.emailIds.length + rel.smsPlanned,
          errors: [...errors, ...rel.errors],
        }
      }
    }
  }

  await sb
    .from("interventions")
    .update({
      avis_recu: false,
      avis_sms_plan: updated,
      avis_relance_ids: emailIds,
    })
    .eq("id", interventionId)

  return { resumed, errors }
}

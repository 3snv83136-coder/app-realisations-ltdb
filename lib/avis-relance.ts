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
  if (jour === 1) return `${prenom}, 30 secondes pour nous faire plaisir ⭐`
  if (jour === 4) return `${prenom}, tout va bien de votre côté ?`
  return `${prenom}, une dernière petite faveur…`
}

/** Contenu éditorial selon le jour de relance. */
function relanceCopy(jour: number, ville: string): { titre: string; accroche: string; cta: string } {
  const lieu = ville ? ` à ${ville}` : ""
  if (jour === 1) {
    return {
      titre: "Votre avis nous fait briller ✨",
      accroche: `Merci pour votre confiance${lieu} ! Si l’intervention vous a plu, un petit avis Google (moins d’<strong>une minute</strong>) nous aide énormément à continuer.`,
      cta: "⭐ Laisser 5 étoiles sur Google",
    }
  }
  if (jour === 4) {
    return {
      titre: "Tout est rentré dans l’ordre ?",
      accroche: `On espère que tout va parfaitement depuis notre passage${lieu}. Un petit mot sur Google, c’est le plus beau merci qu’on puisse recevoir.`,
      cta: "⭐ Partager mon expérience",
    }
  }
  return {
    titre: "Dernière petite demande",
    accroche: `On ne voudrait pas vous embêter — c’est vraiment la dernière fois. Si vous êtes satisfait${lieu ? ` de notre intervention${lieu}` : ""}, un avis Google change vraiment notre journée.`,
    cta: "⭐ Oui, je laisse mon avis",
  }
}

/**
 * Mail de relance avis Google — HTML email-safe (tables + styles inline).
 * Coloré, court, CTA dominant.
 */
export function buildEmailRelanceAvisHtml(opts: {
  clientNom: string
  technicienNom: string
  ville: string
  reviewUrl: string
  jour: number
  tel: string
  stopUrl?: string
}): string {
  const cn = escapeHtml(opts.clientNom || "Madame, Monsieur")
  const tn = escapeHtml(opts.technicienNom || "votre technicien")
  const vEsc = escapeHtml(opts.ville)
  const ru = encodeURI(opts.reviewUrl)
  const su = opts.stopUrl ? encodeURI(opts.stopUrl) : ""
  const tel = escapeHtml(opts.tel)
  const copy = relanceCopy(opts.jour, vEsc)
  const stepLabel =
    opts.jour === 1 ? "Relance 1/3" : opts.jour === 4 ? "Relance 2/3" : "Dernière relance"

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(copy.titre.replace(/[✨…]/g, "").trim()) || "Avis Google"}</title>
</head>
<body style="margin:0;padding:0;background:#eef3fb;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(14,42,82,0.12);">

<!-- Bandeau coloré -->
<tr>
<td style="background-color:#0e2a52;padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="height:6px;background-color:#f5c542;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td align="center" style="padding:28px 24px 10px;color:#ffffff;">
        <div style="display:inline-block;background-color:#1a4a8a;color:#ffe9a8;font-size:11px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;padding:6px 12px;border-radius:999px;margin-bottom:14px;">${escapeHtml(stepLabel)}</div>
        <div style="font-size:34px;letter-spacing:4px;line-height:1;margin:0 0 12px;">⭐⭐⭐⭐⭐</div>
        <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:800;color:#ffffff;">${escapeHtml(copy.titre)}</h1>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.45;color:#d7e6ff;">Les Techniciens du Débouchage</p>
      </td>
    </tr>
    <tr><td style="height:10px;background-color:#e67e22;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td>
</tr>

<!-- Corps -->
<tr>
<td style="padding:28px 28px 8px;color:#1a2433;">
  <p style="margin:0 0 14px;font-size:17px;line-height:1.45;">Bonjour <strong style="color:#0e2a52;">${cn}</strong>,</p>
  <p style="margin:0 0 18px;font-size:16px;line-height:1.55;color:#334155;">${copy.accroche}</p>

  <!-- Pastilles avantages -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    <tr>
      <td width="33%" valign="top" align="center" style="padding:12px 6px;background-color:#fff7e8;border-radius:12px;">
        <div style="font-size:20px;line-height:1;">⏱</div>
        <div style="font-size:12px;font-weight:bold;color:#9a5b00;margin-top:6px;">&lt; 1 minute</div>
      </td>
      <td width="1%" style="font-size:0;width:8px;">&nbsp;</td>
      <td width="33%" valign="top" align="center" style="padding:12px 6px;background-color:#e8f7ef;border-radius:12px;">
        <div style="font-size:20px;line-height:1;">😊</div>
        <div style="font-size:12px;font-weight:bold;color:#0f766e;margin-top:6px;">Super simple</div>
      </td>
      <td width="1%" style="font-size:0;width:8px;">&nbsp;</td>
      <td width="33%" valign="top" align="center" style="padding:12px 6px;background-color:#eaf0ff;border-radius:12px;">
        <div style="font-size:20px;line-height:1;">🚀</div>
        <div style="font-size:12px;font-weight:bold;color:#1d4ed8;margin-top:6px;">Ça nous booste</div>
      </td>
    </tr>
  </table>

  <!-- CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:6px 0 18px;">
        <a href="${ru}" style="display:inline-block;background-color:#e67e22;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;line-height:1.2;padding:16px 28px;border-radius:999px;">
          ${escapeHtml(copy.cta)}
        </a>
      </td>
    </tr>
  </table>

  <p style="margin:0 0 6px;text-align:center;font-size:12px;color:#94a3b8;">Un clic → Google → 5 étoiles. Merci infiniment 💛</p>
</td>
</tr>

<!-- Signature -->
<tr>
<td style="padding:8px 28px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
    <tr>
      <td style="padding:16px 18px;">
        <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">
          À très bientôt,<br>
          <strong style="color:#0e2a52;font-size:15px;">${tn}</strong><br>
          <span style="color:#64748b;">Les Techniciens du Débouchage</span>
          ${tel ? `<br><a href="tel:${tel.replace(/\s+/g, "")}" style="color:#e67e22;text-decoration:none;font-weight:bold;">${tel}</a>` : ""}
        </p>
      </td>
    </tr>
  </table>
</td>
</tr>

${su ? `<!-- Stop -->
<tr>
<td style="padding:0 28px 24px;text-align:center;">
  <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;">
    Déjà laissé un avis ? <a href="${su}" style="color:#64748b;text-decoration:underline;">Ne plus recevoir de relance</a>
  </p>
</td>
</tr>` : ""}

<!-- Pied -->
<tr>
<td style="background-color:#0e2a52;padding:14px 20px;text-align:center;">
  <p style="margin:0;font-size:11px;color:#9fb4d4;letter-spacing:0.04em;">LES TECHNICIENS DU DÉBOUCHAGE · AVIS GOOGLE</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

/** @deprecated alias — préférer buildEmailRelanceAvisHtml */
function emailRelanceAvis(opts: {
  clientNom: string
  technicienNom: string
  ville: string
  reviewUrl: string
  jour: number
  tel: string
  stopUrl?: string
}): string {
  return buildEmailRelanceAvisHtml(opts)
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

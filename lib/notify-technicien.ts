import { Resend } from "resend"
import { formatCreneau } from "@/lib/creneau"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { buildTechnicienInterventionSmsText } from "@/lib/notify-technicien-message"
import { getTelPrincipal } from "@/lib/parametres"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import { getSupabaseOrNull } from "@/lib/supabase"

function fmtDateFREmpty(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtEUREmpty(n: number) {
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export type NotifyTechnicienInput = {
  intervention_id: string
  technicien_email?: string | null
  technicien_nom?: string | null
  technicien_telephone?: string | null
  client_nom?: string | null
  client_telephone?: string | null
  client_email?: string | null
  adresse_chantier?: string | null
  ville?: string | null
  code_postal?: string | null
  date_prevue?: string | null
  heure_prevue?: string | null
  heure_fin_prevue?: string | null
  type_intervention?: string | null
  urgence?: boolean
  prix_prevu?: number | null
  notes_internes?: string | null
}

export type NotifyTechnicienResult = {
  ok: boolean
  mail_sent: boolean
  sms_sent: boolean
  skipped?: string
  error?: string
  mail_id?: string
  sms_error?: string
}

function emailTechHtml(p: {
  lien: string
  tel: string
  technicienNom: string
  clientNom?: string | null
  clientTelephone?: string | null
  clientEmail?: string | null
  adresseChantier?: string | null
  ville?: string | null
  codePostal?: string | null
  datePrevue?: string | null
  heurePrevue?: string | null
  heureFinPrevue?: string | null
  typeIntervention?: string | null
  urgence: boolean
  prixPrevu?: number | null
  notesInternes?: string | null
}): string {
  const tn = escapeHtml(p.technicienNom)
  const cn = escapeHtml(p.clientNom || '—')
  const tel = escapeHtml(p.clientTelephone || '')
  const cem = escapeHtml(p.clientEmail || '')
  const adr = escapeHtml(p.adresseChantier || '')
  const v = escapeHtml(p.ville || '')
  const cp = escapeHtml(p.codePostal || '')
  const dp = escapeHtml(fmtDateFREmpty(p.datePrevue))
  const creneau = escapeHtml(formatCreneau(p.heurePrevue, p.heureFinPrevue))
  const ti = escapeHtml(p.typeIntervention || 'Intervention')
  const prix = typeof p.prixPrevu === 'number' ? fmtEUREmpty(p.prixPrevu) : ''
  const notes = escapeHtml(p.notesInternes || '')
  const urgenceBanner = p.urgence
    ? `<div style="background:#fee2e2;color:#b91c1c;padding:14px 20px;font-weight:bold;text-align:center;letter-spacing:1px;text-transform:uppercase;font-size:13px">🚨 URGENT — À traiter en priorité</div>`
    : ''

  const adresseLigne = [adr, [cp, v].filter(Boolean).join(' ')].filter(Boolean).join(' — ')
  const mapsHref = adresseLigne
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([adr, cp, v].filter(Boolean).join(' '))}`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Nouvelle intervention</div>
        <h1 style="margin:0;font-size:22px">${ti}${v ? ` — ${v}` : ''}</h1>
        ${dp ? `<p style="margin:6px 0 0;opacity:.9;font-size:13px">${dp}${creneau ? ` · ${creneau}` : ''}</p>` : ''}
      </td></tr>
      ${urgenceBanner}
      <tr><td style="padding:30px">
        <p>Bonjour ${tn},</p>
        <p>Une nouvelle intervention t&rsquo;est assignée. Voici les détails :</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:14px">
          <tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;width:140px">Type</td>
              <td style="padding:10px 16px;font-weight:bold;color:#0e2a52">${ti}</td></tr>
          ${dp ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Date</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">${dp}${creneau ? ` — ${creneau}` : ''}</td></tr>` : ''}
          <tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Client</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">${cn}</td></tr>
          ${tel ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Téléphone</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0"><a href="tel:${tel}" style="color:#0e2a52;font-weight:bold;text-decoration:none">${tel}</a></td></tr>` : ''}
          ${cem ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Email</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">${cem}</td></tr>` : ''}
          ${adresseLigne ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Adresse</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0">
                ${adresseLigne}
                ${mapsHref ? ` &middot; <a href="${mapsHref}" style="color:#2563eb;text-decoration:underline">Maps</a>` : ''}
              </td></tr>` : ''}
          ${prix ? `<tr><td style="background:#f8fafc;padding:10px 16px;color:#475569;border-top:1px solid #e2e8f0">Prix prévu</td>
              <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-weight:bold;color:#0e2a52">${prix}</td></tr>` : ''}
        </table>

        ${notes ? `<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:14px 18px;margin:14px 0">
          <div style="font-size:11px;font-weight:bold;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Notes internes</div>
          <div style="font-size:14px;color:#451a03;white-space:pre-wrap">${notes}</div>
        </div>` : ''}

        <div style="text-align:center;margin:30px 0 10px">
          <a href="${p.lien}" style="display:inline-block;background:#0e2a52;color:#fff;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px">Voir l&rsquo;intervention →</a>
        </div>
        <p style="text-align:center;font-size:12px;color:#64748b;margin:0">Lien direct : <a href="${p.lien}" style="color:#2563eb">${p.lien}</a></p>

        <p style="margin-top:30px;font-size:13px;color:#666">À bientôt sur le terrain,<br>L&rsquo;équipe LTDB</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Les Techniciens du Débouchage · ${escapeHtml(p.tel)} · lestechniciensdudebouchage.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export async function notifyTechnicienIntervention(
  input: NotifyTechnicienInput,
  baseUrl: string,
): Promise<NotifyTechnicienResult> {
  const techEmail = (input.technicien_email || '').trim()
  const techPhone = (input.technicien_telephone || '').trim()
  const hasValidEmail = !!techEmail && EMAIL_RE.test(techEmail)

  if (!hasValidEmail && !techPhone) {
    return {
      ok: false,
      mail_sent: false,
      sms_sent: false,
      skipped: 'Technicien sans email ni téléphone renseignés',
    }
  }

  const lien = `${baseUrl.replace(/\/+$/, '')}/intervention/${input.intervention_id}`
  let mailSent = false
  let smsSent = false
  let mailId: string | undefined
  let error: string | undefined
  let smsError: string | undefined

  if (hasValidEmail) {
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      error = 'RESEND_API_KEY manquante'
    } else {
      const fromEmail = getResendFromEmail()
      const recipient = getResendRecipient(techEmail)
      const resend = new Resend(resendKey)
      const subject = `${input.urgence ? '🚨 URGENT — ' : ''}Nouvelle intervention${input.ville ? ` à ${input.ville}` : ''}${input.date_prevue ? ` (${fmtDateFREmpty(input.date_prevue)})` : ''}`
      const tel = await getTelPrincipal()

      const result = await resend.emails.send({
        from: `Les Techniciens du Débouchage <${fromEmail}>`,
        to: recipient,
        subject,
        html: emailTechHtml({
          lien,
          tel,
          technicienNom: input.technicien_nom || 'Technicien',
          clientNom: input.client_nom,
          clientTelephone: input.client_telephone,
          clientEmail: input.client_email,
          adresseChantier: input.adresse_chantier,
          ville: input.ville,
          codePostal: input.code_postal,
          datePrevue: input.date_prevue,
          heurePrevue: input.heure_prevue,
          heureFinPrevue: input.heure_fin_prevue,
          typeIntervention: input.type_intervention,
          urgence: !!input.urgence,
          prixPrevu: typeof input.prix_prevu === 'number' ? input.prix_prevu : null,
          notesInternes: input.notes_internes,
        }),
      })

      if (result.error) {
        error = `Mail : ${result.error.message || JSON.stringify(result.error)}`
        console.error('[notify-technicien] mail', result.error)
      } else {
        mailSent = true
        mailId = result.data?.id
      }
    }
  }

  if (techPhone && isSmsConfigured()) {
    const smsBody = buildTechnicienInterventionSmsText({
      technicienNom: input.technicien_nom,
      clientNom: input.client_nom,
      clientTelephone: input.client_telephone,
      adresseChantier: input.adresse_chantier,
      ville: input.ville,
      codePostal: input.code_postal,
      datePrevue: input.date_prevue,
      heurePrevue: input.heure_prevue,
      heureFinPrevue: input.heure_fin_prevue,
      typeIntervention: input.type_intervention,
      urgence: !!input.urgence,
      lien,
    })
    const smsResult = await sendSms({ to: techPhone, content: smsBody })
    smsSent = smsResult.ok
    if (!smsResult.ok) {
      smsError = smsResult.error
      console.error('[notify-technicien] SMS', smsResult.error)
      if (!error) error = `SMS : ${smsResult.error}`
    }
  } else if (techPhone && !isSmsConfigured()) {
    smsError = 'SMS non configuré (BREVO_API_KEY ou Twilio)'
  }

  const ok = mailSent || smsSent
  return {
    ok,
    mail_sent: mailSent,
    sms_sent: smsSent,
    ...(mailId ? { mail_id: mailId } : {}),
    ...(smsError ? { sms_error: smsError } : {}),
    ...(!ok ? { error: error || smsError || 'Notification non envoyée' } : {}),
  }
}

export function resolveNotifyBaseUrl(origin?: string | null): string {
  return origin
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXTAUTH_URL
    || 'https://app-realisations.vercel.app'
}

/** Charge intervention + client + technicien puis envoie mail/SMS. */
export async function notifyTechnicienForIntervention(
  interventionId: string,
  technicienId: string,
  baseUrl: string,
): Promise<NotifyTechnicienResult> {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return { ok: false, mail_sent: false, sms_sent: false, skipped: 'Supabase non configuré' }
  }

  const { data: tech } = await sb
    .from('techniciens')
    .select('id, nom, email, telephone')
    .eq('id', technicienId)
    .maybeSingle()

  if (!tech?.email && !tech?.telephone) {
    return {
      ok: false,
      mail_sent: false,
      sms_sent: false,
      skipped: `Technicien « ${tech?.nom || technicienId} » sans email ni téléphone`,
    }
  }

  const { data: i } = await sb
    .from('interventions')
    .select('*')
    .eq('id', interventionId)
    .maybeSingle()

  if (!i) {
    return { ok: false, mail_sent: false, sms_sent: false, skipped: 'Intervention introuvable' }
  }

  let clientNom: string | null = null
  let clientTel: string | null = null
  let clientEmail: string | null = null
  if (i.client_id) {
    const { data: c } = await sb
      .from('clients')
      .select('nom, email, telephone')
      .eq('id', i.client_id)
      .maybeSingle()
    clientNom = c?.nom ?? null
    clientTel = c?.telephone ?? null
    clientEmail = c?.email ?? null
  }

  return notifyTechnicienIntervention({
    intervention_id: interventionId,
    technicien_email: tech.email,
    technicien_nom: tech.nom,
    technicien_telephone: tech.telephone,
    client_nom: clientNom,
    client_telephone: clientTel,
    client_email: clientEmail,
    adresse_chantier: i.adresse_chantier,
    ville: i.ville,
    code_postal: i.code_postal,
    date_prevue: i.date_prevue,
    heure_prevue: i.heure_prevue,
    heure_fin_prevue: i.heure_fin_prevue ?? null,
    type_intervention: i.type_intervention,
    urgence: i.urgence,
    prix_prevu: i.prix_prevu,
    notes_internes: i.notes_internes,
  }, baseUrl)
}

export function formatNotifyTechnicienFeedback(result: NotifyTechnicienResult | null | undefined): string {
  if (!result) return ''
  if (result.ok) {
    const parts: string[] = []
    if (result.mail_sent) parts.push('mail')
    if (result.sms_sent) parts.push('SMS')
    if (parts.length) return `${parts.join(' + ')} envoyé(s) au technicien`
    return 'Notification envoyée au technicien'
  }
  return result.skipped || result.error || result.sms_error || 'Notification non envoyée'
}

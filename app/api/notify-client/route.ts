import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { EMAIL_RE, escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { getTelPrincipal } from "@/lib/parametres"

interface NotifyClientBody {
  clientEmail?: string
  clientNom?: string
  technicienNom?: string
  ville?: string
  dateIntervention?: string
  pdfBase64?: string
  pdfFilename?: string
}

/** Envoi mail rapport client — sans demande d'avis Google ni relances. */
export async function POST(req: NextRequest) {
  let body: NotifyClientBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const { clientEmail, clientNom, technicienNom, ville, dateIntervention, pdfBase64, pdfFilename } = body

  if (!clientEmail || typeof clientEmail !== 'string' || !EMAIL_RE.test(clientEmail)) {
    return NextResponse.json({ error: 'Email client invalide' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = getResendFromEmail()

  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const tech = technicienNom || 'votre technicien'
  const recipient = getResendRecipient(clientEmail)

  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: pdfBase64 }]
    : undefined

  const tel = await getTelPrincipal()

  const immediate = await resend.emails.send({
    from: `Les Techniciens du Débouchage <${fromEmail}>`,
    to: recipient,
    subject: `Votre rapport d'intervention — ${ville || 'LTDB'}`,
    html: emailRapport({ clientNom, technicienNom: tech, ville, dateIntervention, tel }),
    attachments,
  })

  if (immediate.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${immediate.error.message || JSON.stringify(immediate.error)}`,
      hint: immediate.error.name === 'validation_error'
        ? "Free tier Resend + onboarding@resend.dev : tu ne peux envoyer qu'à l'email du compte Resend. Vérifie ton domaine sur https://resend.com/domains pour envoyer à n'importe quelle adresse."
        : undefined,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    immediate_id: immediate.data?.id,
    followUps_ids: [] as string[],
  })
}

function emailRapport({ clientNom, technicienNom, ville, dateIntervention, tel }: {
  clientNom?: string
  technicienNom: string
  ville?: string
  dateIntervention?: string
  tel: string
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const di = escapeHtml(dateIntervention || '')
  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <h1 style="margin:0;font-size:22px">Votre rapport d'intervention</h1>
        <p style="margin:6px 0 0;opacity:.85;font-size:13px">Les Techniciens du Débouchage</p>
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre intervention${di ? ` du <strong>${di}</strong>` : ''}${v ? ` à <strong>${v}</strong>` : ''}, vous trouverez ci-joint votre <strong>rapport d'intervention détaillé</strong>.</p>
        <p>Pour toute question, n'hésitez pas à nous contacter au <strong>${escapeHtml(tel)}</strong>.</p>
        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong> — Expert en assainissement<br>Les Techniciens du Débouchage</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Les Techniciens du Débouchage · ${escapeHtml(tel)} · lestechniciensdudebouchage.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

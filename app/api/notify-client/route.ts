import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const { clientEmail, clientNom, technicienNom, ville, dateIntervention, pdfBase64, pdfFilename } = await req.json()

  if (!clientEmail || typeof clientEmail !== 'string' || !EMAIL_RE.test(clientEmail)) {
    return NextResponse.json({ error: 'Email client invalide' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'contact@lestechniciensdudebouchage.fr'
  const reviewUrl = process.env.GOOGLE_REVIEW_URL || 'https://g.page/r/lestechniciensdudebouchage/review'

  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const prenomClient = (clientNom || 'Client').split(' ').slice(-1)[0]
  const tech = technicienNom || 'votre technicien'

  // Tant que le domaine n'est pas vérifié sur Resend, on force la destination
  // vers RESEND_TEST_EMAIL si défini (sinon on envoie au vrai client).
  const recipient = process.env.RESEND_TEST_EMAIL || clientEmail

  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: pdfBase64 }]
    : undefined

  // 1. Envoi immédiat — rapport PDF
  const immediate = await resend.emails.send({
    from: `Les Techniciens du Débouchage <${fromEmail}>`,
    to: recipient,
    subject: `Votre rapport d'intervention — ${ville}`,
    html: emailRapport({ clientNom, technicienNom: tech, ville, dateIntervention, reviewUrl }),
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

  // 2-4. Relances avis Google — J+2, J+4, J+6
  const now = Date.now()
  const days = [2, 4, 6]
  const followUps = await Promise.all(
    days.map(d => {
      const scheduledAt = new Date(now + d * 24 * 60 * 60 * 1000).toISOString()
      return resend.emails.send({
        from: `Les Techniciens du Débouchage <${fromEmail}>`,
        to: recipient,
        subject: relanceSubject(d, prenomClient),
        html: emailRelance({ clientNom, technicienNom: tech, ville, reviewUrl, jour: d }),
        scheduledAt,
      })
    })
  )

  const followUpErrors = followUps.filter(f => f.error).map(f => f.error?.message)

  return NextResponse.json({
    ok: true,
    immediate_id: immediate.data?.id,
    followUps_ids: followUps.map(f => f.data?.id || null),
    followUp_errors: followUpErrors.length > 0 ? followUpErrors : undefined,
  })
}

function relanceSubject(jour: number, prenom: string) {
  if (jour === 2) return `${prenom}, tout est rentré dans l'ordre ?`
  if (jour === 4) return `Un petit avis pour Les Techniciens du Débouchage ?`
  return `Dernière chance — partagez votre expérience`
}

function emailRapport({ clientNom, technicienNom, ville, dateIntervention, reviewUrl }: { clientNom: string; technicienNom: string; ville: string; dateIntervention: string; reviewUrl: string }) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville)
  const di = escapeHtml(dateIntervention)
  const ru = encodeURI(reviewUrl)
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
        <p>Suite à notre intervention du <strong>${di}</strong> à <strong>${v}</strong>, vous trouverez ci-joint votre <strong>rapport d'intervention détaillé</strong>.</p>
        <p>Pour toute question, n'hésitez pas à nous contacter au <strong>07 83 63 68 35</strong>.</p>
        <div style="margin:30px 0;padding:20px;background:#fef0e0;border-left:4px solid #e67e22;border-radius:4px">
          <p style="margin:0 0 10px;font-weight:bold;color:#a04e09">Votre avis compte</p>
          <p style="margin:0 0 14px;font-size:14px">Si vous êtes satisfait, prenez 30 secondes pour laisser un avis Google.</p>
          <a href="${ru}" style="display:inline-block;background:#e67e22;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">⭐ Laisser un avis Google</a>
        </div>
        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong> — Expert en assainissement<br>Les Techniciens du Débouchage</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Les Techniciens du Débouchage · 07 83 63 68 35 · lestechniciensdudebouchage.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function emailRelance({ clientNom, technicienNom, ville, reviewUrl, jour }: { clientNom: string; technicienNom: string; ville: string; reviewUrl: string; jour: number }) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville)
  const ru = encodeURI(reviewUrl)
  const accroche = jour === 2
    ? `Nous espérons que tout est rentré dans l'ordre depuis notre intervention à ${v}.`
    : jour === 4
    ? `Votre satisfaction est notre priorité. Un petit retour de votre part ferait toute la différence.`
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
        <p style="font-size:13px;color:#666">Merci pour votre confiance,<br><strong>${tn}</strong> — Expert en assainissement</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:14px;text-align:center;font-size:11px">
        Les Techniciens du Débouchage · 07 83 63 68 35
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

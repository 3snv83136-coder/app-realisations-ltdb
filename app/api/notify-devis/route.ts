import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

export const maxDuration = 30

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtEUR(n: number) {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export async function POST(req: NextRequest) {
  const { clientEmail, clientNom, technicienNom, ville, dateDevis, numero, totalTTC, validiteJours, pdfBase64, pdfFilename } = await req.json()

  if (!clientEmail || typeof clientEmail !== 'string' || !EMAIL_RE.test(clientEmail)) {
    return NextResponse.json({ error: 'Email client invalide' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'contact@lestechniciensdudebouchage.fr'

  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquante' }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const recipient = process.env.RESEND_TEST_EMAIL || clientEmail
  const tech = technicienNom || 'votre technicien'

  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: pdfBase64 }]
    : undefined

  const subject = numero
    ? `Votre devis ${numero}${ville ? ` — ${ville}` : ''}`
    : `Votre devis${ville ? ` — ${ville}` : ''}`

  const result = await resend.emails.send({
    from: `Les Techniciens du Débouchage <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailDevis({ clientNom, technicienNom: tech, ville, dateDevis, numero, totalTTC, validiteJours }),
    attachments,
  })

  if (result.error) {
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${result.error.message || JSON.stringify(result.error)}`,
      hint: result.error.name === 'validation_error'
        ? "Vérifie que ton domaine est bien vérifié sur https://resend.com/domains, ou définis RESEND_TEST_EMAIL pour rediriger les envois en attendant."
        : undefined,
    }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: result.data?.id })
}

function emailDevis({ clientNom, technicienNom, ville, dateDevis, numero, totalTTC, validiteJours }: {
  clientNom?: string; technicienNom: string; ville?: string; dateDevis?: string;
  numero?: string; totalTTC?: number; validiteJours?: number;
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const dd = escapeHtml(dateDevis || '')
  const num = escapeHtml(numero || '')
  const ttc = typeof totalTTC === 'number' ? fmtEUR(totalTTC) : ''
  const valid = typeof validiteJours === 'number' && validiteJours > 0 ? `${validiteJours} jours` : '30 jours'
  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Devis</div>
        <h1 style="margin:0;font-size:22px">${num ? `Devis ${num}` : 'Votre devis'}</h1>
        ${dd ? `<p style="margin:6px 0 0;opacity:.85;font-size:13px">Établi le ${dd}</p>` : ''}
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre échange${v ? ` concernant l'intervention prévue à <strong>${v}</strong>` : ''}, vous trouverez ci-joint votre <strong>devis détaillé</strong>.</p>
        ${ttc ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <tr><td style="background:#f8fafc;padding:16px 20px;color:#475569;font-size:13px">Montant total TTC</td>
              <td style="background:#f8fafc;padding:16px 20px;text-align:right;color:#0e2a52;font-size:18px;font-weight:bold">${ttc}</td></tr>
        </table>` : ''}
        <p style="font-size:14px">Devis valable <strong>${valid}</strong>.</p>
        <p>Pour valider ou poser une question, contactez-nous au <strong>07 83 63 68 35</strong> ou répondez à ce mail.</p>
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

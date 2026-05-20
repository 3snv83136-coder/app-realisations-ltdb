import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import { persistDevis } from "@/lib/persist"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const {
    clientEmail, clientNom, technicienNom, ville, dateDevis, numero, totalTTC, validiteJours, pdfBase64, pdfFilename,
    devis, totalHT, tvaTaux, agence, clientAdresse, clientCP,
  } = body

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

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

  let docId: string | null = null
  let persistError: string | null = null
  if (devis) {
    try {
      docId = await persistDevis({
        devis, clientNom, clientEmail, clientAdresse, clientCP, ville,
        agence, numero, totalHT, totalTTC, tvaTaux, validiteJours,
        emailSent: true,
      })
      if (!docId) persistError = "Sauvegarde DB impossible (vérifie les logs serveur)"
    } catch (e: any) {
      persistError = e?.message || 'Erreur de sauvegarde DB'
      console.error('[notify-devis] persist', e)
    }
  }

  return NextResponse.json({
    ok: true,
    id: result.data?.id,
    docId,
    ...(persistError ? { warning: `Email envoyé mais le devis n'a PAS été enregistré en base : ${persistError}` } : {}),
  })
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

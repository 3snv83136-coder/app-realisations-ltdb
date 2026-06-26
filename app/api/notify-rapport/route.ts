import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend, resendErrorHint } from "@/lib/email-utils"
import { getTelPrincipal } from "@/lib/parametres"
import { sendOwnerConfirmation } from "@/lib/owner-confirmation"

export const maxDuration = 60

/**
 * Renvoi du rapport d'intervention SEUL (sans facture ni relances avis).
 * Le PDF est construit côté client (même rendu que le téléchargement) et fourni
 * en base64. Utilisé par le bouton « Renvoyer le rapport » de l'historique.
 *
 * POST {
 *   clientEmail, clientNom?, ville?, reference?, technicienNom?,
 *   pdfRapportBase64, pdfFilename?, interventionId?
 * }
 */
export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const {
    clientEmail, clientNom, ville, reference, technicienNom,
    pdfRapportBase64, pdfFilename, interventionId,
  } = body || {}

  if (!pdfRapportBase64) {
    return NextResponse.json({ error: "PDF du rapport manquant" }, { status: 400 })
  }

  const ctx = initResend(clientEmail)
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  const tech = technicienNom || "votre technicien"
  const ref = reference || ""
  const tel = await getTelPrincipal()

  const subject = `Votre rapport d'intervention${ref ? ` ${ref}` : ""}${ville ? ` — ${ville}` : ""}`

  const result = await resend.emails.send({
    from: `Les Techniciens du Débouchage <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailRapport({ clientNom, technicienNom: tech, ville, reference: ref, tel }),
    attachments: [
      { filename: pdfFilename || `rapport${ref ? `-${ref}` : ""}.pdf`, content: pdfRapportBase64 },
    ],
  })

  if (result.error) {
    const msg = result.error.message || JSON.stringify(result.error)
    const hint = resendErrorHint({ error: msg })
    return NextResponse.json({
      error: `Resend a rejeté l'envoi : ${msg}`,
      ...(hint ? { hint } : {}),
    }, { status: 500 })
  }

  // Confirmation au gérant (best-effort — ne bloque jamais le flux client).
  const ownerConfirmation = await sendOwnerConfirmation({
    resend,
    fromEmail,
    type: "rapport",
    clientNom,
    clientEmail,
    destinataireReel: recipient,
    ville,
    reference: ref,
    messageId: result.data?.id,
  })

  return NextResponse.json({
    ok: true,
    id: result.data?.id,
    ...(interventionId ? { interventionId } : {}),
    owner_confirmation: ownerConfirmation.sent,
    ...(ownerConfirmation.error ? { owner_confirmation_warning: ownerConfirmation.error } : {}),
  })
}

function emailRapport({ clientNom, technicienNom, ville, reference, tel }: {
  clientNom?: string; technicienNom: string; ville?: string; reference?: string; tel: string
}) {
  const cn = escapeHtml(clientNom || "Madame, Monsieur")
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || "")
  const ref = escapeHtml(reference || "")

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Rapport d'intervention</div>
        <h1 style="margin:0;font-size:22px">${ref ? `Rapport ${ref}` : "Votre rapport d'intervention"}</h1>
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Vous trouverez ci-joint le <strong>rapport détaillé</strong> de notre intervention${v ? ` à <strong>${v}</strong>` : ""}.</p>
        <p style="font-size:14px">Pour toute question, n'hésitez pas à nous contacter au <strong>${escapeHtml(tel)}</strong>.</p>
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

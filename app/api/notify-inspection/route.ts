import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { persistInspection, type PersistInspectionInput } from "@/lib/persist"
import { getTelPrincipal } from "@/lib/parametres"
import { errorMessage } from "@/lib/error-message"
import { fmtDateISOtoFR } from "@/lib/format"

export const maxDuration = 60

interface NotifyInspectionBody extends Partial<PersistInspectionInput> {
  technicienNom?: string
  pdfBase64?: string
  pdfFilename?: string
  dateInspection?: string | null
}

export async function POST(req: NextRequest) {
  let body: NotifyInspectionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const {
    clientEmail, clientNom, technicienNom, ville, dateInspection, numero,
    pdfBase64, pdfFilename, inspection, agence, clientAdresse, clientCP,
    clientTelephone, interventionId,
  } = body

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  const tech = technicienNom || inspection?.technicienNom || 'votre technicien'
  const attachments = pdfBase64 && pdfFilename
    ? [{ filename: pdfFilename, content: pdfBase64 }]
    : undefined

  const num = numero || inspection?.numero || ''
  const dateIso = dateInspection || inspection?.dateInspection || ''
  const dateFr = dateIso ? fmtDateISOtoFR(dateIso) : ''
  const villeLabel = ville || inspection?.client?.ville || ''

  const subject = num
    ? `Votre rapport d'inspection caméra ${num}${villeLabel ? ` — ${villeLabel}` : ''}`
    : `Votre rapport d'inspection caméra${villeLabel ? ` — ${villeLabel}` : ''}`

  const tel = await getTelPrincipal()

  const result = await resend.emails.send({
    from: `Les Techniciens du Débouchage <${fromEmail}>`,
    to: recipient,
    subject,
    html: emailInspection({
      clientNom: clientNom || inspection?.client?.nom,
      technicienNom: tech,
      ville: villeLabel,
      dateInspection: dateFr,
      numero: num,
      tel,
    }),
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
  if (inspection || num) {
    try {
      if (!inspection) {
        persistError = 'Payload inspection manquant pour la sauvegarde'
      } else {
        docId = await persistInspection({
          inspection: (() => {
            const { mapImageUrl: _map, ...rest } = inspection
            return rest
          })(),
          clientNom: clientNom || inspection.client?.nom,
          clientEmail: clientEmail || inspection.client?.email,
          clientAdresse: clientAdresse || inspection.client?.adresse,
          clientCP: clientCP || inspection.client?.codePostal,
          ville: villeLabel || inspection.client?.ville,
          clientTelephone: clientTelephone || inspection.client?.telephone,
          agence: agence || inspection.agence,
          numero: num || inspection.numero,
          interventionId: interventionId || null,
          emailSent: true,
        })
        if (!docId) persistError = "Sauvegarde DB impossible (vérifie les logs serveur)"
      }
    } catch (e) {
      persistError = errorMessage(e) || 'Erreur de sauvegarde DB'
      console.error('[notify-inspection] persist', e)
    }
  }

  return NextResponse.json({
    ok: true,
    id: result.data?.id,
    docId,
    ...(persistError ? { warning: `Email envoyé mais le rapport n'a PAS été enregistré en base : ${persistError}` } : {}),
  })
}

function emailInspection({
  clientNom, technicienNom, ville, dateInspection, numero, tel,
}: {
  clientNom?: string | null
  technicienNom: string
  ville?: string | null
  dateInspection?: string | null
  numero?: string | null
  tel: string
}) {
  const cn = escapeHtml(clientNom || 'Madame, Monsieur')
  const tn = escapeHtml(technicienNom)
  const v = escapeHtml(ville || '')
  const di = escapeHtml(dateInspection || '')
  const num = escapeHtml(numero || '')

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0f2e5c,#25477f);padding:30px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Inspection télévisée · ITV</div>
        <h1 style="margin:0;font-size:22px">Rapport d'inspection caméra</h1>
        ${num ? `<p style="margin:6px 0 0;opacity:.85;font-size:13px">Référence ${num}</p>` : ''}
      </td></tr>
      <tr><td style="padding:30px">
        <p>Bonjour ${cn},</p>
        <p>Veuillez trouver ci-joint le <strong>rapport d'inspection caméra</strong>${v ? ` réalisé à <strong>${v}</strong>` : ''}${di ? ` le <strong>${di}</strong>` : ''}.</p>
        <p>Ce document détaille les observations relevées lors de l'inspection télévisée (ITV), ainsi que nos conclusions et préconisations techniques.</p>
        <p>Nous restons à votre disposition pour toute précision complémentaire au <strong>${escapeHtml(tel)}</strong>.</p>
        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong> — Expert en assainissement<br>Les Techniciens du Débouchage</p>
      </td></tr>
      <tr><td style="background:#0f2e5c;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Les Techniciens du Débouchage · ${escapeHtml(tel)} · lestechniciensdudebouchage.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { persistInspection, type PersistInspectionInput } from "@/lib/persist"
import { getTelPrincipal } from "@/lib/parametres"
import { errorMessage } from "@/lib/error-message"
import { fmtDateISOtoFR } from "@/lib/format"
import { getSupabaseOrNull } from "@/lib/supabase"
import type { InspectionData } from "@/components/InspectionCameraPDF"

export const maxDuration = 60

/** Limite PDF joint (multipart) — au-delà Resend / Vercel deviennent fragiles. */
const MAX_PDF_BYTES = 10 * 1024 * 1024

interface NotifyInspectionBody extends Partial<PersistInspectionInput> {
  technicienNom?: string
  pdfBase64?: string
  pdfFilename?: string
  dateInspection?: string | null
  /** Si fourni : marque ce document « envoyé » sans réécrire le payload (évite d’écraser les photos). */
  documentId?: string
}

async function parseBody(req: NextRequest): Promise<{
  meta: NotifyInspectionBody
  pdfBase64?: string
  pdfFilename?: string
}> {
  const ctype = req.headers.get('content-type') || ''

  // Multipart : PDF binaire + JSON meta (évite la limite ~4.5 Mo du JSON base64).
  if (ctype.includes('multipart/form-data')) {
    const form = await req.formData()
    const raw = String(form.get('payload') || '')
    let meta: NotifyInspectionBody = {}
    try {
      meta = raw ? JSON.parse(raw) as NotifyInspectionBody : {}
    } catch {
      throw new Error('JSON payload invalide')
    }

    const file = form.get('pdf')
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PDF_BYTES) {
        throw Object.assign(new Error('PDF trop lourd (max 10 Mo)'), { status: 413 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      return {
        meta,
        pdfBase64: buf.toString('base64'),
        pdfFilename: meta.pdfFilename || file.name || 'inspection-camera.pdf',
      }
    }
    return {
      meta,
      pdfBase64: meta.pdfBase64,
      pdfFilename: meta.pdfFilename,
    }
  }

  const meta = await req.json() as NotifyInspectionBody
  return { meta, pdfBase64: meta.pdfBase64, pdfFilename: meta.pdfFilename }
}

export async function POST(req: NextRequest) {
  let parsed: { meta: NotifyInspectionBody; pdfBase64?: string; pdfFilename?: string }
  try {
    parsed = await parseBody(req)
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 413) {
      return NextResponse.json({ error: errorMessage(e) }, { status: 413 })
    }
    return NextResponse.json({ error: errorMessage(e) || 'Requête invalide' }, { status: 400 })
  }

  const {
    clientEmail, clientNom, technicienNom, ville, dateInspection, numero,
    inspection, agence, clientAdresse, clientCP,
    clientTelephone, interventionId, documentId,
  } = parsed.meta

  const pdfBase64 = parsed.pdfBase64
  const pdfFilename = parsed.pdfFilename

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

  let docId: string | null = documentId || null
  let persistError: string | null = null

  try {
    if (documentId) {
      // Document déjà en base : ne pas réécrire le payload (photos intactes).
      const sb = getSupabaseOrNull()
      if (!sb) {
        persistError = 'Supabase non configuré'
      } else {
        const { error } = await sb.from('documents').update({
          statut: 'envoye',
          envoye_email: clientEmail || null,
          envoye_at: new Date().toISOString(),
        }).eq('id', documentId).eq('type', 'inspection')
        if (error) persistError = error.message
      }
    } else if (inspection) {
      docId = await persistInspection({
        inspection: (() => {
          const { mapImageUrl: _map, ...rest } = inspection as InspectionData
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
    } else if (num) {
      // Marque « envoyé » par numéro si le rapport existe déjà.
      const sb = getSupabaseOrNull()
      if (sb) {
        const { data: existing } = await sb
          .from('documents')
          .select('id')
          .eq('type', 'inspection')
          .eq('numero', num)
          .limit(1)
          .maybeSingle()
        if (existing?.id) {
          docId = existing.id
          const { error } = await sb.from('documents').update({
            statut: 'envoye',
            envoye_email: clientEmail || null,
            envoye_at: new Date().toISOString(),
          }).eq('id', existing.id)
          if (error) persistError = error.message
        }
      }
    }
  } catch (e) {
    persistError = errorMessage(e) || 'Erreur de sauvegarde DB'
    console.error('[notify-inspection] persist', e)
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

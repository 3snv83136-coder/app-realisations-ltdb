import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertInterventionAccess } from '@/lib/intervention-access'
import { getSupabaseOrNull } from '@/lib/supabase'
import { escapeHtml, initResend } from '@/lib/email-utils'
import { getTelPrincipal } from '@/lib/parametres'
import { fmtEUR } from '@/lib/format'
import { getTravauxSupplementaires } from '@/lib/travaux-supplementaires'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const user = await getSessionUser()
  const access = await assertInterventionAccess(params.id, user)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let body: { recordId?: string; clientEmail?: string; pdfBase64?: string; pdfFilename?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const clientEmail = (body.clientEmail || '').trim()
  if (!clientEmail) return NextResponse.json({ error: 'Email client manquant' }, { status: 400 })
  if (!body.pdfBase64 || !body.pdfFilename) {
    return NextResponse.json({ error: 'PDF manquant' }, { status: 400 })
  }

  const { data: interv, error } = await sb
    .from('interventions')
    .select('rapport_json, reference, ville')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const travaux = getTravauxSupplementaires(interv.rapport_json)
  const record = travaux.find(t => t.id === body.recordId) || travaux[travaux.length - 1]
  if (!record) return NextResponse.json({ error: 'Aucun travaux supplémentaires enregistré' }, { status: 404 })

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx
  const tel = await getTelPrincipal()

  const subject = `Accord travaux supplémentaires${interv.reference ? ` — ${interv.reference}` : ''}`
  const result = await resend.emails.send({
    from: `Les Techniciens du Débouchage <${fromEmail}>`,
    to: recipient,
    subject,
    html: `
      <p>Bonjour ${escapeHtml(record.client_nom)},</p>
      <p>Veuillez trouver ci-joint l&apos;accord relatif aux travaux supplémentaires réalisés
      ${interv.ville ? `à ${escapeHtml(interv.ville)}` : 'sur place'}.</p>
      <p><strong>Total TTC :</strong> ${fmtEUR(record.total_ttc)}</p>
      <p>Pour toute question : ${escapeHtml(tel)}</p>
      <p style="color:#64748b;font-size:12px;">Les Techniciens du Débouchage</p>
    `,
    attachments: [{ filename: body.pdfFilename, content: body.pdfBase64 }],
  })
  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 502 })
  }

  const now = new Date().toISOString()
  const updatedTravaux = travaux.map(t =>
    t.id === record.id ? { ...t, mail_envoye_at: now, client_email: clientEmail } : t,
  )
  const rapportJson = {
    ...(interv.rapport_json && typeof interv.rapport_json === 'object' ? interv.rapport_json : {}),
    travaux_supplementaires: updatedTravaux,
  }
  await sb.from('interventions').update({ rapport_json: rapportJson }).eq('id', params.id)

  return NextResponse.json({ ok: true, emailId: result.data?.id })
}

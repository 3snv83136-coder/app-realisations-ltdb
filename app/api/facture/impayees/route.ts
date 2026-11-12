import { NextRequest, NextResponse } from 'next/server'
import { requireOwnerAdminApi } from '@/lib/require-owner-admin'
import { getSupabaseOrNull } from '@/lib/supabase'
import { isFactureReglee } from '@/lib/facture-relance-modes'
import { fmtEUR, fmtDateFR } from '@/lib/format'
import { escapeHtml, initResend } from '@/lib/email-utils'
import { getTelPrincipal } from '@/lib/parametres'
import { sendOwnerConfirmation } from '@/lib/owner-confirmation'
import { buildFactureExtraAttachments } from '@/lib/admin-documents'
import { fetchPdfAsBase64Robust, isValidPdfBase64 } from '@/lib/supabase-pdf-fetch'
import { safeFilename } from '@/lib/filename'
import { errorMessage } from '@/lib/error-message'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_LOT = 40

type ImpayeeRow = {
  id: string
  numero: string | null
  date_emission: string
  echeance: string | null
  statut: string
  montant_ttc: number | null
  pdf_url: string | null
  client_id: string | null
  client_nom: string
  client_email: string | null
}

type Groupe = {
  cle: string
  nom: string
  email: string | null
  count: number
  total_ttc: number
  factures: ImpayeeRow[]
}

function cleClient(nom: string, clientId: string | null, docId: string): string {
  const normalise = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (normalise && normalise !== 'client sans nom') return normalise
  return clientId ? `client:${clientId}` : `doc:${docId}`
}

async function listerImpayees(): Promise<Groupe[]> {
  const sb = getSupabaseOrNull()
  if (!sb) throw new Error('Supabase non configuré')

  const docs: Array<{
    id: string
    numero: string | null
    date_emission: string
    echeance: string | null
    statut: string
    montant_ttc: number | null
    pdf_url: string | null
    client_id: string | null
  }> = []

  for (let from = 0; from < 2000; from += 500) {
    const { data, error } = await sb
      .from('documents')
      .select('id, numero, date_emission, echeance, statut, montant_ttc, pdf_url, client_id')
      .eq('type', 'facture')
      .in('statut', ['brouillon', 'envoye'])
      .order('date_emission', { ascending: true })
      .range(from, from + 499)
    if (error) throw new Error(error.message)
    const page = data || []
    docs.push(...page)
    if (page.length < 500) break
  }

  const impayees = docs.filter(doc => doc.statut !== 'paye' && doc.statut !== 'annule' && !isFactureReglee(doc.echeance))
  const clientIds = Array.from(new Set(impayees.map(d => d.client_id).filter(Boolean))) as string[]
  const clients: Record<string, { nom: string; email: string | null }> = {}
  if (clientIds.length) {
    const { data } = await sb
      .from('clients')
      .select('id, nom, email')
      .in('id', clientIds)
    for (const client of data || []) {
      clients[client.id] = { nom: client.nom, email: client.email }
    }
  }

  const groupes = new Map<string, Groupe & { emails: Map<string, number> }>()
  for (const doc of impayees) {
    const client = doc.client_id ? clients[doc.client_id] : undefined
    const nom = (client?.nom || '').trim() || 'Client sans nom'
    const cle = cleClient(nom, doc.client_id, doc.id)
    const row: ImpayeeRow = {
      id: doc.id,
      numero: doc.numero,
      date_emission: doc.date_emission,
      echeance: doc.echeance,
      statut: doc.statut,
      montant_ttc: doc.montant_ttc,
      pdf_url: doc.pdf_url,
      client_id: doc.client_id,
      client_nom: nom,
      client_email: client?.email || null,
    }
    const groupe = groupes.get(cle) || {
      cle,
      nom,
      email: null,
      count: 0,
      total_ttc: 0,
      factures: [],
      emails: new Map<string, number>(),
    }
    if (groupe.nom === 'Client sans nom' && nom !== 'Client sans nom') groupe.nom = nom
    groupe.factures.push(row)
    groupe.count += 1
    groupe.total_ttc += doc.montant_ttc || 0
    const email = (client?.email || '').trim()
    if (email) groupe.emails.set(email, (groupe.emails.get(email) || 0) + 1)
    groupes.set(cle, groupe)
  }

  return Array.from(groupes.values())
    .map(({ emails, ...groupe }) => {
      const meilleur = Array.from(emails.entries()).sort((a, b) => b[1] - a[1])[0]
      return { ...groupe, email: meilleur?.[0] || null }
    })
    .sort((a, b) => b.total_ttc - a.total_ttc)
}

export async function GET() {
  const admin = await requireOwnerAdminApi()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })
  try {
    const groupes = await listerImpayees()
    return NextResponse.json({ groupes })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) || 'Lecture impossible' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireOwnerAdminApi()
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status })

  let body: { cle?: string; email?: string; joindreRib?: boolean; pdfs?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const cle = (body.cle || '').trim()
  const email = (body.email || '').trim()
  if (!cle) return NextResponse.json({ error: 'Client manquant' }, { status: 400 })

  const ctx = initResend(email)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  try {
    const groupes = await listerImpayees()
    const groupe = groupes.find(item => item.cle === cle)
    if (!groupe || groupe.factures.length === 0) {
      return NextResponse.json({ error: 'Aucune facture en attente pour ce client' }, { status: 404 })
    }
    if (groupe.factures.length > MAX_LOT) {
      return NextResponse.json({
        error: `${groupe.factures.length} factures en attente. L'envoi groupé est limité à ${MAX_LOT}.`,
      }, { status: 400 })
    }

    const sb = getSupabaseOrNull()
    const fournis = body.pdfs || {}
    const attachments: { filename: string; content: string }[] = []
    const manquantes: string[] = []

    for (const facture of groupe.factures) {
      const nomFichier = safeFilename('facture', facture.numero || facture.id)
      const fourni = fournis[facture.id]
      if (fourni && isValidPdfBase64(fourni, 800)) {
        attachments.push({ filename: nomFichier, content: fourni })
        continue
      }
      if (facture.pdf_url) {
        const pdf = await fetchPdfAsBase64Robust(sb, facture.pdf_url)
        if (pdf && isValidPdfBase64(pdf, 800)) {
          attachments.push({ filename: nomFichier, content: pdf })
          continue
        }
      }
      manquantes.push(facture.numero || facture.id)
    }

    if (manquantes.length) {
      return NextResponse.json({
        error: `PDF manquant pour ${manquantes.join(', ')}. L'envoi n'a pas été fait.`,
      }, { status: 400 })
    }

    let ribJoint = false
    if (body.joindreRib) {
      const extras = await buildFactureExtraAttachments({ joindreRib: true })
      if (extras.length) {
        attachments.push(...extras)
        ribJoint = true
      }
    }

    const tel = await getTelPrincipal()
    const lignes = groupe.factures.map(facture => {
      const date = fmtDateFR(facture.date_emission)
      const montant = fmtEUR(facture.montant_ttc)
      return `<tr>
        <td style="padding:8px 12px;border-top:1px solid #e2e8f0">${escapeHtml(facture.numero || '—')}</td>
        <td style="padding:8px 12px;border-top:1px solid #e2e8f0">${escapeHtml(date)}</td>
        <td style="padding:8px 12px;border-top:1px solid #e2e8f0;text-align:right;font-weight:bold">${escapeHtml(montant)}</td>
      </tr>`
    }).join('')

    const subject = `Factures en attente — ${groupe.nom}`
    const html = `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden">
      <tr><td style="background:#0e2a52;padding:28px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Factures en attente</div>
        <h1 style="margin:8px 0 0;font-size:22px">${escapeHtml(groupe.nom)}</h1>
      </td></tr>
      <tr><td style="padding:28px">
        <p>Bonjour,</p>
        <p>Vous trouverez ci-joint les <strong>${groupe.count} facture${groupe.count > 1 ? 's' : ''}</strong> restant à régler, pour un total de <strong>${escapeHtml(fmtEUR(groupe.total_ttc))}</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:8px">
          <tr style="background:#f8fafc;color:#475569;font-size:12px">
            <th style="padding:8px 12px;text-align:left">Facture</th>
            <th style="padding:8px 12px;text-align:left">Date</th>
            <th style="padding:8px 12px;text-align:right">Montant TTC</th>
          </tr>
          ${lignes}
        </table>
        ${ribJoint ? '<p style="font-size:13px;color:#475569">Le RIB est joint à ce message.</p>' : ''}
        <p style="font-size:14px">Le règlement peut se faire par virement. Pour toute question : <strong>${escapeHtml(tel)}</strong>.</p>
        <p style="margin-top:28px;font-size:13px;color:#666">Cordialement,<br><strong>Les Techniciens du Débouchage</strong></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

    const result = await ctx.resend.emails.send({
      from: `Les Techniciens du Débouchage <${ctx.fromEmail}>`,
      to: ctx.recipient,
      subject,
      html,
      attachments,
    })
    if (result.error) {
      return NextResponse.json({ error: result.error.message || 'Envoi refusé' }, { status: 500 })
    }

    const maintenant = new Date().toISOString()
    if (sb) {
      await Promise.all(groupe.factures.map(facture => sb
        .from('documents')
        .update({
          statut: 'envoye',
          envoye_email: email,
          envoye_at: maintenant,
        })
        .eq('id', facture.id)
        .neq('statut', 'paye')))
    }

    await sendOwnerConfirmation({
      resend: ctx.resend,
      fromEmail: ctx.fromEmail,
      type: 'facture',
      clientNom: groupe.nom,
      clientEmail: email,
      destinataireReel: ctx.recipient,
      factureNumero: `${groupe.count} factures`,
      totalTTC: groupe.total_ttc,
      messageId: result.data?.id,
    })

    return NextResponse.json({
      ok: true,
      count: groupe.count,
      total_ttc: groupe.total_ttc,
      rib_joint: ribJoint,
    })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) || 'Envoi impossible' }, { status: 500 })
  }
}

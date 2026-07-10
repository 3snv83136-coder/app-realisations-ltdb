import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend, resendErrorHint, EMAIL_RE, isResendTestMode, getResendRecipient } from "@/lib/email-utils"
import { getSessionUser, assertInterventionAccess, requireInterventionAccess } from "@/lib/intervention-access"
import {
  isFactureReglee,
  isFacturePayeeOuReglee,
  mergeFacturePayloadMeta,
  planifierFactureRelances,
} from "@/lib/facture-relance"
import { planifierAvisRelances } from "@/lib/avis-relance"
import { buildRapportFactureHtml } from "@/lib/rapport-facture-message"
import { getSupabaseOrNull } from "@/lib/supabase"
import { getTelPrincipal } from "@/lib/parametres"
import { sendOwnerConfirmation } from "@/lib/owner-confirmation"
import { fetchPdfAsBase64Robust, isValidPdfBase64 } from "@/lib/supabase-pdf-fetch"
import { generateTerrainPdfsOnServer } from "@/lib/terrain-pdf-server"

export const maxDuration = 120

function getBaseUrl(req: NextRequest): string {
  const configured = process.env.APP_BASE_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  if (configured) return configured.replace(/\/+$/, "")
  return req.nextUrl.origin.replace(/\/+$/, "")
}

async function fetchPdfAsBase64(url: string, sb: ReturnType<typeof getSupabaseOrNull>): Promise<string | null> {
  return fetchPdfAsBase64Robust(sb, url)
}

export async function POST(req: NextRequest) {
  let body: {
    interventionId?: string
    clientEmail?: string
    skipReviews?: boolean
    /** Copie (ex. syndic, comptable) — en plus du mail client principal */
    ccEmail?: string
    /** PDF rapport en base64, fourni par le wizard Mode Terrain — bypass le besoin de pdf_rapport_url */
    pdfRapportBase64?: string
    /** PDF facture en base64, fourni par le wizard — bypass le besoin de facture.pdf_url */
    pdfFactureBase64?: string
    /** Ignore l'idempotence 30 min (renvoi explicite). */
    forceResend?: boolean
    /** Régénère les PDF serveur avant envoi (défaut : true). */
    regeneratePdfs?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const interventionId = (body.interventionId || '').trim()
  if (!interventionId) {
    return NextResponse.json({ error: 'interventionId requis' }, { status: 400 })
  }

  const access = await requireInterventionAccess(req, interventionId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const ccEmail = typeof body.ccEmail === 'string' ? body.ccEmail.trim() : ''
  if (ccEmail && !EMAIL_RE.test(ccEmail)) {
    return NextResponse.json({ error: 'Email en copie invalide' }, { status: 400 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, reference, type_intervention, ville, date_realisee, date_prevue, agence, client_id, technicien_id, pdf_rapport_url, rapport_json, mail_envoye_at')
    .eq('id', interventionId)
    .single()
  if (intErr || !interv) {
    return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })
  }
  if (!interv.pdf_rapport_url && !body.pdfRapportBase64) {
    return NextResponse.json({ error: 'Aucun PDF rapport publié pour cette intervention. Publie le rapport d\'abord.' }, { status: 400 })
  }

  // range(0, 0) au lieu de limit(1) : limit + order drop silencieusement la
  // ligne la plus récente sur supabase-js (bug documenté, cf. /api/historique).
  const { data: factures } = await sb
    .from('documents')
    .select('id, numero, montant_ht, montant_ttc, date_emission, echeance, statut, agence, pdf_url')
    .eq('intervention_id', interventionId)
    .eq('type', 'facture')
    .order('created_at', { ascending: false })
    .range(0, 0)
  const facture = factures && factures[0]
  if (!facture) {
    return NextResponse.json({ error: 'Aucune facture trouvée pour cette intervention. Crée la facture d\'abord.' }, { status: 400 })
  }
  if (!facture.pdf_url && !body.pdfFactureBase64) {
    return NextResponse.json({ error: 'La facture n\'a pas de PDF stocké.' }, { status: 400 })
  }

  let clientNom = ''
  let clientEmailFromDb = ''
  let clientPhone = ''
  if (interv.client_id) {
    const { data: cl } = await sb
      .from('clients')
      .select('nom, email, telephone')
      .eq('id', interv.client_id)
      .single()
    if (cl) {
      clientNom = cl.nom || ''
      clientEmailFromDb = cl.email || ''
      clientPhone = cl.telephone || ''
    }
  }
  const clientEmail = (body.clientEmail || clientEmailFromDb).trim()
  if (!clientEmail) {
    return NextResponse.json({ error: 'Email client manquant. Renseigne-le côté UI.' }, { status: 400 })
  }

  // Idempotence : si le mail a déjà été envoyé dans les 30 dernières minutes,
  // on ne re-spamme pas Resend + relances avis.
  if (!body.forceResend && interv.mail_envoye_at) {
    const ageMs = Date.now() - new Date(interv.mail_envoye_at).getTime()
    if (ageMs < 30 * 60 * 1000) {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
        mail_envoye_at: interv.mail_envoye_at,
        recipient: getResendRecipient(clientEmail),
        warning: 'Mail déjà envoyé il y a moins de 30 minutes — aucun nouvel envoi effectué.',
      })
    }
  }

  let technicienNom = 'votre technicien'
  if (interv.technicien_id) {
    const { data: t } = await sb
      .from('techniciens')
      .select('nom')
      .eq('id', interv.technicien_id)
      .single()
    if (t?.nom) technicienNom = t.nom
  }

  const ctx = initResend(clientEmail)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  const { resend, fromEmail, recipient } = ctx

  // Régénération systématique des PDF (sauf si base64 fourni par le client).
  const shouldRegenerate =
    body.regeneratePdfs !== false &&
    !body.pdfRapportBase64 &&
    !body.pdfFactureBase64

  if (shouldRegenerate) {
    try {
      await generateTerrainPdfsOnServer({
        interventionId,
        baseUrl: getBaseUrl(req),
        clientNom: clientNom || 'Client',
        sb,
      })
      const [{ data: intervFresh }, { data: facturesFresh }] = await Promise.all([
        sb.from('interventions').select('pdf_rapport_url').eq('id', interventionId).single(),
        sb.from('documents')
          .select('pdf_url')
          .eq('intervention_id', interventionId)
          .eq('type', 'facture')
          .order('created_at', { ascending: false })
          .range(0, 0),
      ])
      if (intervFresh?.pdf_rapport_url) interv.pdf_rapport_url = intervFresh.pdf_rapport_url
      if (facturesFresh?.[0]?.pdf_url) facture.pdf_url = facturesFresh[0].pdf_url as string
    } catch (e) {
      console.error('[notify-rapport-facture] regenerate pdfs', e)
      return NextResponse.json({
        error: `Regénération PDF : ${e instanceof Error ? e.message : String(e)}`,
      }, { status: 500 })
    }
  }

  // Priorité aux PDF fournis en base64 (wizard Mode Terrain).
  // Fallback : fetch depuis les URLs Storage (flux historique /nouveau).
  let rapportB64 = body.pdfRapportBase64 || (interv.pdf_rapport_url ? await fetchPdfAsBase64(interv.pdf_rapport_url, sb) : null)
  let factureB64 = body.pdfFactureBase64 || (facture.pdf_url ? await fetchPdfAsBase64(facture.pdf_url, sb) : null)
  const accordB64 = await (async () => {
    const { data: accord } = await sb
      .from('accords_intervention')
      .select('pdf_url, reference, statut')
      .eq('intervention_id', interventionId)
      .eq('statut', 'VALIDE')
      .maybeSingle()
    if (!accord?.pdf_url) return null
    return fetchPdfAsBase64(accord.pdf_url, sb)
  })()

  // Si le rapport stocké est vide/corrompu, regénère une fois.
  if (!isValidPdfBase64(rapportB64) && !body.pdfRapportBase64) {
    try {
      await generateTerrainPdfsOnServer({
        interventionId,
        baseUrl: getBaseUrl(req),
        clientNom: clientNom || 'Client',
        sb,
      })
      const { data: intervFresh } = await sb
        .from('interventions')
        .select('pdf_rapport_url')
        .eq('id', interventionId)
        .single()
      if (intervFresh?.pdf_rapport_url) {
        interv.pdf_rapport_url = intervFresh.pdf_rapport_url
        rapportB64 = await fetchPdfAsBase64(intervFresh.pdf_rapport_url, sb)
      }
    } catch (e) {
      console.error('[notify-rapport-facture] rapport pdf retry', e)
    }
  }

  if (!rapportB64) {
    return NextResponse.json({
      error: 'PDF rapport indisponible — regénère les documents (étape Diffusion) puis réessaie.',
    }, { status: 502 })
  }
  if (!isValidPdfBase64(rapportB64)) {
    return NextResponse.json({
      error: 'PDF rapport vide ou corrompu — regénération échouée. Réessaie depuis l\'étape Diffusion.',
    }, { status: 502 })
  }
  if (!factureB64 || !isValidPdfBase64(factureB64, 1500)) {
    return NextResponse.json({
      error: 'PDF facture indisponible — regénère les documents (étape Diffusion) puis réessaie.',
    }, { status: 502 })
  }

  const dateInterv = interv.date_realisee || interv.date_prevue || ''
  const ville = interv.ville || ''
  const reference = interv.reference || interv.id.slice(0, 8)
  const factureNum = facture.numero || ''
  const totalTTC = typeof facture.montant_ttc === 'number' ? facture.montant_ttc : null
  const factureReglee = isFacturePayeeOuReglee(facture.statut, facture.echeance)
  const dateFacture = facture.date_emission || dateInterv

  const tel = await getTelPrincipal()
  const skipReviews = !!body.skipReviews

  let reviewUrl = process.env.GOOGLE_REVIEW_URL
    || 'https://www.google.com/maps/place/Les+Techniciens+du+Débouchage'
  try {
    const { data: paramRow } = await sb
      .from('parametres')
      .select('valeur')
      .eq('cle', 'google_review_url')
      .maybeSingle()
    if (paramRow?.valeur) reviewUrl = paramRow.valeur
  } catch { /* best-effort */ }

  // Relances avis : J+1 SMS, J+2 mail, J+4 SMS, J+6 mail (best-effort).
  let relanceIds: string[] = []
  let smsPlanned = 0
  let avisRelanceErrors: string[] = []
  let stopUrl = ''
  if (!skipReviews) {
    try {
      const signSecret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET || process.env.RESEND_API_KEY || ''
      const rel = await planifierAvisRelances({
        interventionId,
        baseUrl: getBaseUrl(req),
        resend,
        fromEmail,
        recipient,
        clientPhone,
        clientNom,
        technicienNom,
        ville,
        reviewUrl,
        tel,
        signSecret,
      })
      relanceIds = rel.emailIds
      smsPlanned = rel.smsPlanned
      avisRelanceErrors = rel.errors
      stopUrl = rel.stopUrl
    } catch (e) {
      console.error("[notify-rapport-facture] relances avis", e)
      avisRelanceErrors.push(e instanceof Error ? e.message : String(e))
    }
  }

  const subject = `Votre rapport et facture${factureNum ? ` ${factureNum}` : ''}${ville ? ` — ${ville}` : ''}`

  const immediate = await resend.emails.send({
    from: `Les Techniciens du Débouchage <${fromEmail}>`,
    to: recipient,
    ...(ccEmail ? { cc: [ccEmail] } : {}),
    subject,
    html: buildRapportFactureHtml({
      clientNom, technicienNom, ville, dateIntervention: dateInterv,
      reference, factureNumero: factureNum, totalTTC, reviewUrl, stopUrl, tel,
      factureReglee,
    }),
    attachments: [
      { filename: `rapport-${reference}.pdf`, content: rapportB64 },
      { filename: `facture${factureNum ? `-${factureNum}` : ''}.pdf`, content: factureB64 },
      ...(accordB64 ? [{ filename: `accord-${reference}.pdf`, content: accordB64 }] : []),
    ],
  })

  if (immediate.error) {
    const msg = immediate.error.message || JSON.stringify(immediate.error)
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
    type: 'rapport_facture',
    clientNom,
    clientEmail,
    destinataireReel: recipient,
    ville,
    reference,
    factureNumero: factureNum,
    totalTTC,
    ccEmail: ccEmail || undefined,
    messageId: immediate.data?.id,
    accordJoint: !!accordB64,
  })

  // Relances paiement J+10, J+15, J+20 (si facture non réglée)
  let factureRelanceIds: string[] = []
  let factureRelanceErrors: string[] = []
  if (!factureReglee) {
    try {
      const rel = await planifierFactureRelances({
        baseUrl: getBaseUrl(req),
        clientEmail: recipient,
        clientNom,
        technicienNom,
        ville,
        dateFacture,
        numero: factureNum,
        totalTTC: totalTTC ?? undefined,
        echeance: facture.echeance || undefined,
        anchorAt: new Date().toISOString(),
      })
      factureRelanceIds = rel.reminderIds
      factureRelanceErrors = rel.reminderErrors
    } catch (e) {
      factureRelanceErrors.push(e instanceof Error ? e.message : String(e))
      console.error("[notify-rapport-facture] relances paiement", e)
    }
  }

  // Marque la facture comme envoyée + stocke les IDs relances (best-effort)
  try {
    const { data: docRow } = await sb.from("documents").select("payload").eq("id", facture.id).maybeSingle()
    const payload = mergeFacturePayloadMeta(
      (docRow?.payload as Record<string, unknown>) || {},
      factureReglee
        ? { relance_ids: [], relance_planifiees: 0 }
        : { relance_ids: factureRelanceIds, relance_planifiees: factureRelanceIds.length },
    )
    await sb
      .from('documents')
      .update({
        envoye_email: clientEmail,
        envoye_at: new Date().toISOString(),
        statut: facture.statut === 'paye' ? 'paye' : 'envoye',
        payload,
      })
      .eq('id', facture.id)
  } catch {}

  // Marque l'intervention : mail envoyé + bump terrain_step à 9 (= diffusion OK, étape réseaux)
  // + stocke les IDs des relances avis pour pouvoir les stopper depuis l'app.
  try {
    await sb
      .from('interventions')
      .update({
        mail_envoye_at: new Date().toISOString(),
        terrain_step: 9,
        ...(relanceIds.length || smsPlanned ? { avis_relance_ids: relanceIds } : {}),
      })
      .eq('id', interventionId)
  } catch {}

  return NextResponse.json({
    ok: true,
    immediate_id: immediate.data?.id,
    recipient,
    client_email: clientEmail,
    test_mode: isResendTestMode(),
    attachments: {
      rapport: true,
      facture: true,
      accord: !!accordB64,
    },
    followUp_ids: relanceIds,
    avis_sms_planifies: smsPlanned,
    ...(avisRelanceErrors.length ? { avis_relance_warnings: avisRelanceErrors } : {}),
    owner_confirmation: ownerConfirmation.sent,
    ...(ownerConfirmation.recipients?.length ? { owner_confirmation_to: ownerConfirmation.recipients } : {}),
    ...(ownerConfirmation.error ? { owner_confirmation_warning: ownerConfirmation.error } : {}),
    ...(!accordB64 ? {
      accord_warning: 'Accord signé introuvable ou PDF non archivé — mail envoyé sans pièce accord.',
    } : {}),
    ...(isResendTestMode() ? {
      test_mode_warning: `Mode test actif : le mail est redirigé vers ${recipient}, pas vers le client.`,
    } : {}),
    ...(!factureReglee ? {
      facture_relances_planifiees: factureRelanceIds.length,
      facture_relance_ids: factureRelanceIds,
      ...(factureRelanceErrors.length ? { facture_relance_warnings: factureRelanceErrors } : {}),
    } : {}),
  })
}

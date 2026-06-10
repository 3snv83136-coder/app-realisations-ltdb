import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import { upsertPreBilan, type PreBilanSnapshot } from "@/lib/compta-pre-bilan"
import { periodeLabel } from "@/lib/compta-kpis"
import { getEmailComptable, getTelPrincipal } from "@/lib/parametres"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function emailPreBilan(snapshot: PreBilanSnapshot, tel: string, appUrl: string): string {
  const k = snapshot.kpis
  const alertes = snapshot.alertes.map(a => `<li>${escapeHtml(a)}</li>`).join("")
  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden">
<tr><td style="background:#0e2a52;padding:28px;color:#fff">
<h1 style="margin:0;font-size:22px">Pré-bilan ${escapeHtml(snapshot.periode_label)}</h1>
<p style="margin:8px 0 0;opacity:.85;font-size:13px">Les Techniciens du Débouchage — à valider</p>
</td></tr>
<tr><td style="padding:28px;color:#1a1a1a;font-size:14px">
<p>Bonjour,</p>
<p>Veuillez trouver ci-dessous le <strong>pré-bilan provisoire</strong> pour validation comptable.</p>
<table width="100%" style="margin:20px 0;border-collapse:collapse">
<tr><td style="padding:10px;border:1px solid #e2e8f0">CA HT</td><td style="padding:10px;border:1px solid #e2e8f0;text-align:right;font-weight:bold">${fmtEUR(k.ca_ht)}</td></tr>
<tr><td style="padding:10px;border:1px solid #e2e8f0">CA TTC</td><td style="padding:10px;border:1px solid #e2e8f0;text-align:right">${fmtEUR(k.ca_ttc)}</td></tr>
<tr><td style="padding:10px;border:1px solid #e2e8f0">Dépenses HT</td><td style="padding:10px;border:1px solid #e2e8f0;text-align:right">${fmtEUR(k.dep_ht)}</td></tr>
<tr><td style="padding:10px;border:1px solid #e2e8f0">Résultat brut HT</td><td style="padding:10px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;color:#0e2a52">${fmtEUR(k.resultat_brut_ht)}</td></tr>
<tr><td style="padding:10px;border:1px solid #e2e8f0">TVA collectée</td><td style="padding:10px;border:1px solid #e2e8f0;text-align:right">${fmtEUR(k.tva_collectee)}</td></tr>
<tr><td style="padding:10px;border:1px solid #e2e8f0">TVA déductible</td><td style="padding:10px;border:1px solid #e2e8f0;text-align:right">${fmtEUR(k.tva_deductible)}</td></tr>
<tr><td style="padding:10px;border:1px solid #e2e8f0">Rapprochement bancaire</td><td style="padding:10px;border:1px solid #e2e8f0;text-align:right">${snapshot.taux_rapprochement} %</td></tr>
</table>
${alertes ? `<p style="color:#b45309"><strong>Points d'attention :</strong></p><ul>${alertes}</ul>` : "<p style='color:#0f7a3b'>Aucune alerte bloquante.</p>"}
<p>Exports FEC/CSV disponibles dans l'application : <a href="${escapeHtml(appUrl)}/comptabilite">${escapeHtml(appUrl)}/comptabilite</a></p>
<p style="font-size:13px;color:#666">Contact LTDB : ${escapeHtml(tel)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { annee?: number; mois?: number; email?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const annee = body.annee
  const mois = body.mois
  if (!annee || !mois) {
    return NextResponse.json({ error: "annee et mois requis" }, { status: 400 })
  }

  const comptableEmail = (body.email || await getEmailComptable()).trim()
  if (!comptableEmail) {
    return NextResponse.json({
      error: "Email comptable manquant. Renseignez EMAIL_COMPTABLE dans Paramètres ou passez email dans la requête.",
    }, { status: 400 })
  }

  const { id, snapshot } = await upsertPreBilan(sb, annee, mois)

  const ctx = initResend(comptableEmail)
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const tel = await getTelPrincipal()
  const appUrl = process.env.APP_BASE_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://app-realisations-ltdb.vercel.app")

  const sent = await ctx.resend.emails.send({
    from: `Les Techniciens du Débouchage <${ctx.fromEmail}>`,
    to: ctx.recipient,
    subject: `Pré-bilan ${periodeLabel(annee, mois)} — validation comptable LTDB`,
    html: emailPreBilan(snapshot, tel, appUrl.replace(/\/+$/, "")),
  })

  if (sent.error) {
    return NextResponse.json({ error: sent.error.message || "Envoi email échoué" }, { status: 500 })
  }

  const now = new Date().toISOString()
  await sb
    .from("pre_bilans")
    .update({
      statut: "envoye",
      comptable_email: comptableEmail,
      envoye_at: now,
      updated_at: now,
    })
    .eq("id", id)

  return NextResponse.json({ ok: true, pre_bilan_id: id, email_id: sent.data?.id })
}

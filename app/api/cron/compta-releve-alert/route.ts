import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { moisPrecedent, periodeLabel } from "@/lib/compta-kpis"
import { getComptaAlertEmail, getTelPrincipal } from "@/lib/parametres"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  const auth = req.headers.get("authorization") || ""
  return auth === `Bearer ${secret}`
}

function emailAlerteReleve(input: {
  periodeLabel: string
  annee: number
  mois: number
  appUrl: string
  tel: string
}): string {
  const pl = escapeHtml(input.periodeLabel)
  const url = escapeHtml(`${input.appUrl}/comptabilite`)
  return `<!doctype html>
<html><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:24px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;border:1px solid #e1e6ef">
<h1 style="margin:0 0 12px;color:#b91c1c;font-size:20px">⚠️ Relevé bancaire manquant</h1>
<p>Bonjour,</p>
<p>Nous sommes le <strong>5 du mois</strong> et le relevé bancaire de <strong>${pl}</strong> n'a pas encore été déposé dans l'application LTDB.</p>
<p>Merci d'uploader le PDF du relevé (et le CSV des opérations si disponible) pour permettre le rapprochement et le pré-bilan comptable.</p>
<p><a href="${url}" style="display:inline-block;background:#0e2a52;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:bold">Ouvrir la comptabilité</a></p>
<p style="font-size:12px;color:#64748b;margin-top:20px">Les Techniciens du Débouchage · ${escapeHtml(input.tel)}</p>
</div>
</body></html>`
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const { annee, mois } = moisPrecedent()
  const label = periodeLabel(annee, mois)

  const { data: releve } = await sb
    .from("releves_bancaires")
    .select("id, uploaded_at")
    .eq("periode_annee", annee)
    .eq("periode_mois", mois)
    .maybeSingle()

  if (releve?.id) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Relevé ${label} déjà présent`,
      releve_id: releve.id,
    })
  }

  const alertEmail = (await getComptaAlertEmail()).trim()
  if (!alertEmail) {
    return NextResponse.json({
      ok: false,
      error: "COMPTA_ALERT_EMAIL non configuré",
    }, { status: 500 })
  }

  const ctx = initResend(alertEmail)
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status })
  }

  const tel = await getTelPrincipal()
  const appUrl = process.env.APP_BASE_URL
    || process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://app-realisations-ltdb.vercel.app")

  const sent = await ctx.resend.emails.send({
    from: `LTDB Compta <${ctx.fromEmail}>`,
    to: ctx.recipient,
    subject: `⚠️ Relevé bancaire manquant — ${label}`,
    html: emailAlerteReleve({ periodeLabel: label, annee, mois, appUrl: appUrl.replace(/\/+$/, ""), tel }),
  })

  if (sent.error) {
    return NextResponse.json({ error: sent.error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    alerted: true,
    periode: `${annee}-${String(mois).padStart(2, "0")}`,
    email_id: sent.data?.id,
    recipient: alertEmail,
  })
}

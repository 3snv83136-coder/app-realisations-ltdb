import { NextRequest, NextResponse } from "next/server"
import { escapeHtml, initResend } from "@/lib/email-utils"
import { getComptaAlertEmail, getTelPrincipal } from "@/lib/parametres"
import {
  PAIE_ANNEE,
  PMSS,
  SMIC_HORAIRE,
  SMIC_MENSUEL,
  tauxPaieSignature,
} from "@/lib/rh/taux-paie"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  const auth = req.headers.get("authorization") || ""
  return auth === `Bearer ${secret}`
}

/** Normalise le texte d'une page (espaces fines/insécables → espace simple). */
function normalize(text: string): string {
  return text
    .replace(/\u00a0|\u202f|\u2009/g, " ")
    .replace(/\s+/g, " ")
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "LTDB-paie-control/1.0 (+contrôle taux mensuel)" },
      cache: "no-store",
    })
    clearTimeout(t)
    if (!res.ok) return null
    return normalize(await res.text())
  } catch {
    return null
  }
}

function eur(n: number): string {
  return n.toFixed(2).replace(".", ",")
}

/** Variantes d'écriture d'un montant (espaces de milliers). */
function montantVariants(n: number): string[] {
  const entier = Math.round(n)
  return [
    String(entier),
    entier.toLocaleString("fr-FR"), // "4 005"
    entier.toLocaleString("fr-FR").replace(/\s/g, " "),
  ]
}

type Check = { libelle: string; attendu: string; present: boolean; sourceOk: boolean }

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const SMIC_URL = "https://code.travail.gouv.fr/fiche-ministere-travail/le-smic"
  const PMSS_URL = "https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html"

  const [smicPage, pmssPage] = await Promise.all([fetchText(SMIC_URL), fetchText(PMSS_URL)])

  const checks: Check[] = []

  // SMIC horaire (ex. « 12,31 »)
  {
    const attendu = eur(SMIC_HORAIRE)
    const present = !!smicPage && smicPage.includes(attendu)
    checks.push({ libelle: "SMIC horaire brut", attendu: `${attendu} €`, present, sourceOk: !!smicPage })
  }
  // SMIC mensuel (ex. « 1 867,02 »)
  {
    const attendu = Math.trunc(SMIC_MENSUEL).toLocaleString("fr-FR") + "," + eur(SMIC_MENSUEL).split(",")[1]
    const present = !!smicPage && (smicPage.includes(attendu) || smicPage.includes(eur(SMIC_MENSUEL)))
    checks.push({ libelle: "SMIC mensuel (35 h)", attendu: `${attendu} €`, present, sourceOk: !!smicPage })
  }
  // PMSS (ex. « 4 005 »)
  {
    const variants = montantVariants(PMSS)
    const present = !!pmssPage && variants.some(v => pmssPage.includes(v))
    checks.push({ libelle: "Plafond mensuel Sécurité sociale (PMSS)", attendu: `${PMSS.toLocaleString("fr-FR")} €`, present, sourceOk: !!pmssPage })
  }

  const sourcesIndispo = checks.filter(c => !c.sourceOk)
  const ecarts = checks.filter(c => c.sourceOk && !c.present)
  const alerte = ecarts.length > 0

  // Pas d'alerte si tout concorde, ou si on n'a pas pu joindre les sources
  // (on évite le faux positif réseau ; le mois suivant retentera).
  if (!alerte && sourcesIndispo.length === 0) {
    return NextResponse.json({
      ok: true,
      changed: false,
      bareme: tauxPaieSignature(),
      message: `Taux ${PAIE_ANNEE} toujours en vigueur — aucun écart détecté.`,
      checks,
    })
  }

  // Envoi d'alerte e-mail
  const alertEmail = (await getComptaAlertEmail()).trim()
  if (!alertEmail) {
    return NextResponse.json({
      ok: false,
      changed: alerte,
      error: "COMPTA_ALERT_EMAIL non configuré — impossible d'alerter",
      checks,
    }, { status: 500 })
  }

  const ctx = initResend(alertEmail)
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error, checks }, { status: ctx.status })
  }

  const tel = await getTelPrincipal()
  const rows = checks.map(c => {
    const etat = !c.sourceOk
      ? "<span style=\"color:#92400e\">source injoignable</span>"
      : c.present
        ? "<span style=\"color:#15803d\">OK</span>"
        : "<span style=\"color:#b91c1c;font-weight:bold\">ÉCART — à mettre à jour</span>"
    return `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(c.libelle)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(c.attendu)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${etat}</td></tr>`
  }).join("")

  const sujet = alerte
    ? "⚠️ Taux de paie obsolètes — mise à jour requise"
    : "ℹ️ Contrôle taux de paie — sources injoignables"

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:24px">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:10px;padding:24px;border:1px solid #e1e6ef">
<h1 style="margin:0 0 12px;color:${alerte ? "#b91c1c" : "#0e2a52"};font-size:20px">${escapeHtml(sujet)}</h1>
<p>Contrôle mensuel automatique des barèmes de paie utilisés par l'application LTDB (barème ${PAIE_ANNEE}, signature <code>${escapeHtml(tauxPaieSignature())}</code>).</p>
${alerte ? "<p><strong>Au moins une valeur de référence n'a pas été retrouvée sur les sources officielles : un barème a probablement été revalorisé.</strong> Mettre à jour <code>lib/rh/taux-paie.ts</code>.</p>" : "<p>Les sources officielles n'ont pas pu être consultées ce mois-ci. Vérification manuelle recommandée.</p>"}
<table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:8px">
<tr style="text-align:left;background:#f1f5fb"><th style="padding:6px 8px">Élément</th><th style="padding:6px 8px">Valeur stockée</th><th style="padding:6px 8px">État</th></tr>
${rows}
</table>
<p style="font-size:12px;color:#64748b;margin-top:20px">Sources : code.travail.gouv.fr · urssaf.fr · Les Techniciens du Débouchage · ${escapeHtml(tel)}</p>
</div></body></html>`

  const sent = await ctx.resend.emails.send({
    from: `LTDB Paie <${ctx.fromEmail}>`,
    to: ctx.recipient,
    subject: sujet,
    html,
  })

  if (sent.error) {
    return NextResponse.json({ error: sent.error.message, checks }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    changed: alerte,
    alerted: true,
    bareme: tauxPaieSignature(),
    checks,
    email_id: sent.data?.id,
  })
}

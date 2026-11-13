import { escapeHtml } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"

export type RapportFactureMessageCtx = {
  clientNom: string
  technicienNom: string
  ville: string
  dateIntervention: string
  reference: string
  factureNumero: string
  totalTTC: number | null
  /** @deprecated Plus inclus par défaut — avis demandé à la main sur place. */
  reviewUrl?: string
  stopUrl?: string
  tel: string
  rapportUrl?: string
  factureUrl?: string
  /** Facture déjà réglée sur place */
  factureReglee?: boolean
  /** Inclure le CTA avis Google (désactivé par défaut). */
  includeReview?: boolean
  /** Attestation de conformité jointe (si générée pour l'intervention). */
  attestationJointe?: boolean
  attestationNumero?: string | null
  /** Accord signé sur place, joint au mail. */
  accordJoint?: boolean
}

function formatDateFr(iso: string): string {
  if (!iso) return ""
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return iso
}

/** Texte SMS / plain — même fond que le mail client. */
export function buildRapportFacturePlainText(ctx: RapportFactureMessageCtx): string {
  const cn = ctx.clientNom || "Madame, Monsieur"
  const di = formatDateFr(ctx.dateIntervention) || ctx.dateIntervention
  const v = ctx.ville
  const ref = ctx.reference
  const num = ctx.factureNumero
  const ttc = typeof ctx.totalTTC === "number" ? fmtEUR(ctx.totalTTC) : ""
  const lines = [
    `Bonjour ${cn},`,
    "",
    `Suite à notre intervention du ${di}${v ? ` à ${v}` : ""}, vous trouverez ci-dessous vos documents :`,
    "",
    `Rapport d'intervention (réf. ${ref})${ctx.rapportUrl ? ` : ${ctx.rapportUrl}` : ""}`,
    `Facture${num ? ` ${num}` : ""}${ttc ? ` — ${ttc} TTC` : ""}${ctx.factureUrl ? ` : ${ctx.factureUrl}` : ""}`,
    ...(ctx.accordJoint ? ["Accord signé sur place"] : []),
    ...(ctx.attestationJointe
      ? [`Attestation de conformité${ctx.attestationNumero ? ` ${ctx.attestationNumero}` : ""}`]
      : []),
    "",
    `Pour tout règlement ou question : ${ctx.tel}.`,
    "",
    ...(ctx.includeReview && ctx.reviewUrl
      ? [
          "Votre avis compte — si vous êtes satisfait, laissez un avis Google :",
          ctx.reviewUrl,
          "",
        ]
      : []),
    `Cordialement,`,
    `${ctx.technicienNom} — Expert en assainissement`,
    "Les Techniciens du Débouchage",
  ]
  return lines.join("\n")
}

/** Version courte pour SMS (liens + texte essentiel, moins de risque de dépassement URI). */
export function buildRapportFactureSmsText(ctx: RapportFactureMessageCtx): string {
  const cn = ctx.clientNom || "Madame, Monsieur"
  const di = formatDateFr(ctx.dateIntervention) || ctx.dateIntervention
  const v = ctx.ville
  const ref = ctx.reference
  const num = ctx.factureNumero
  const ttc = typeof ctx.totalTTC === "number" ? fmtEUR(ctx.totalTTC) : ""
  const lines = [
    `Bonjour ${cn},`,
    `Intervention du ${di}${v ? ` à ${v}` : ""} — Les Techniciens du Débouchage.`,
    ctx.rapportUrl ? `Rapport (réf. ${ref}) : ${ctx.rapportUrl}` : `Rapport réf. ${ref}`,
    ctx.factureUrl
      ? `Facture${num ? ` ${num}` : ""}${ttc ? ` (${ttc} TTC)` : ""} : ${ctx.factureUrl}`
      : (num ? `Facture ${num}` : "Facture"),
    `Contact : ${ctx.tel}`,
    ...(ctx.includeReview && ctx.reviewUrl ? [`Avis Google : ${ctx.reviewUrl}`] : []),
    `Cordialement, ${ctx.technicienNom}`,
  ]
  return lines.filter(Boolean).join("\n")
}

function docCard(accent: string, title: string, detail: string): string {
  return `<tr>
    <td style="padding:0 0 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
        <tr>
          <td width="6" style="width:6px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding:14px 16px;">
            <div style="font-size:15px;line-height:1.3;font-weight:bold;color:#0e2a52;">${title}</div>
            <div style="font-size:13px;line-height:1.45;color:#64748b;margin-top:3px;">${detail}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`
}

export function buildRapportFactureHtml(ctx: RapportFactureMessageCtx): string {
  const cn = escapeHtml(ctx.clientNom || "Madame, Monsieur")
  const tn = escapeHtml(ctx.technicienNom)
  const v = escapeHtml(ctx.ville)
  const di = escapeHtml(formatDateFr(ctx.dateIntervention) || ctx.dateIntervention)
  const ref = escapeHtml(ctx.reference)
  const num = escapeHtml(ctx.factureNumero)
  const ttc = typeof ctx.totalTTC === "number" ? fmtEUR(ctx.totalTTC) : ""
  const tel = escapeHtml(ctx.tel)
  const telHref = ctx.tel.replace(/\s+/g, "")
  const ru = ctx.reviewUrl ? encodeURI(ctx.reviewUrl) : ""
  const su = ctx.stopUrl ? encodeURI(ctx.stopUrl) : ""
  const attNum = escapeHtml(ctx.attestationNumero || "")
  const lieu = v ? ` à ${v}` : ""

  const cards = [
    docCard("#0e2a52", "Rapport d'intervention", `Le détail de ce qui a été fait. Réf. ${ref}`),
    docCard("#c0392b", `Facture${num ? ` ${num}` : ""}`, ttc ? `${ttc} TTC` : "Le montant et les coordonnées de règlement."),
    ...(ctx.accordJoint
      ? [docCard("#0d9488", "Accord signé", "Le document que vous avez signé sur place.")]
      : []),
    ...(ctx.attestationJointe
      ? [docCard("#1d4ed8", "Attestation", attNum ? `N° ${attNum}` : "Jointe à ce mail.")]
      : []),
  ].join("")

  const paiement = ctx.factureReglee
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
        <tr><td style="background:#ecfdf3;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;">
          <p style="margin:0;font-size:14px;line-height:1.5;color:#166534;"><strong>Intervention déjà réglée.</strong> La facture jointe confirme qu'il ne reste rien à payer.</p>
        </td></tr>
      </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
        <tr><td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;">
          <p style="margin:0;font-size:14px;line-height:1.55;color:#9a3412;">Le règlement se fait avec les coordonnées indiquées sur la facture, ou par téléphone au <a href="tel:${telHref}" style="color:#c2410c;font-weight:bold;text-decoration:none;">${tel}</a>.</p>
        </td></tr>
      </table>`

  const reviewBlock = ctx.includeReview && ru
    ? `<p style="margin:22px 0 0;font-size:14px;line-height:1.55;color:#334155;">Si vous êtes satisfait, un avis sur Google nous aide beaucoup.</p>
       <p style="margin:12px 0 0;"><a href="${ru}" style="display:inline-block;background:#e67e22;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:999px;">Laisser un avis sur Google</a></p>
       ${su ? `<p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Déjà fait ? <a href="${su}" style="color:#64748b;">Ne plus recevoir de relance</a>.</p>` : ""}`
    : ""

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vos documents</title>
</head>
<body style="margin:0;padding:0;background:#eef3fb;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td style="height:6px;background:#c0392b;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr>
  <td style="background:#0e2a52;padding:28px 28px 22px;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#f5c542;font-weight:bold;">Les Techniciens du Débouchage</p>
    <h1 style="margin:0;font-size:24px;line-height:1.25;color:#ffffff;font-weight:bold;">Vos documents sont prêts</h1>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.45;color:#d7e6ff;">Intervention du ${di}${lieu}</p>
  </td>
</tr>
<tr>
  <td style="padding:28px 28px 8px;color:#1a2433;">
    <p style="margin:0 0 14px;font-size:16px;line-height:1.5;">Bonjour <strong style="color:#0e2a52;">${cn}</strong>,</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#334155;">Merci pour votre confiance. Les pièces de l'intervention sont jointes à ce mail, chacune dans son fichier.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
    ${paiement}
    ${reviewBlock}
  </td>
</tr>
<tr>
  <td style="padding:8px 28px 24px;">
    <p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#475569;">
      Bien à vous,<br>
      <strong style="color:#0e2a52;font-size:15px;">${tn}</strong><br>
      Les Techniciens du Débouchage<br>
      <a href="tel:${telHref}" style="color:#c0392b;font-weight:bold;text-decoration:none;">${tel}</a>
    </p>
  </td>
</tr>
<tr>
  <td style="background:#0e2a52;padding:14px 20px;text-align:center;">
    <p style="margin:0;font-size:11px;letter-spacing:0.04em;color:#9fb4d4;">LES TECHNICIENS DU DÉBOUCHAGE · lestechniciensdudebouchage.fr</p>
  </td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

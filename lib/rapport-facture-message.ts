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
  reviewUrl: string
  stopUrl?: string
  tel: string
  rapportUrl?: string
  factureUrl?: string
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
    `📝 Rapport d'intervention (réf. ${ref})${ctx.rapportUrl ? ` : ${ctx.rapportUrl}` : ""}`,
    `🧾 Facture${num ? ` ${num}` : ""}${ttc ? ` — ${ttc} TTC` : ""}${ctx.factureUrl ? ` : ${ctx.factureUrl}` : ""}`,
    "",
    `Pour tout règlement ou question : ${ctx.tel}.`,
    "",
    "Votre avis compte — si vous êtes satisfait, laissez un avis Google :",
    ctx.reviewUrl,
    "",
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
    `Avis Google : ${ctx.reviewUrl}`,
    `Cordialement, ${ctx.technicienNom}`,
  ]
  return lines.filter(Boolean).join("\n")
}

export function buildRapportFactureHtml(ctx: RapportFactureMessageCtx): string {
  const cn = escapeHtml(ctx.clientNom || "Madame, Monsieur")
  const tn = escapeHtml(ctx.technicienNom)
  const v = escapeHtml(ctx.ville)
  const di = escapeHtml(formatDateFr(ctx.dateIntervention) || ctx.dateIntervention)
  const ref = escapeHtml(ctx.reference)
  const num = escapeHtml(ctx.factureNumero)
  const ttc = typeof ctx.totalTTC === "number" ? fmtEUR(ctx.totalTTC) : ""
  const ru = encodeURI(ctx.reviewUrl)
  const su = ctx.stopUrl ? encodeURI(ctx.stopUrl) : ""

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
  <tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#0e2a52,#2c5fa8);padding:28px;color:#fff">
        <h1 style="margin:0;font-size:22px">Votre rapport et votre facture</h1>
        <p style="margin:6px 0 0;opacity:.85;font-size:13px">Les Techniciens du Débouchage</p>
      </td></tr>
      <tr><td style="padding:28px">
        <p>Bonjour ${cn},</p>
        <p>Suite à notre intervention du <strong>${di}</strong>${v ? ` à <strong>${v}</strong>` : ""}, vous trouverez ci-joint :</p>
        <ul style="font-size:14px">
          <li>📝 Votre rapport d'intervention détaillé (réf. ${ref})</li>
          <li>🧾 Votre facture${num ? ` ${num}` : ""}${ttc ? ` — ${ttc} TTC` : ""}</li>
        </ul>
        <p>Pour tout règlement ou question : <strong>${escapeHtml(ctx.tel)}</strong>.</p>

        <div style="margin:30px 0;padding:20px;background:#fef0e0;border-left:4px solid #e67e22;border-radius:4px">
          <p style="margin:0 0 10px;font-weight:bold;color:#a04e09">Votre avis compte</p>
          <p style="margin:0 0 14px;font-size:14px">Si vous êtes satisfait, prenez 30 secondes pour laisser un avis Google.</p>
          <a href="${ru}" style="display:inline-block;background:#e67e22;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">⭐ Laisser un avis Google</a>
          ${su ? `<p style="margin:12px 0 0;font-size:12px;color:#6b7280">Vous avez déjà laissé un avis ? <a href="${su}" style="color:#2c5fa8">Cliquez ici pour ne plus recevoir de relance</a>.</p>` : ""}
        </div>

        <p style="margin-top:30px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong> — Expert en assainissement<br>Les Techniciens du Débouchage</p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:18px;text-align:center;font-size:11px">
        Les Techniciens du Débouchage · ${escapeHtml(ctx.tel)} · lestechniciensdudebouchage.fr
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

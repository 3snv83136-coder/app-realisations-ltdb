import crypto from "crypto"
import { Resend } from "resend"
import { escapeHtml, getResendFromEmail, getResendRecipient } from "@/lib/email-utils"
import { fmtEUR } from "@/lib/format"
import { getTelPrincipal } from "@/lib/parametres"
import { getSupabaseOrNull } from "@/lib/supabase"
import type { FacturePayload, FacturePayloadMeta } from "@/lib/types-documents"

/** Relances paiement planifiées à l'envoi de la facture (si non réglée). */
export const JOURS_RELANCE_FACTURE = [10, 15, 20] as const
export const NB_RELANCES_FACTURE = JOURS_RELANCE_FACTURE.length

/** @deprecated Utiliser JOURS_RELANCE_FACTURE */
export const SEMAINES_RELANCE_FACTURE = NB_RELANCES_FACTURE

export type RelanceFactureTone = "cordial" | "neutre" | "ferme" | "ferme_plus"

export function toneForRelanceNumero(numero: number): RelanceFactureTone {
  if (numero <= 1) return "cordial"
  if (numero === 2) return "ferme"
  return "ferme_plus"
}

export function isFactureReglee(echeance?: string | null): boolean {
  return /^r[ée]gl[ée]e?$/i.test((echeance || "").trim())
}

/** Facture sans relance paiement : statut payé en base OU échéance « réglée ». */
export function isFacturePayeeOuReglee(statut?: string | null, echeance?: string | null): boolean {
  return statut === "paye" || isFactureReglee(echeance)
}

export function mergeFacturePayloadMeta(
  facture: Partial<FacturePayload> | Record<string, unknown>,
  meta: FacturePayloadMeta,
): Partial<FacturePayload> {
  const { _ltdb_meta, ...rest } = facture as Record<string, unknown>
  return {
    ...rest,
    _ltdb_meta: { ...(typeof _ltdb_meta === "object" && _ltdb_meta ? _ltdb_meta : {}), ...meta },
  } as Partial<FacturePayload>
}

export function relanceIdsFromPayload(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return []
  const meta = (payload as { _ltdb_meta?: { relance_ids?: string[] } })._ltdb_meta
  return Array.isArray(meta?.relance_ids) ? meta.relance_ids.filter(Boolean) : []
}

export async function annulerRelancesFacture(documentId: string): Promise<number> {
  const sb = getSupabaseOrNull()
  if (!sb) return 0
  const { data } = await sb.from("documents").select("payload").eq("id", documentId).maybeSingle()
  const ids = relanceIdsFromPayload(data?.payload)
  if (ids.length === 0) return 0

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return 0

  const resend = new Resend(resendKey)
  let canceled = 0
  for (const id of ids) {
    try {
      await resend.emails.cancel(id)
      canceled++
    } catch {
      /* déjà envoyé ou id invalide */
    }
  }

  const payload = data?.payload as Record<string, unknown>
  await sb
    .from("documents")
    .update({
      payload: mergeFacturePayloadMeta(payload || {}, { relance_ids: [], relance_planifiees: 0 }),
    })
    .eq("id", documentId)

  return canceled
}

/**
 * Marque une facture payée et annule toutes ses relances Resend planifiées.
 * À utiliser partout où le statut passe à « paye » (historique, compta…).
 */
export async function marquerFacturePayee(documentId: string): Promise<number> {
  const canceled = await annulerRelancesFacture(documentId)
  const sb = getSupabaseOrNull()
  if (sb) {
    await sb
      .from("documents")
      .update({ statut: "paye", updated_at: new Date().toISOString() })
      .eq("id", documentId)
      .eq("type", "facture")
  }
  return canceled
}

export type AnnulerRelancesPayeesResult = {
  facturesPayees: number
  avecRelances: number
  relancesAnnulees: number
  details: Array<{ id: string; numero: string | null; canceled: number }>
}

/**
 * Rétroactif : annule les relances encore planifiées sur toutes les factures
 * déjà marquées payées (ou échéance « réglée ») en base.
 */
export async function annulerRelancesToutesFacturesPayees(): Promise<AnnulerRelancesPayeesResult> {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return { facturesPayees: 0, avecRelances: 0, relancesAnnulees: 0, details: [] }
  }

  const { data: factures } = await sb
    .from("documents")
    .select("id, numero, statut, echeance, payload")
    .eq("type", "facture")
    .in("statut", ["paye", "envoye", "brouillon"])

  const eligible = (factures || []).filter(
    f => isFacturePayeeOuReglee(f.statut, f.echeance) && relanceIdsFromPayload(f.payload).length > 0,
  )

  let relancesAnnulees = 0
  const details: AnnulerRelancesPayeesResult["details"] = []

  for (const f of eligible) {
    const canceled = await annulerRelancesFacture(f.id)
    relancesAnnulees += canceled
    details.push({ id: f.id, numero: f.numero, canceled })
  }

  const payeesCount = (factures || []).filter(f => isFacturePayeeOuReglee(f.statut, f.echeance)).length

  return {
    facturesPayees: payeesCount,
    avecRelances: eligible.length,
    relancesAnnulees,
    details,
  }
}

function buildStopUrl(baseUrl: string, reminderIds: string[], secret: string): string {
  if (reminderIds.length === 0) return ""
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000
  const payload = Buffer.from(JSON.stringify({ ids: reminderIds, kind: "facture" }), "utf-8").toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(`${payload}.${exp}`).digest("hex")
  return `${baseUrl.replace(/\/+$/, "")}/api/facture/stop-reminders?p=${encodeURIComponent(payload)}&exp=${exp}&sig=${sig}`
}

function emailRelanceFacture(input: {
  clientNom?: string | null
  technicienNom: string
  ville?: string | null
  numero?: string | null
  totalTTC?: number | null
  echeance?: string | null
  dateFacture?: string | null
  numeroRelance: number
  joursApresEnvoi: number
  tone: RelanceFactureTone
  tel: string
  stopUrl?: string
}): string {
  const cn = escapeHtml(input.clientNom || "Madame, Monsieur")
  const tn = escapeHtml(input.technicienNom)
  const v = escapeHtml(input.ville || "")
  const num = escapeHtml(input.numero || "")
  const ttc = typeof input.totalTTC === "number" ? fmtEUR(input.totalTTC) : ""
  const ech = escapeHtml(input.echeance || "À réception")
  const dd = escapeHtml(input.dateFacture || "")
  const su = input.stopUrl ? encodeURI(input.stopUrl) : ""
  const n = input.numeroRelance
  const total = NB_RELANCES_FACTURE

  const intros: Record<RelanceFactureTone, string> = {
    cordial: `<p>Bonjour ${cn},</p>
<p>Sauf erreur de notre part, nous n'avons pas encore enregistré le règlement de la facture${num ? ` n°<strong>${num}</strong>` : ""}${v ? ` relative à notre intervention à <strong>${v}</strong>` : ""}${dd ? ` du ${dd}` : ""}.</p>
<p>Ceci est un <strong>rappel amical (relance n°${n}/${total})</strong>. Si un virement est en cours, vous pouvez ignorer ce message.</p>`,
    neutre: `<p>Bonjour ${cn},</p>
<p><strong>Relance n°${n}/${total}</strong> — nous n'avons toujours pas reçu le règlement de la facture${num ? ` <strong>${num}</strong>` : ""}${v ? ` pour <strong>${v}</strong>` : ""}.</p>
<p>Merci de régulariser ou de nous contacter si un élément bloque le paiement.</p>`,
    ferme: `<p>Bonjour ${cn},</p>
<p><strong>Relance n°${n}/${total} — paiement en attente</strong> concernant la facture${num ? ` ${num}` : ""}${v ? ` (${v})` : ""}.</p>
<p>Nous vous remercions de procéder au règlement dans les meilleurs délais. Les coordonnées bancaires figurent sur la facture initiale.</p>`,
    ferme_plus: `<p>Bonjour ${cn},</p>
<p><strong>Relance n°${n}/${total} — dernier rappel</strong> avant transmission du dossier à notre service de recouvrement.</p>
<p>La facture${num ? ` <strong>${num}</strong>` : ""} demeure impayée malgré nos précédents messages. Merci de régulariser sous <strong>7 jours</strong> ou de nous appeler pour convenir d'un échéancier.</p>`,
  }

  const headerColors: Record<RelanceFactureTone, string> = {
    cordial: "linear-gradient(135deg,#0e2a52,#2c5fa8)",
    neutre: "linear-gradient(135deg,#334155,#475569)",
    ferme: "linear-gradient(135deg,#b45309,#d97706)",
    ferme_plus: "linear-gradient(135deg,#b91c1c,#dc2626)",
  }

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
<tr><td style="background:${headerColors[input.tone]};padding:28px;color:#fff">
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85;margin-bottom:6px">Relance n°${n} — J+${input.joursApresEnvoi}</div>
<h1 style="margin:0;font-size:21px">${num ? `Facture ${num}` : "Facture en attente"}</h1>
</td></tr>
<tr><td style="padding:28px">
${intros[input.tone]}
${ttc ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:8px">
<tr><td style="padding:14px 18px;color:#475569;font-size:13px">Montant TTC</td>
<td style="padding:14px 18px;text-align:right;font-size:17px;font-weight:bold;color:#0e2a52">${ttc}</td></tr>
<tr><td style="padding:14px 18px;color:#475569;font-size:13px;border-top:1px solid #e2e8f0">Échéance</td>
<td style="padding:14px 18px;text-align:right;font-size:14px;border-top:1px solid #e2e8f0">${ech}</td></tr>
</table>` : ""}
<p style="font-size:14px">La facture PDF vous a été transmise par email. Pour toute question : <strong>${escapeHtml(input.tel)}</strong> ou réponse à ce message.</p>
${su ? `<p style="margin-top:16px;font-size:12px;color:#64748b">Déjà réglé ? <a href="${su}" style="color:#2c5fa8">Cliquez ici pour arrêter les relances</a>.</p>` : ""}
<p style="margin-top:24px;font-size:13px;color:#666">Cordialement,<br><strong>${tn}</strong><br>Les Techniciens du Débouchage</p>
</td></tr>
<tr><td style="background:#0e2a52;color:#a0c0ff;padding:16px;text-align:center;font-size:11px">
Les Techniciens du Débouchage · ${escapeHtml(input.tel)}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

export type PlanifierFactureRelancesInput = {
  baseUrl: string
  clientEmail: string
  clientNom?: string | null
  technicienNom?: string | null
  ville?: string | null
  dateFacture?: string | null
  numero?: string | null
  totalTTC?: number | null
  echeance?: string | null
  /** ISO — ancrage des relances (défaut : maintenant) */
  anchorAt?: string
}

export type PlanifierFactureRelancesResult = {
  reminderIds: string[]
  reminderErrors: string[]
  stopUrl: string
}

export async function planifierFactureRelances(
  input: PlanifierFactureRelancesInput,
): Promise<PlanifierFactureRelancesResult> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) throw new Error("RESEND_API_KEY manquante")

  const fromEmail = getResendFromEmail()
  const recipient = getResendRecipient(input.clientEmail)
  const tech = input.technicienNom || "votre technicien"
  const tel = await getTelPrincipal()
  const signSecret = process.env.REVIEW_STOP_SECRET || process.env.NEXTAUTH_SECRET || resendKey

  const anchor = input.anchorAt ? new Date(input.anchorAt) : new Date()
  const resend = new Resend(resendKey)

  const reminderIds: string[] = []
  const reminderErrors: string[] = []

  for (let i = 0; i < JOURS_RELANCE_FACTURE.length; i++) {
    const jours = JOURS_RELANCE_FACTURE[i]
    const numeroRelance = i + 1
    const tone = toneForRelanceNumero(numeroRelance)

    const result = await resend.emails.send({
      from: `Les Techniciens du Débouchage <${fromEmail}>`,
      to: recipient,
      subject: input.numero
        ? `Relance n°${numeroRelance} — Facture ${input.numero}${input.ville ? ` — ${input.ville}` : ""}`
        : `Relance n°${numeroRelance} — facture en attente`,
      html: emailRelanceFacture({
        clientNom: input.clientNom,
        technicienNom: tech,
        ville: input.ville,
        numero: input.numero,
        totalTTC: input.totalTTC,
        echeance: input.echeance,
        dateFacture: input.dateFacture,
        numeroRelance,
        joursApresEnvoi: jours,
        tone,
        tel,
      }),
      scheduledAt: new Date(anchor.getTime() + jours * 24 * 60 * 60 * 1000).toISOString(),
    })

    if (result.data?.id) reminderIds.push(result.data.id)
    if (result.error) reminderErrors.push(`J+${jours}: ${result.error.message || "erreur"}`)
  }

  const stopUrl = buildStopUrl(input.baseUrl, reminderIds, signSecret)
  return { reminderIds, reminderErrors, stopUrl }
}

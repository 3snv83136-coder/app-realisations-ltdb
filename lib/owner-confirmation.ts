import type { Resend } from "resend"
import { EMAIL_RE, escapeHtml } from "@/lib/email-utils"
import { getOwnerNotifyEmail, getTelPrincipal } from "@/lib/parametres"

/**
 * Envoie une confirmation à la boîte du gérant indiquant qu'un mail client
 * (rapport et/ou facture) a bien été envoyé.
 *
 * Best-effort : ne lève jamais d'exception et ne bloque jamais le flux principal.
 * Renvoie un petit objet de statut à inclure dans la réponse API (optionnel).
 */
export async function sendOwnerConfirmation(opts: {
  resend: Resend
  fromEmail: string
  type: 'rapport_facture' | 'facture'
  clientNom?: string
  clientEmail: string
  /** Adresse réellement utilisée pour l'envoi (peut différer en mode test). */
  destinataireReel?: string
  ville?: string
  reference?: string
  factureNumero?: string
  totalTTC?: number | null
  ccEmail?: string
  messageId?: string
}): Promise<{ sent: boolean; id?: string; error?: string }> {
  try {
    const ownerEmail = (await getOwnerNotifyEmail()).trim()
    if (!ownerEmail || !EMAIL_RE.test(ownerEmail)) {
      return { sent: false, error: 'OWNER_NOTIFY_EMAIL absent ou invalide' }
    }

    const tel = await getTelPrincipal()
    const quoiLabel = opts.type === 'rapport_facture' ? 'Rapport + facture' : 'Facture'
    const ttc = typeof opts.totalTTC === 'number'
      ? `${opts.totalTTC.toFixed(2).replace('.', ',')} €`
      : ''
    const sujet = `✅ Envoyé : ${quoiLabel}${opts.factureNumero ? ` ${opts.factureNumero}` : ''}`
      + `${opts.clientNom ? ` — ${opts.clientNom}` : ''}`

    const result = await opts.resend.emails.send({
      from: `Confirmation LTDB <${opts.fromEmail}>`,
      to: ownerEmail,
      subject: sujet,
      html: buildHtml({ ...opts, ttc, tel, quoiLabel }),
    })

    if (result.error) {
      return { sent: false, error: result.error.message || 'Resend a rejeté la confirmation' }
    }
    return { sent: true, id: result.data?.id }
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function row(label: string, value: string): string {
  if (!value) return ''
  return `<tr>
    <td style="padding:8px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #eef2f7">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;color:#0e2a52;font-size:13px;font-weight:bold;border-bottom:1px solid #eef2f7">${escapeHtml(value)}</td>
  </tr>`
}

function buildHtml(opts: {
  quoiLabel: string
  clientNom?: string
  clientEmail: string
  destinataireReel?: string
  ville?: string
  reference?: string
  factureNumero?: string
  ccEmail?: string
  ttc: string
  tel: string
  messageId?: string
}): string {
  const now = new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
  const destinataire = opts.destinataireReel && opts.destinataireReel !== opts.clientEmail
    ? `${opts.clientEmail} (redirigé vers ${opts.destinataireReel})`
    : opts.clientEmail

  return `<!doctype html>
<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f6fa;color:#1a1a1a">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:28px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <tr><td style="background:#0f7a3b;padding:22px 24px;color:#fff">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Confirmation d'envoi</div>
        <h1 style="margin:6px 0 0;font-size:20px">${escapeHtml(opts.quoiLabel)} envoyé au client</h1>
      </td></tr>
      <tr><td style="padding:22px 24px">
        <p style="margin:0 0 16px;font-size:14px">Le mail a bien été remis au serveur d'envoi le <strong>${escapeHtml(now)}</strong>.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:8px;overflow:hidden">
          ${row('Client', opts.clientNom || '—')}
          ${row('Destinataire', destinataire)}
          ${row('Ville', opts.ville || '')}
          ${row('Référence', opts.reference || '')}
          ${row('N° facture', opts.factureNumero || '')}
          ${row('Montant TTC', opts.ttc)}
          ${row('Copie (CC)', opts.ccEmail || '')}
          ${row('ID message', opts.messageId || '')}
        </table>
        <p style="margin:18px 0 0;font-size:12px;color:#64748b">
          Cet e-mail automatique confirme uniquement l'envoi. La bonne réception côté client dépend de sa messagerie.
        </p>
      </td></tr>
      <tr><td style="background:#0e2a52;color:#a0c0ff;padding:14px;text-align:center;font-size:11px">
        Les Techniciens du Débouchage · ${escapeHtml(opts.tel)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

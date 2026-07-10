import { Resend } from "resend"
import { EMAIL_RE } from "@/lib/email-constants"

export { EMAIL_RE } from "@/lib/email-constants"

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Adresse expéditeur effective :
 * - RESEND_FROM_EMAIL si défini (domaine vérifié) ;
 * - sinon onboarding@resend.dev en mode test ;
 * - sinon contact@lestechniciensdudebouchage.fr (peut échouer si domaine non vérifié).
 */
export function getResendFromEmail(): string {
  return (
    process.env.RESEND_FROM_EMAIL
    || (process.env.RESEND_TEST_EMAIL ? 'onboarding@resend.dev' : 'contact@lestechniciensdudebouchage.fr')
  )
}

/** Destinataire effectif : si RESEND_TEST_EMAIL est défini il prime sur le client. */
export function getResendRecipient(clientEmail: string): string {
  return process.env.RESEND_TEST_EMAIL || clientEmail
}

/** Mode test Resend : les mails ne partent pas au client réel. */
export function isResendTestMode(): boolean {
  return !!process.env.RESEND_TEST_EMAIL?.trim()
}

/**
 * Adresse de réponse (Reply-To) : les réponses des clients y arrivent.
 * Améliore aussi la délivrabilité (en-tête présent, cohérent avec le domaine).
 */
export function getReplyToEmail(): string {
  return process.env.RESEND_REPLY_TO || 'contact@lestechniciensdudebouchage.fr'
}

/**
 * En-têtes anti-spam recommandés (List-Unsubscribe) : Gmail/Outlook les exigent
 * de plus en plus pour les emails de relance. `stopUrl` = lien de désinscription
 * (si disponible), complété d'un repli mailto.
 */
export function buildUnsubscribeHeaders(stopUrl?: string): Record<string, string> {
  const mailto = `mailto:${getReplyToEmail()}?subject=STOP`
  const value = stopUrl ? `<${stopUrl}>, <${mailto}>` : `<${mailto}>`
  return { 'List-Unsubscribe': value }
}

/**
 * Conversion HTML → texte brut (basique) pour fournir une alternative `text`
 * aux emails. Un email multipart (HTML + texte) est nettement moins souvent
 * classé en spam qu'un email HTML seul.
 */
export function htmlToText(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|tr|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .split('\n').map(l => l.trim()).join('\n')
    .trim()
}

/** Message d'aide si Resend rejette l'envoi (domaine non vérifié, sandbox, etc.). */
export function resendErrorHint(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined
  const err = (payload as { error?: string; hint?: string }).error || ""
  const hint = (payload as { hint?: string }).hint
  if (hint) return hint
  if (/validation_error|only send testing emails|not verified/i.test(err)) {
    return "Vérifie RESEND_FROM_EMAIL sur Vercel ou configure RESEND_TEST_EMAIL pour les tests."
  }
  return undefined
}

export type ResendCtx = {
  resend: Resend
  fromEmail: string
  recipient: string
}

/**
 * Initialise Resend ou renvoie une erreur structurée.
 * Pattern d'usage :
 *   const ctx = initResend(clientEmail)
 *   if ('error' in ctx) return NextResponse.json(ctx, { status: ctx.status })
 */
export function initResend(clientEmail: string): ResendCtx | { error: string; status: number } {
  if (!clientEmail || typeof clientEmail !== 'string' || !EMAIL_RE.test(clientEmail)) {
    return { error: 'Email client invalide', status: 400 }
  }
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return { error: 'RESEND_API_KEY manquante', status: 500 }
  }
  return {
    resend: new Resend(resendKey),
    fromEmail: getResendFromEmail(),
    recipient: getResendRecipient(clientEmail),
  }
}

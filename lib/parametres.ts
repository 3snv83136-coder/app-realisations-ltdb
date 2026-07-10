import { getSupabaseOrNull } from "@/lib/supabase"
import { EMAIL_RE } from "@/lib/email-utils"

/**
 * Numéro de téléphone principal LTDB — source unique de vérité côté code.
 * La valeur de référence vit dans la table `parametres` (clé `TEL_PRINCIPAL`).
 * Cette constante sert uniquement de repli si la base est injoignable ou
 * pour les contextes synchrones (composants client / PDF).
 */
export const TEL_PRINCIPAL_FALLBACK = '07 83 63 68 35'

/**
 * Lit un paramètre depuis la table `parametres`. Best-effort : en cas d'erreur
 * (Supabase non configuré, table absente, réseau) on retourne le fallback.
 */
export async function getParametre(cle: string, fallback = ''): Promise<string> {
  try {
    const sb = getSupabaseOrNull()
    if (!sb) return fallback
    const { data } = await sb
      .from('parametres')
      .select('valeur')
      .eq('cle', cle)
      .maybeSingle()
    return data?.valeur?.trim() || fallback
  } catch {
    return fallback
  }
}

/** Renvoie le téléphone principal LTDB (table `parametres`, repli sur la constante). */
export function getTelPrincipal(): Promise<string> {
  return getParametre('TEL_PRINCIPAL', TEL_PRINCIPAL_FALLBACK)
}

/** Email expert-comptable (pré-bilan). */
export function getEmailComptable(): Promise<string> {
  return getParametre('EMAIL_COMPTABLE', process.env.EMAIL_COMPTABLE || '')
}

/** Destinataire alertes compta (relevé manquant le 5 du mois). */
export function getComptaAlertEmail(): Promise<string> {
  const fallback = process.env.COMPTA_ALERT_EMAIL || process.env.EMAIL_COMPTABLE || ''
  return getParametre('COMPTA_ALERT_EMAIL', fallback)
}

/**
 * Boîte(s) mail du gérant pour les confirmations d'envoi.
 * Combine paramètre Supabase + variable d'environnement (dédupliquées).
 */
export async function getOwnerNotifyEmails(): Promise<string[]> {
  const fallback = (process.env.OWNER_NOTIFY_EMAIL || 'LesTechniciensDuDebouchage@gmail.com').trim()
  const fromDb = (await getParametre('OWNER_NOTIFY_EMAIL', '')).trim()
  const candidates = [fromDb, fallback].filter(Boolean)
  const valid = candidates.filter(e => EMAIL_RE.test(e))
  return Array.from(new Set(valid))
}

/** @deprecated Préférer getOwnerNotifyEmails */
export function getOwnerNotifyEmail(): Promise<string> {
  return getOwnerNotifyEmails().then(list => list[0] || process.env.OWNER_NOTIFY_EMAIL || 'LesTechniciensDuDebouchage@gmail.com')
}

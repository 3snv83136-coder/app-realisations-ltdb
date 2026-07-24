import { getSupabaseOrNull } from '@/lib/supabase'
import type { SessionUser } from '@/lib/intervention-access'

/**
 * Permissions fines des comptes techniciens (colonne jsonb
 * comptes_techniciens.permissions). Tout est vrai par défaut : le
 * comportement historique est conservé tant que le gérant ne décoche rien,
 * et les comptes AUTH_TECH_N (env, sans ligne en base) gardent tous
 * les droits du rôle tech.
 */
export type TechPermissions = {
  /** Voir les prix (prix_prevu masqué dans les API interventions si false) */
  voir_prix: boolean
  /** Créer une facture depuis le mode terrain */
  creer_facture: boolean
  /** Envoyer un devis au client */
  envoyer_devis: boolean
}

export const DEFAULT_TECH_PERMISSIONS: TechPermissions = {
  voir_prix: true,
  creer_facture: true,
  envoyer_devis: true,
}

export const TECH_PERMISSION_KEYS = Object.keys(DEFAULT_TECH_PERMISSIONS) as (keyof TechPermissions)[]

export const TECH_PERMISSION_LABELS: Record<keyof TechPermissions, string> = {
  voir_prix: 'Voir les prix',
  creer_facture: 'Créer une facture',
  envoyer_devis: 'Envoyer un devis',
}

/** Ne garde que les clés connues, en booléens stricts (reste → défauts). */
export function sanitizeTechPermissions(raw: unknown): TechPermissions {
  const out = { ...DEFAULT_TECH_PERMISSIONS }
  if (raw && typeof raw === 'object') {
    for (const key of TECH_PERMISSION_KEYS) {
      const v = (raw as Record<string, unknown>)[key]
      if (typeof v === 'boolean') out[key] = v
    }
  }
  return out
}

/**
 * Permissions effectives d'une session : admin = tout ; tech = ligne
 * comptes_techniciens (par login) fusionnée avec les défauts ; tech env
 * sans ligne en base = défauts (tout autorisé).
 */
export async function permissionsForSession(user: SessionUser | null): Promise<TechPermissions> {
  if (!user || user.role !== 'tech') return { ...DEFAULT_TECH_PERMISSIONS }

  const login = (user.login || '').trim().toLowerCase()
  if (!login) return { ...DEFAULT_TECH_PERMISSIONS }

  const sb = getSupabaseOrNull()
  if (!sb) return { ...DEFAULT_TECH_PERMISSIONS }

  const { data, error } = await sb
    .from('comptes_techniciens')
    .select('permissions')
    .eq('login', login)
    .maybeSingle()

  if (error || !data) return { ...DEFAULT_TECH_PERMISSIONS }
  return sanitizeTechPermissions(data.permissions)
}

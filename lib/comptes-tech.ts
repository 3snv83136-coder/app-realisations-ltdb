import bcrypt from 'bcryptjs'
import type { AuthAccount } from '@/lib/auth-users'
import { getAllAuthAccounts } from '@/lib/auth-users'
import { getSupabaseOrNull } from '@/lib/supabase'

export type CompteTechRow = {
  id: string
  login: string
  technicien_id: string
  technicien_nom: string | null
  actif: boolean
  revoked_at: string | null
  created_by: string | null
  created_at: string
  dernier_login_at: string | null
}

const LOGIN_RE = /^[a-zA-Z0-9._-]{3,32}$/

const SELECT_COLS = 'id, login, technicien_id, actif, revoked_at, created_by, created_at, dernier_login_at, techniciens(nom)'

type RawRow = Omit<CompteTechRow, 'technicien_nom'> & {
  techniciens: { nom: string | null } | { nom: string | null }[] | null
}

function toRow(raw: RawRow): CompteTechRow {
  const rel = raw.techniciens
  const nom = Array.isArray(rel) ? rel[0]?.nom ?? null : rel?.nom ?? null
  return {
    id: raw.id,
    login: raw.login,
    technicien_id: raw.technicien_id,
    technicien_nom: nom,
    actif: raw.actif,
    revoked_at: raw.revoked_at,
    created_by: raw.created_by,
    created_at: raw.created_at,
    dernier_login_at: raw.dernier_login_at,
  }
}

export function normalizeTechLogin(login: string): string {
  return login.trim().toLowerCase()
}

export function validateTechLogin(login: string): string | null {
  const raw = login.trim()
  if (!raw) return 'L\'identifiant est obligatoire.'
  if (!LOGIN_RE.test(raw)) {
    return 'Identifiant : 3 à 32 caractères (lettres, chiffres, . _ -).'
  }
  const l = normalizeTechLogin(raw)
  if (getAllAuthAccounts().some(a => a.login.toLowerCase() === l)) {
    return 'Cet identifiant est déjà utilisé par un compte des variables d\'environnement.'
  }
  return null
}

export function validateTechPassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.'
  }
  return null
}

/** Vérifie login + mot de passe d'un compte technicien en base. */
export async function verifyCompteTechCredentials(
  username: string,
  password: string | undefined,
): Promise<AuthAccount | null> {
  const login = normalizeTechLogin(username)
  const pwd = password ?? ''
  if (!login || !pwd) return null

  const sb = getSupabaseOrNull()
  if (!sb) return null

  const { data, error } = await sb
    .from('comptes_techniciens')
    .select('id, login, password_hash, technicien_id, actif, revoked_at')
    .eq('login', login)
    .maybeSingle()

  if (error || !data || !data.actif || data.revoked_at) return null

  const valid = await bcrypt.compare(pwd, data.password_hash as string)
  if (!valid) return null

  // Trace du dernier login — non bloquant.
  void sb
    .from('comptes_techniciens')
    .update({ dernier_login_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    id: `ctech-${data.id}`,
    login: data.login as string,
    role: 'tech',
    passwordHash: data.password_hash as string,
    technicienId: data.technicien_id as string,
    isDbTech: true,
  }
}

/** Compte encore valide (utilisé par le middleware pour couper les sessions révoquées). */
export async function isCompteTechActive(login: string): Promise<boolean> {
  const normalized = normalizeTechLogin(login)
  if (!normalized) return false

  const sb = getSupabaseOrNull()
  if (!sb) return false

  const { data, error } = await sb
    .from('comptes_techniciens')
    .select('actif, revoked_at')
    .eq('login', normalized)
    .maybeSingle()

  return !error && !!data && data.actif === true && !data.revoked_at
}

export async function listComptesTech(): Promise<CompteTechRow[]> {
  const sb = getSupabaseOrNull()
  if (!sb) return []

  const { data, error } = await sb
    .from('comptes_techniciens')
    .select(SELECT_COLS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data || []) as unknown as RawRow[]).map(toRow)
}

export async function createCompteTech(input: {
  login: string
  password: string
  technicienId: string
  createdBy?: string | null
}): Promise<CompteTechRow> {
  const loginErr = validateTechLogin(input.login)
  if (loginErr) throw new Error(loginErr)
  const pwdErr = validateTechPassword(input.password)
  if (pwdErr) throw new Error(pwdErr)
  if (!input.technicienId?.trim()) throw new Error('Choisis le technicien lié à ce compte.')

  const sb = getSupabaseOrNull()
  if (!sb) throw new Error('Supabase non configuré')

  const login = normalizeTechLogin(input.login)

  // Un login démo identique masquerait l'un des deux comptes à la connexion.
  const { data: demoClash } = await sb
    .from('demo_access')
    .select('id')
    .eq('login', login)
    .maybeSingle()
  if (demoClash) throw new Error('Cet identifiant est déjà utilisé par un accès démo.')

  const passwordHash = await bcrypt.hash(input.password, 10)

  const { data: existing } = await sb
    .from('comptes_techniciens')
    .select('id, actif, revoked_at')
    .eq('login', login)
    .maybeSingle()

  if (existing && existing.actif && !existing.revoked_at) {
    throw new Error('Un compte actif existe déjà pour cet identifiant.')
  }

  if (existing) {
    const { data, error } = await sb
      .from('comptes_techniciens')
      .update({
        password_hash: passwordHash,
        technicien_id: input.technicienId,
        actif: true,
        revoked_at: null,
        created_by: input.createdBy || null,
      })
      .eq('id', existing.id)
      .select(SELECT_COLS)
      .single()
    if (error || !data) throw new Error(error?.message || 'Réactivation impossible')
    return toRow(data as unknown as RawRow)
  }

  const { data, error } = await sb
    .from('comptes_techniciens')
    .insert({
      login,
      password_hash: passwordHash,
      technicien_id: input.technicienId,
      actif: true,
      created_by: input.createdBy || null,
    })
    .select(SELECT_COLS)
    .single()

  if (error || !data) throw new Error(error?.message || 'Création impossible')
  return toRow(data as unknown as RawRow)
}

export async function setCompteTechActif(id: string, actif: boolean): Promise<void> {
  const sb = getSupabaseOrNull()
  if (!sb) throw new Error('Supabase non configuré')

  const { data, error } = await sb
    .from('comptes_techniciens')
    .update(actif
      ? { actif: true, revoked_at: null }
      : { actif: false, revoked_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Compte introuvable')
}

export async function resetCompteTechPassword(id: string, password: string): Promise<void> {
  const pwdErr = validateTechPassword(password)
  if (pwdErr) throw new Error(pwdErr)

  const sb = getSupabaseOrNull()
  if (!sb) throw new Error('Supabase non configuré')

  const passwordHash = await bcrypt.hash(password, 10)
  const { data, error } = await sb
    .from('comptes_techniciens')
    .update({ password_hash: passwordHash })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Compte introuvable')
}

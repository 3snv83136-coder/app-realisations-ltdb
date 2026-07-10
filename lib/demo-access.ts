import bcrypt from 'bcryptjs'
import type { AuthAccount } from '@/lib/auth-users'
import { getAllAuthAccounts } from '@/lib/auth-users'
import { getSupabaseOrNull } from '@/lib/supabase'

export type DemoAccessRow = {
  id: string
  login: string
  label: string | null
  actif: boolean
  expires_at: string | null
  revoked_at: string | null
  created_by: string | null
  created_at: string
}

const LOGIN_RE = /^[a-zA-Z0-9._-]{3,32}$/

export function normalizeDemoLogin(login: string): string {
  return login.trim().toLowerCase()
}

export function isLoginReserved(login: string): boolean {
  const l = normalizeDemoLogin(login)
  return getAllAuthAccounts().some(a => a.login.toLowerCase() === l)
}

export function validateDemoLogin(login: string): string | null {
  const raw = login.trim()
  if (!raw) return 'L\'identifiant est obligatoire.'
  if (!LOGIN_RE.test(raw)) {
    return 'Identifiant : 3 à 32 caractères (lettres, chiffres, . _ -).'
  }
  if (isLoginReserved(raw)) return 'Cet identifiant est déjà utilisé par un compte permanent.'
  return null
}

export function validateDemoPassword(password: string): string | null {
  if (!password || password.length < 6) {
    return 'Le mot de passe doit contenir au moins 6 caractères.'
  }
  return null
}

/** Vérifie identifiant + mot de passe d'un accès démo actif. */
export async function verifyDemoCredentials(
  username: string,
  password: string | undefined,
): Promise<AuthAccount | null> {
  const login = normalizeDemoLogin(username)
  const pwd = password ?? ''
  if (!login || !pwd) return null

  const sb = getSupabaseOrNull()
  if (!sb) return null

  const { data, error } = await sb
    .from('demo_access')
    .select('id, login, password_hash, actif, expires_at, revoked_at')
    .eq('login', login)
    .maybeSingle()

  if (error || !data || !data.actif || data.revoked_at) return null
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null

  const valid = await bcrypt.compare(pwd, data.password_hash as string)
  if (!valid) return null

  return {
    id: `demo-${data.id}`,
    login: data.login as string,
    role: 'admin',
    passwordHash: data.password_hash as string,
    technicienId: null,
    isDemo: true,
  }
}

/** Accès démo encore valide (non révoqué, non expiré). */
export async function isDemoAccessActive(login: string): Promise<boolean> {
  const normalized = normalizeDemoLogin(login)
  if (!normalized) return false

  const sb = getSupabaseOrNull()
  if (!sb) return false

  const { data, error } = await sb
    .from('demo_access')
    .select('actif, expires_at, revoked_at')
    .eq('login', normalized)
    .maybeSingle()

  if (error || !data || !data.actif || data.revoked_at) return false
  if (data.expires_at && new Date(data.expires_at as string).getTime() <= Date.now()) return false
  return true
}

export async function listDemoAccess(includeRevoked = true): Promise<DemoAccessRow[]> {
  const sb = getSupabaseOrNull()
  if (!sb) return []

  let query = sb
    .from('demo_access')
    .select('id, login, label, actif, expires_at, revoked_at, created_by, created_at')
    .order('created_at', { ascending: false })

  if (!includeRevoked) {
    query = query.eq('actif', true).is('revoked_at', null)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as DemoAccessRow[]
}

export async function createDemoAccess(input: {
  login: string
  password: string
  label?: string
  expiresAt?: string | null
  createdBy?: string | null
}): Promise<DemoAccessRow> {
  const loginErr = validateDemoLogin(input.login)
  if (loginErr) throw new Error(loginErr)
  const pwdErr = validateDemoPassword(input.password)
  if (pwdErr) throw new Error(pwdErr)

  const sb = getSupabaseOrNull()
  if (!sb) throw new Error('Supabase non configuré')

  const login = normalizeDemoLogin(input.login)
  const passwordHash = await bcrypt.hash(input.password, 10)

  const { data: existing } = await sb
    .from('demo_access')
    .select('id, actif, revoked_at')
    .eq('login', login)
    .maybeSingle()

  if (existing && existing.actif && !existing.revoked_at) {
    throw new Error('Un accès démo actif existe déjà pour cet identifiant.')
  }

  if (existing) {
    const { data, error } = await sb
      .from('demo_access')
      .update({
        password_hash: passwordHash,
        label: input.label?.trim() || null,
        actif: true,
        expires_at: input.expiresAt || null,
        revoked_at: null,
        created_by: input.createdBy || null,
      })
      .eq('id', existing.id)
      .select('id, login, label, actif, expires_at, revoked_at, created_by, created_at')
      .single()
    if (error || !data) throw new Error(error?.message || 'Réactivation impossible')
    return data as DemoAccessRow
  }

  const { data, error } = await sb
    .from('demo_access')
    .insert({
      login,
      password_hash: passwordHash,
      label: input.label?.trim() || null,
      actif: true,
      expires_at: input.expiresAt || null,
      created_by: input.createdBy || null,
    })
    .select('id, login, label, actif, expires_at, revoked_at, created_by, created_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Création impossible')
  return data as DemoAccessRow
}

export async function revokeDemoAccess(id: string): Promise<void> {
  const sb = getSupabaseOrNull()
  if (!sb) throw new Error('Supabase non configuré')

  const { data, error } = await sb
    .from('demo_access')
    .update({
      actif: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Accès démo introuvable')
}

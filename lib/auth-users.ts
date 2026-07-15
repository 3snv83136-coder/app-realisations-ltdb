import bcrypt from "bcryptjs"

export type AuthRole = "admin" | "tech"

export type AuthAccount = {
  id: string
  login: string
  role: AuthRole
  /** Hash bcrypt — null = connexion sans mot de passe (admins) */
  passwordHash: string | null
  /** UUID technicien Supabase (comptes tech) */
  technicienId: string | null
  /** Compte démo temporaire (admin complet mais non gérant) */
  isDemo?: boolean
  /** Compte technicien stocké en base (table comptes_techniciens) — révocable à chaud */
  isDbTech?: boolean
}

function normalizeBcryptHash(raw: string): string {
  let hash = raw || ""
  if (hash && !hash.startsWith("$2")) hash = hash.replace(/_/g, "$")
  return hash
}

/** AUTH_USER_N=login ou login:hash (hash ignoré → admin sans MDP) */
function loadAdmins(): AuthAccount[] {
  const accounts: AuthAccount[] = []
  for (let i = 1; i <= 10; i++) {
    const entry = process.env[`AUTH_USER_${i}`]
    if (!entry?.trim()) continue
    const login = entry.includes(":") ? entry.split(":")[0].trim() : entry.trim()
    if (!login) continue
    accounts.push({
      id: `admin-${i}`,
      login,
      role: "admin",
      passwordHash: null,
      technicienId: null,
    })
  }
  return accounts
}

export type TechEnvEntry = {
  id: string
  login: string
  passwordHash: string
  technicienIdHint: string | null
}

/**
 * AUTH_TECH_N=login:hash_bcrypt[:technicien_id]
 * Si technicien_id absent, résolution par nom (voir resolveTechnicienId).
 */
export function loadTechFromEnv(): TechEnvEntry[] {
  const accounts: TechEnvEntry[] = []
  for (let i = 1; i <= 20; i++) {
    const entry = process.env[`AUTH_TECH_${i}`]
    if (!entry?.trim()) continue
    const colon = entry.indexOf(":")
    if (colon < 0) continue
    const login = entry.slice(0, colon).trim()
    const rest = entry.slice(colon + 1)
    const secondColon = rest.indexOf(":")
    const hashPart = secondColon >= 0 ? rest.slice(0, secondColon) : rest
    const techIdHint = secondColon >= 0 ? rest.slice(secondColon + 1).trim() : null
    const passwordHash = normalizeBcryptHash(hashPart)
    if (!login || !passwordHash) continue
    accounts.push({
      id: `tech-${i}`,
      login,
      passwordHash,
      technicienIdHint: techIdHint || null,
    })
  }
  return accounts
}

export function getAllAuthAccounts(): AuthAccount[] {
  return [
    ...loadAdmins(),
    ...loadTechFromEnv().map(t => ({
      id: t.id,
      login: t.login,
      role: "tech" as const,
      passwordHash: t.passwordHash,
      technicienId: t.technicienIdHint,
    })),
  ]
}

export async function resolveTechnicienIdForLogin(
  login: string,
  explicitId: string | undefined,
  lookupByNom: (login: string) => Promise<string | null>,
): Promise<string | null> {
  if (explicitId?.trim()) return explicitId.trim()
  return lookupByNom(login)
}

export async function verifyCredentials(
  username: string,
  password: string | undefined,
  lookupTechnicienId: (login: string) => Promise<string | null>,
): Promise<AuthAccount | null> {
  const login = username.trim()
  if (!login) return null

  const admins = loadAdmins()
  const admin = admins.find(a => a.login.toLowerCase() === login.toLowerCase())
  if (admin) {
    return admin
  }

  const techDef = loadTechFromEnv().find(t => t.login.toLowerCase() === login.toLowerCase())
  if (!techDef) {
    // Comptes techniciens en base (créés depuis /admin/comptes)
    const { verifyCompteTechCredentials } = await import('@/lib/comptes-tech')
    const dbTech = await verifyCompteTechCredentials(login, password)
    if (dbTech) return dbTech

    const { verifyDemoCredentials } = await import('@/lib/demo-access')
    const demo = await verifyDemoCredentials(login, password)
    if (demo) return demo
    return null
  }

  const pwd = password ?? ""
  if (!pwd) return null
  const valid = await bcrypt.compare(pwd, techDef.passwordHash)
  if (!valid) return null

  const technicienId = await resolveTechnicienIdForLogin(
    login,
    techDef.technicienIdHint ?? undefined,
    lookupTechnicienId,
  )
  if (!technicienId) return null

  return {
    id: techDef.id,
    login: techDef.login,
    role: "tech",
    passwordHash: techDef.passwordHash,
    technicienId,
  }
}

/** Compte tech si le login correspond à un AUTH_TECH_* (affiche champ mot de passe). */
export function isTechLogin(login: string): boolean {
  const l = login.trim().toLowerCase()
  return loadTechFromEnv().some(t => t.login.toLowerCase() === l)
}

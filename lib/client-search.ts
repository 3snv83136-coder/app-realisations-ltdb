export type ClientSearchFilters = {
  nom?: string
  telephone?: string
  email?: string
  ville?: string
}

export type ClientLike = {
  id: string | null
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

export function hasClientSearchFilters(f: ClientSearchFilters): boolean {
  return !!(f.nom?.trim() || f.telephone?.trim() || f.email?.trim() || f.ville?.trim())
}

export function normalizePhoneDigits(s: string): string {
  return s.replace(/\D/g, '')
}

export function phonesMatch(query: string, stored: string | null | undefined): boolean {
  if (!query?.trim() || !stored?.trim()) return false
  const q = normalizePhoneDigits(query)
  const s = normalizePhoneDigits(stored)
  if (q.length < 6 || s.length < 6) return false
  if (s === q) return true
  const sufLen = Math.min(q.length, 9)
  const querySuf = q.slice(-sufLen)
  if (s.endsWith(querySuf) && sufLen >= 6) return true
  if (q.endsWith(s.slice(-Math.min(s.length, 9))) && s.length >= 6) return true
  return false
}

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!needle.trim()) return true
  if (!hay?.trim()) return false
  return hay.toLowerCase().includes(needle.trim().toLowerCase())
}

/** Vérifie qu'un client correspond à tous les critères renseignés. */
export function clientMatchesFilters(client: ClientLike, filters: ClientSearchFilters): boolean {
  if (filters.nom?.trim() && !includesFold(client.nom, filters.nom)) return false
  if (filters.email?.trim() && !includesFold(client.email, filters.email)) return false
  if (filters.ville?.trim() && !includesFold(client.ville, filters.ville)) return false
  if (filters.telephone?.trim() && !phonesMatch(filters.telephone, client.telephone)) return false
  return true
}

export function clientKey(c: { id: string | null; nom: string; email: string | null }): string {
  if (c.id) return `id:${c.id}`
  return `noid:${(c.nom || '').toLowerCase().trim()}|${(c.email || '').toLowerCase().trim()}`
}

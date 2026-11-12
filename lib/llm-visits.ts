export type LlmVisit = {
  seen_at: string
  kind: 'robot' | 'clic'
  moteur: string
  agent: string
  path: string
  status: number
  origine: string | null
  requete: string | null
}

export type LlmMoteur = {
  moteur: string
  visites: number
  avec_requete: number
}

export type LlmVisitesReport = {
  generated_at: string
  journal_du: string | null
  journal_au: string | null
  visites: number
  robots: number
  clics: number
  avec_requete: number
  moteurs: LlmMoteur[]
  rows: LlmVisit[]
  rows_total: number
  note: string
}

export type LlmVisitesQuery = {
  debut?: string
  fin?: string
  moteur?: string
  kind?: string
  q?: string
  format?: 'csv'
}

function siteUrl(query: LlmVisitesQuery = {}): { url: string; token: string } {
  const base = process.env.LTDB_API_URL?.replace(/\/$/, '')
  const token = process.env.LTDB_PUBLISH_TOKEN
  if (!base || !token) {
    throw new Error('Connexion au site public absente')
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const search = params.toString()
  return { url: `${base}/api/core/llm-visits/${search ? `?${search}` : ''}`, token }
}

/** Lit le journal du site public. La requête n'est remplie que si l'assistant l'a transmise. */
export async function fetchLlmVisites(query: LlmVisitesQuery = {}): Promise<LlmVisitesReport> {
  const { url, token } = siteUrl(query)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
  }
  return data as LlmVisitesReport
}

export async function fetchLlmVisitesCsv(query: LlmVisitesQuery = {}): Promise<{ body: ArrayBuffer; filename: string }> {
  const { url, token } = siteUrl({ ...query, format: 'csv' })
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
  }
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  return { body: await res.arrayBuffer(), filename: match?.[1] || 'visites-ia.csv' }
}

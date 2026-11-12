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

/** Lit le journal du site public. La requête n'est remplie que si l'assistant l'a transmise. */
export async function fetchLlmVisites(): Promise<LlmVisitesReport> {
  const base = process.env.LTDB_API_URL?.replace(/\/$/, '')
  const token = process.env.LTDB_PUBLISH_TOKEN
  if (!base || !token) {
    throw new Error('Connexion au site public absente')
  }
  const res = await fetch(`${base}/api/core/llm-visits/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
  }
  return data as LlmVisitesReport
}

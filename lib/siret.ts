/**
 * Helpers SIRET : nettoyage, validation, lookup API publique.
 * L'appel à recherche-entreprises.api.gouv.fr est fait côté serveur
 * via /api/siret/[siret] (proxy, pas de CORS).
 */

import https from "node:https"

const API_BASE = "https://recherche-entreprises.api.gouv.fr/search"
const UA = "LTDB-App/1.0 (lestechniciensdudebouchage@gmail.com)"

/** Retire tous les espaces / séparateurs d'un SIRET saisi. */
export function cleanSiret(input: string): string {
  return (input || '').replace(/[\s.-]/g, '')
}

/** Vrai si la chaîne est exactement 14 chiffres (pas de checksum Luhn). */
export function isSiretShape(input: string): boolean {
  const c = cleanSiret(input)
  return /^\d{14}$/.test(c)
}

export interface SiretLookupResult {
  siret: string
  siren: string
  nom: string
  adresse: string
  code_postal: string
  ville: string
  activite: string | null
  forme_juridique: string | null
  etat: 'A' | 'F' | string
}

function buildSearchUrl(query: string): string {
  const q = encodeURIComponent(query)
  return `${API_BASE}?q=${q}&page=1&per_page=1&minimal=false`
}

/** Repli HTTPS natif Node (contourne certains échecs undici/IPv6 sur Vercel). */
function fetchJsonHttps(url: string, timeoutMs = 12_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: { accept: "application/json", "user-agent": UA },
        timeout: timeoutMs,
      },
      (res) => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`))
          res.resume()
          return
        }
        const chunks: Buffer[] = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
          } catch (e) {
            reject(e)
          }
        })
      },
    )
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")) })
    req.on("error", reject)
  })
}

async function fetchJson(url: string): Promise<unknown> {
  const headers = { accept: "application/json", "user-agent": UA }
  let lastErr: unknown

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 12_000)
      const res = await fetch(url, { headers, cache: "no-store", signal: ctrl.signal })
      clearTimeout(timer)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      lastErr = e
      if (attempt === 0) await new Promise((r) => setTimeout(r, 350))
    }
  }

  try {
    return await fetchJsonHttps(url)
  } catch {
    throw lastErr ?? new Error("fetch failed")
  }
}

function parseApiResponse(data: unknown, siret: string): SiretLookupResult | null {
  const first = (data as { results?: unknown[] })?.results?.[0] as Record<string, unknown> | undefined
  if (!first) return null

  const matching = Array.isArray(first.matching_etablissements) && first.matching_etablissements.length > 0
    ? (first.matching_etablissements as Record<string, unknown>[]).find(
        (e) => cleanSiret(String(e?.siret || '')) === siret,
      ) || (first.matching_etablissements as Record<string, unknown>[])[0]
    : null

  const etab = (matching || first.siege || {}) as Record<string, unknown>

  return {
    siret: cleanSiret(String(etab.siret || siret)),
    siren: String(first.siren || siret.slice(0, 9)),
    nom: String(first.nom_complet || first.nom_raison_sociale || etab.nom_commercial || ''),
    adresse: String(etab.adresse || ''),
    code_postal: String(etab.code_postal || ''),
    ville: String(etab.libelle_commune || etab.commune || ''),
    activite: (first.activite_principale || etab.activite_principale || null) as string | null,
    forme_juridique: (first.nature_juridique || null) as string | null,
    etat: String(etab.etat_administratif || first.etat_administratif || 'A'),
  }
}

/**
 * Recherche une entreprise par SIRET via l'API publique gouv.
 * Repli par SIREN si la recherche directe ne renvoie rien.
 */
export async function lookupSiret(raw: string): Promise<SiretLookupResult | null> {
  const siret = cleanSiret(raw)
  if (!isSiretShape(siret)) return null

  const queries = [siret, siret.slice(0, 9)]
  let lastErr: unknown

  for (const q of queries) {
    try {
      const data = await fetchJson(buildSearchUrl(q))
      const parsed = parseApiResponse(data, siret)
      if (parsed?.nom) return parsed
    } catch (e) {
      lastErr = e
    }
  }

  throw lastErr ?? new Error("fetch failed")
}

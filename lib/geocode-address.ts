/**
 * Géocodage adresse FR via Nominatim (OpenStreetMap).
 * Cache module-level partagé entre InterventionMap et PlanningMap.
 */

export type LatLng = [number, number]

const TOULON_CENTER: LatLng = [43.1242, 5.928]
const geocodeCache = new Map<string, LatLng | null>()

export function buildAddressQuery(
  adresse?: string | null,
  codePostal?: string | null,
  ville?: string | null,
): string {
  const parts: string[] = []
  const cpVille = [codePostal, ville].filter(v => v && String(v).trim()).join(' ').trim()
  if (adresse && adresse.trim()) parts.push(adresse.trim())
  if (cpVille) parts.push(cpVille)
  parts.push('France')
  return parts.join(', ')
}

export function hasUsableAddress(
  adresse?: string | null,
  ville?: string | null,
  codePostal?: string | null,
): boolean {
  return Boolean(
    (adresse && adresse.trim())
    || (ville && ville.trim())
    || (codePostal && codePostal.trim()),
  )
}

export async function geocodeAddress(query: string): Promise<LatLng | null> {
  if (!query.trim()) return null
  if (geocodeCache.has(query)) return geocodeCache.get(query) ?? null

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    query,
  )}&limit=1&countrycodes=fr`

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'fr',
      },
    })
    if (!res.ok) {
      geocodeCache.set(query, null)
      return null
    }
    const data: unknown = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      geocodeCache.set(query, null)
      return null
    }
    const first = data[0] as { lat?: string; lon?: string }
    if (!first.lat || !first.lon) {
      geocodeCache.set(query, null)
      return null
    }
    const lat = parseFloat(first.lat)
    const lon = parseFloat(first.lon)
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      geocodeCache.set(query, null)
      return null
    }
    const coords: LatLng = [lat, lon]
    geocodeCache.set(query, coords)
    return coords
  } catch {
    geocodeCache.set(query, null)
    return null
  }
}

export { TOULON_CENTER }

/** Pause entre appels Nominatim (~1 req/s recommandé). */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Récupère une image carte (data URL) pour la page de garde du rapport ITV.
 * Appelle /api/static-map (géocodage + tuile OSM côté serveur).
 */
'use client'

export type InspectionMapClient = {
  adresse?: string
  codePostal?: string
  ville?: string
}

function buildAddressQuery(c: InspectionMapClient): string {
  const parts = [
    (c.adresse || '').trim(),
    [c.codePostal, c.ville].filter(Boolean).join(' ').trim(),
    'France',
  ].filter(Boolean)
  return parts.join(', ')
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  const mime = blob.type || 'image/png'
  return `data:${mime};base64,${btoa(binary)}`
}

/** Retourne une data URL PNG/JPEG, ou null si échec. */
export async function fetchInspectionMapDataUrl(
  client: InspectionMapClient,
): Promise<string | null> {
  const q = buildAddressQuery(client)
  if (!q || q === 'France') return null
  try {
    const res = await fetch(`/api/static-map?q=${encodeURIComponent(q)}&w=800&h=420&z=16`)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.size || blob.type.includes('json')) return null
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

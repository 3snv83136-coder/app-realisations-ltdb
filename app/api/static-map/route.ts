import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const maxDuration = 20

type LatLng = { lat: number; lon: number }

async function geocode(query: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=fr`
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'fr',
      'User-Agent': 'LTDB-App/1.0 (contact@lestechniciensdudebouchage.fr)',
    },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  const data: unknown = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null
  const first = data[0] as { lat?: string; lon?: string }
  const lat = parseFloat(first.lat || '')
  const lon = parseFloat(first.lon || '')
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  return { lat, lon }
}

/** Image carte statique pour page de garde PDF ITV (via OSM). */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = (searchParams.get('q') || '').trim()
  let lat = parseFloat(searchParams.get('lat') || '')
  let lon = parseFloat(searchParams.get('lon') || '')

  if ((Number.isNaN(lat) || Number.isNaN(lon)) && q) {
    const coords = await geocode(q)
    if (!coords) {
      return NextResponse.json({ error: 'Adresse introuvable' }, { status: 404 })
    }
    lat = coords.lat
    lon = coords.lon
  }

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ error: 'Coordonnées ou adresse requises' }, { status: 400 })
  }

  const width = Math.min(Math.max(parseInt(searchParams.get('w') || '800', 10) || 800, 200), 1200)
  const height = Math.min(Math.max(parseInt(searchParams.get('h') || '420', 10) || 420, 150), 800)
  const zoom = Math.min(Math.max(parseInt(searchParams.get('z') || '16', 10) || 16, 10), 18)

  const mapUrl =
    `https://staticmap.openstreetmap.de/staticmap.php` +
    `?center=${lat},${lon}&zoom=${zoom}&size=${width}x${height}` +
    `&maptype=mapnik&markers=${lat},${lon},red-pushpin`

  try {
    const imgRes = await fetch(mapUrl, {
      headers: { 'User-Agent': 'LTDB-App/1.0 (contact@lestechniciensdudebouchage.fr)' },
      next: { revalidate: 86400 },
    })
    if (!imgRes.ok) {
      return NextResponse.json({ error: `Carte indisponible (${imgRes.status})` }, { status: 502 })
    }
    const bytes = await imgRes.arrayBuffer()
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': imgRes.headers.get('Content-Type') || 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (e) {
    console.error('[static-map]', e)
    return NextResponse.json({ error: 'Échec récupération carte' }, { status: 502 })
  }
}

import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Proxy d'images pour contourner les blocages CORS de @react-pdf/renderer.
 *
 * @react-pdf charge les images via fetch côté browser ; les serveurs qui
 * ne renvoient pas `Access-Control-Allow-Origin` font silencieusement échouer
 * le chargement (canvas/CORS). Ce proxy fetch l'image côté serveur (où il n'y
 * a pas de CORS) puis la stream au browser avec les bons headers.
 *
 * GET /api/proxy-image?url=<encoded>
 */
const ALLOWED_HOSTS = [
  'lestechniciensdudebouchage.fr',
  'www.lestechniciensdudebouchage.fr',
]

/** Hostname du projet Supabase de l'app — pas n'importe quel *.supabase.co. */
function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function isAllowed(url: URL): boolean {
  if (ALLOWED_HOSTS.includes(url.hostname)) return true
  const sb = supabaseHostname()
  return sb !== null && url.hostname === sb
}

export async function GET(req: NextRequest) {
  const reqUrl = new URL(req.url)
  const target = reqUrl.searchParams.get('url')
  if (!target) {
    return NextResponse.json({ error: 'url manquante' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return NextResponse.json({ error: 'url invalide' }, { status: 400 })
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return NextResponse.json({ error: 'protocole non autorisé' }, { status: 400 })
  }
  if (!isAllowed(parsed)) {
    return NextResponse.json({ error: 'hôte non autorisé' }, { status: 403 })
  }

  try {
    const upstream = await fetch(parsed.toString(), { cache: 'no-store' })
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 })
    }
    const buf = await upstream.arrayBuffer()
    const contentType = upstream.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}

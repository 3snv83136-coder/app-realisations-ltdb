import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getCalendarToken } from "@/lib/calendar-token"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Renvoie l'URL d'abonnement iCalendar pour Google Agenda / Apple Calendar / Outlook.
 * Réservé aux utilisateurs authentifiés.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const token = getCalendarToken()
  if (!token) {
    return NextResponse.json({
      configured: false,
      error: 'NEXTAUTH_SECRET (ou LTDB_CALENDAR_TOKEN) non configuré côté serveur.',
    })
  }

  const url = new URL(req.url)
  const origin = url.origin
  const icsUrl = `${origin}/api/calendar.ics?token=${encodeURIComponent(token)}`

  // Google Calendar : préfixe webcal:// pour ouvrir directement le flux
  // https://calendar.google.com/calendar/u/0/r?cid=<webcal-url-encoded>
  const webcalUrl = icsUrl.replace(/^https?:\/\//, 'webcal://')
  const gcalDeeplink = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(webcalUrl)}`

  return NextResponse.json({
    configured: true,
    icsUrl,
    webcalUrl,
    gcalDeeplink,
  })
}

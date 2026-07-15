import { NextRequest, NextResponse } from "next/server"
import { EMAIL_RE } from "@/lib/email-utils"
import { notifyTechnicienIntervention, type NotifyTechnicienInput } from "@/lib/notify-technicien"

export const maxDuration = 30

export async function POST(req: NextRequest) {
  let body: NotifyTechnicienInput
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body.intervention_id) {
    return NextResponse.json({ error: 'intervention_id requis' }, { status: 400 })
  }

  const techEmail = (body.technicien_email || '').trim()
  const techPhone = (body.technicien_telephone || '').trim()
  if ((!techEmail || !EMAIL_RE.test(techEmail)) && !techPhone) {
    return NextResponse.json({ error: 'Email ou téléphone technicien requis' }, { status: 400 })
  }

  const baseUrl = req.nextUrl?.origin
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXTAUTH_URL
    || 'https://app-realisations.vercel.app'

  const result = await notifyTechnicienIntervention(body, baseUrl)

  if (!result.ok) {
    return NextResponse.json({
      error: result.error || result.skipped || 'Notification non envoyée',
      ...result,
    }, { status: result.skipped ? 400 : 500 })
  }

  return NextResponse.json(result)
}

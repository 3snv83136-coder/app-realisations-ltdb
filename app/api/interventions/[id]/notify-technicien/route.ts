import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import {
  formatNotifyTechnicienFeedback,
  notifyTechnicienForIntervention,
  resolveNotifyBaseUrl,
} from "@/lib/notify-technicien"
import { requireAdminApi } from "@/lib/rh/require-admin"
import { getSupabaseOrNull } from "@/lib/supabase"

export const maxDuration = 30

type Params = { params: { id: string } }

/**
 * Notifie le technicien assigné (admin).
 * Body optionnel : { sendMail?: boolean, sendSms?: boolean }
 * Défaut manuel : mail + SMS (renvoi explicite depuis la fiche).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireAdminApi()
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status })
  }

  const access = await requireInterventionAccess(req, params.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })
  }

  let body: { sendMail?: boolean; sendSms?: boolean } = {}
  try {
    const raw = await req.json()
    if (raw && typeof raw === 'object') body = raw as typeof body
  } catch {
    /* body vide = defaults */
  }

  const { data: interv } = await sb
    .from('interventions')
    .select('id, technicien_id, statut')
    .eq('id', params.id)
    .maybeSingle()

  if (!interv) {
    return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })
  }
  if (!interv.technicien_id) {
    return NextResponse.json({ error: 'Aucun technicien assigné' }, { status: 400 })
  }
  if (interv.statut === 'annulee') {
    return NextResponse.json({ error: 'Intervention annulée' }, { status: 400 })
  }

  // Renvoi manuel : mail + SMS par défaut (choix explicite côté UI).
  const sendMail = body.sendMail !== false
  const sendSms = body.sendSms !== false

  try {
    const notification = await notifyTechnicienForIntervention(
      params.id,
      interv.technicien_id,
      resolveNotifyBaseUrl(req.nextUrl.origin),
      { sendMail, sendSms },
    )
    if (!notification.ok) {
      return NextResponse.json({
        error: formatNotifyTechnicienFeedback(notification),
        notification,
      }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      message: formatNotifyTechnicienFeedback(notification),
      notification,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[interventions/notify-technicien]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

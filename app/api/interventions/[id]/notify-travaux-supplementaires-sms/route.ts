import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertInterventionAccess } from '@/lib/intervention-access'
import { getSupabaseOrNull } from '@/lib/supabase'
import { getTelPrincipal } from '@/lib/parametres'
import { fmtEUR } from '@/lib/format'
import { getTravauxSupplementaires } from '@/lib/travaux-supplementaires'

export const dynamic = 'force-dynamic'

type Params = { params: { id: string } }

/** Prépare le texte SMS pour l'accord travaux supplémentaires (ouverture messagerie native). */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const user = await getSessionUser()
  const access = await assertInterventionAccess(params.id, user)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let body: { recordId?: string; clientPhone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const { data: interv, error } = await sb
    .from('interventions')
    .select('rapport_json, reference, ville')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const travaux = getTravauxSupplementaires(interv.rapport_json)
  const record = travaux.find(t => t.id === body.recordId) || travaux[travaux.length - 1]
  if (!record) return NextResponse.json({ error: 'Aucun travaux supplémentaires enregistré' }, { status: 404 })

  const tel = await getTelPrincipal()
  const prestations = record.lignes.map(l => l.label).join(', ')
  const manuelle = record.prestation_manuelle ? ` (${record.prestation_manuelle})` : ''
  const ref = interv.reference ? ` Réf. ${interv.reference}.` : ''
  const ville = interv.ville ? ` ${interv.ville}.` : ''

  const bodyText = [
    `Bonjour ${record.client_nom},`,
    `Accord travaux supplémentaires LTDB : ${prestations}${manuelle}.`,
    `Total TTC : ${fmtEUR(record.total_ttc)}.${ref}${ville}`,
    `Un exemplaire vous a été remis sur place. Questions : ${tel}.`,
    'Les Techniciens du Débouchage',
  ].join(' ')

  const now = new Date().toISOString()
  const phone = (body.clientPhone || record.client_telephone || '').trim()
  const updatedTravaux = travaux.map(t =>
    t.id === record.id ? { ...t, sms_envoye_at: now, client_telephone: phone || t.client_telephone } : t,
  )
  const rapportJson = {
    ...(interv.rapport_json && typeof interv.rapport_json === 'object' ? interv.rapport_json : {}),
    travaux_supplementaires: updatedTravaux,
  }
  await sb.from('interventions').update({ rapport_json: rapportJson }).eq('id', params.id)

  return NextResponse.json({ ok: true, body: bodyText })
}

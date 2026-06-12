import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, assertInterventionAccess } from '@/lib/intervention-access'
import { getSupabaseOrNull } from '@/lib/supabase'
import {
  calculTotauxTravauxSupp,
  getTravauxSupplementaires,
  type LigneTravauxSupp,
  type TravauxSupplementairesRecord,
} from '@/lib/travaux-supplementaires'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PHOTOS_BUCKET = process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'
const SIGNATURES_BUCKET = process.env.SUPABASE_ACCORDS_BUCKET || 'accords-pdf'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const user = await getSessionUser()
  const access = await assertInterventionAccess(params.id, user)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await sb
    .from('interventions')
    .select('rapport_json')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  return NextResponse.json({ travaux: getTravauxSupplementaires(data.rapport_json) })
}

/**
 * Enregistre un bloc « travaux supplémentaires avec accord » (signature + prestations + photo).
 * Stocké dans rapport_json.travaux_supplementaires[].
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  const interventionId = params.id
  const user = await getSessionUser()
  const access = await assertInterventionAccess(interventionId, user)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let body: {
    client_nom?: string
    client_email?: string
    client_telephone?: string
    lignes?: LigneTravauxSupp[]
    prestation_manuelle?: string
    signature?: string
    photo_base64?: string
    photo_url?: string
    taux_tva?: number
    valide_at?: string
    demande_expresse?: boolean
    renonciation_retractation?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const clientNom = (body.client_nom || '').trim()
  if (!clientNom) {
    return NextResponse.json({ error: 'Le nom du client est obligatoire' }, { status: 400 })
  }

  const lignes = Array.isArray(body.lignes)
    ? body.lignes
        .map(l => ({
          label: String(l.label || '').trim(),
          prix_ht: Number(l.prix_ht) || 0,
          quantite: Number(l.quantite) || 1,
          unite: String(l.unite || 'forfait'),
          prestation_id: l.prestation_id || null,
        }))
        .filter(l => l.label)
    : []

  const manuelle = (body.prestation_manuelle || '').trim()
  if (lignes.length === 0 && !manuelle) {
    return NextResponse.json({ error: 'Sélectionnez au moins une prestation ou saisissez une option manuelle.' }, { status: 400 })
  }

  const signature = (body.signature || '').trim()
  const sigMatch = /^data:image\/(png|jpeg);base64,(.+)$/.exec(signature)
  if (!sigMatch) {
    return NextResponse.json({ error: 'Signature client requise' }, { status: 400 })
  }
  if (body.demande_expresse !== true || body.renonciation_retractation !== true) {
    return NextResponse.json(
      { error: 'Les consentements (demande expresse, renonciation) sont requis.' },
      { status: 400 },
    )
  }

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, rapport_json, terrain_step')
    .eq('id', interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)
  const recordId = `ts-${Date.now()}`

  // Upload signature
  const sigBuf = Buffer.from(sigMatch[2], 'base64')
  if (sigBuf.length < 200) return NextResponse.json({ error: 'Signature vide' }, { status: 400 })
  const sigExt = sigMatch[1] === 'jpeg' ? 'jpg' : 'png'
  const sigPath = `${folder}/${recordId}-signature.${sigExt}`
  const sigUp = await sb.storage
    .from(SIGNATURES_BUCKET)
    .upload(sigPath, sigBuf, { contentType: `image/${sigMatch[1]}`, upsert: true })
  if (sigUp.error) {
    return NextResponse.json({ error: `Upload signature : ${sigUp.error.message}` }, { status: 502 })
  }
  const { data: sigPub } = sb.storage.from(SIGNATURES_BUCKET).getPublicUrl(sigPath)
  const signatureUrl = sigPub?.publicUrl || null

  // Photo optionnelle (URL déjà uploadée ou data URL)
  let photoUrl: string | null = (body.photo_url || '').trim() || null
  const photoB64 = (body.photo_base64 || '').trim()
  const photoMatch = /^data:image\/(png|jpeg|base64,jpeg);base64,(.+)$/.exec(photoB64)
    || /^data:image\/(png|jpeg);base64,(.+)$/.exec(photoB64)
  if (!photoUrl && photoMatch) {
    const photoBuf = Buffer.from(photoMatch[2] || photoMatch[1], 'base64')
    const photoExt = (photoMatch[1] || 'jpeg').includes('png') ? 'png' : 'jpg'
    const photoPath = `${folder}/${recordId}-photo.${photoExt}`
    const photoUp = await sb.storage
      .from(PHOTOS_BUCKET)
      .upload(photoPath, photoBuf, { contentType: `image/${photoExt === 'png' ? 'png' : 'jpeg'}`, upsert: true })
    if (!photoUp.error) {
      const { data: photoPub } = sb.storage.from(PHOTOS_BUCKET).getPublicUrl(photoPath)
      photoUrl = photoPub?.publicUrl || null
    }
  }

  const tauxTva = Number(body.taux_tva)
  const taux_tva = tauxTva === 0 || tauxTva === 20 ? tauxTva : 10
  const { total_ht, total_ttc } = calculTotauxTravauxSupp(lignes, taux_tva)
  const signedAt = body.valide_at && !Number.isNaN(Date.parse(body.valide_at))
    ? new Date(body.valide_at).toISOString()
    : new Date().toISOString()

  const record: TravauxSupplementairesRecord = {
    id: recordId,
    created_at: new Date().toISOString(),
    signed_at: signedAt,
    client_nom: clientNom,
    client_email: (body.client_email || '').trim() || null,
    client_telephone: (body.client_telephone || '').trim() || null,
    lignes,
    prestation_manuelle: manuelle || null,
    photo_url: photoUrl,
    signature_url: signatureUrl,
    total_ht,
    taux_tva,
    total_ttc,
  }

  const existing = getTravauxSupplementaires(interv.rapport_json)
  const rapportJson = {
    ...(interv.rapport_json && typeof interv.rapport_json === 'object' ? interv.rapport_json : {}),
    travaux_supplementaires: [...existing, record],
  }

  const currentStep = interv.terrain_step ?? 0
  const nextStep = currentStep < 3 ? 3 : currentStep

  const { data: updated, error: upErr } = await sb
    .from('interventions')
    .update({ rapport_json: rapportJson, terrain_step: nextStep })
    .eq('id', interventionId)
    .select('*')
    .single()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, record, intervention: updated })
}

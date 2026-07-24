import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { technicienFilterForSession } from "@/lib/intervention-access"
import {
  notifyTechnicienForIntervention,
  resolveNotifyBaseUrl,
  type NotifyTechnicienResult,
} from "@/lib/notify-technicien"
import { getSupabaseOrNull, upsertClient, patchClient } from "@/lib/supabase"
import { isCanalAcquisition } from "@/lib/canaux"
import { validateCreneau } from "@/lib/creneau"
import { normalizeModePaiementInput } from "@/lib/mode-paiement"
import { permissionsForSession } from "@/lib/tech-permissions"
import type { PostgrestError } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type ClientInput = {
  id?: string | null
  nom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
}

type CreateInterventionBody = {
  client?: ClientInput
  technicien_id?: string | null
  agence?: string | null
  type_intervention?: string | null
  adresse_chantier?: string | null
  ville?: string | null
  code_postal?: string | null
  date_prevue?: string | null
  heure_prevue?: string | null
  heure_fin_prevue?: string | null
  duree_estimee_min?: number | null
  urgence?: boolean
  prix_prevu?: number | null
  notes_internes?: string | null
  canal_acquisition?: string | null
  mode_paiement?: string | null
}

function buildReference(date_prevue?: string | null, heure_prevue?: string | null): string {
  const now = new Date()
  let datePart: string
  let timePart: string

  if (date_prevue && /^\d{4}-\d{2}-\d{2}$/.test(date_prevue)) {
    datePart = date_prevue.replace(/-/g, '')
  } else {
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    datePart = `${yyyy}${mm}${dd}`
  }

  if (heure_prevue && /^\d{2}:\d{2}/.test(heure_prevue)) {
    timePart = heure_prevue.slice(0, 5).replace(':', '')
  } else {
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    timePart = `${hh}${mi}`
  }

  return `LTDB-${datePart}-${timePart}`
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
      interventions: [],
    }, { status: 500 })
  }

  const url = new URL(req.url)
  const statut = url.searchParams.get('statut')
  const technicien_id = url.searchParams.get('technicien_id')
  const session = await auth()
  const sessionUser = session?.user
    ? {
        role: session.user.role,
        technicienId: session.user.technicienId ?? null,
        login: session.user.name ?? null,
      }
    : null
  const sessionTechId = technicienFilterForSession(sessionUser)
  const agence = url.searchParams.get('agence')
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500)

  let query = sb
    .from('interventions')
    .select('id, reference, client_id, technicien_id, agence, type_intervention, adresse_chantier, ville, code_postal, date_prevue, heure_prevue, heure_fin_prevue, duree_estimee_min, date_realisee, urgence, statut, prix_prevu, notes_internes, publie_slug, canal_acquisition, terrain_step, created_at, updated_at')
    .order('date_prevue', { ascending: true, nullsFirst: false })
    .order('heure_prevue', { ascending: true, nullsFirst: false })
    // range() au lieu de limit() : limit + order drop la ligne la plus
    // récente sur supabase-js (bug documenté, cf. /api/historique).
    .range(0, limit - 1)

  if (statut) query = query.eq('statut', statut)
  if (sessionTechId) query = query.eq('technicien_id', sessionTechId)
  else if (technicien_id) query = query.eq('technicien_id', technicien_id)
  if (agence) query = query.eq('agence', agence)
  if (from) query = query.gte('date_prevue', from)
  if (to) query = query.lte('date_prevue', to)

  let { data: interventions, error } = await query
  if (error?.message?.includes('heure_fin_prevue')) {
    const fallback = sb
      .from('interventions')
      .select('id, reference, client_id, technicien_id, agence, type_intervention, adresse_chantier, ville, code_postal, date_prevue, heure_prevue, duree_estimee_min, date_realisee, urgence, statut, prix_prevu, notes_internes, publie_slug, canal_acquisition, terrain_step, created_at, updated_at')
      .order('date_prevue', { ascending: true, nullsFirst: false })
      .order('heure_prevue', { ascending: true, nullsFirst: false })
      .range(0, limit - 1)
    let fb = fallback
    if (statut) fb = fb.eq('statut', statut)
    if (sessionTechId) fb = fb.eq('technicien_id', sessionTechId)
    else if (technicien_id) fb = fb.eq('technicien_id', technicien_id)
    if (agence) fb = fb.eq('agence', agence)
    if (from) fb = fb.gte('date_prevue', from)
    if (to) fb = fb.lte('date_prevue', to)
    const retry = await fb
    interventions = (retry.data || []).map(i => ({ ...i, heure_fin_prevue: null }))
    error = retry.error
  }
  if (error) {
    return NextResponse.json({ error: error.message, interventions: [] }, { status: 500 })
  }

  const clientIds = new Set<string>()
  const techIds = new Set<string>()
  ;(interventions || []).forEach(i => {
    if (i.client_id) clientIds.add(i.client_id)
    if (i.technicien_id) techIds.add(i.technicien_id)
  })

  const [clientsRes, techsRes] = await Promise.all([
    clientIds.size > 0
      ? sb.from('clients').select('id, nom, email, telephone').in('id', Array.from(clientIds))
      : Promise.resolve({ data: [], error: null } as const),
    techIds.size > 0
      ? sb.from('techniciens').select('id, nom, email').in('id', Array.from(techIds))
      : Promise.resolve({ data: [], error: null } as const),
  ])

  const clientsMap: Record<string, { nom: string; email: string | null; telephone: string | null }> = {}
  ;(clientsRes.data || []).forEach((c: { id: string; nom: string; email: string | null; telephone: string | null }) => {
    clientsMap[c.id] = { nom: c.nom, email: c.email, telephone: c.telephone }
  })
  const techsMap: Record<string, { nom: string; email: string | null }> = {}
  ;(techsRes.data || []).forEach((t: { id: string; nom: string; email: string | null }) => {
    techsMap[t.id] = { nom: t.nom, email: t.email }
  })

  const perms = await permissionsForSession(sessionUser)

  const decorated = (interventions || []).map(i => ({
    ...i,
    prix_prevu: perms.voir_prix ? i.prix_prevu : null,
    client_nom: i.client_id ? clientsMap[i.client_id]?.nom ?? null : null,
    client_email: i.client_id ? clientsMap[i.client_id]?.email ?? null : null,
    client_telephone: i.client_id ? clientsMap[i.client_id]?.telephone ?? null : null,
    technicien_nom: i.technicien_id ? techsMap[i.technicien_id]?.nom ?? null : null,
    technicien_email: i.technicien_id ? techsMap[i.technicien_id]?.email ?? null : null,
  }))

  return NextResponse.json({ interventions: decorated })
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({
      error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants)',
    }, { status: 500 })
  }

  let body: CreateInterventionBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  if (!body.type_intervention) {
    return NextResponse.json({ error: 'type_intervention requis' }, { status: 400 })
  }

  // 1. Resolve client — IMPÉRATIF : pas de création d'intervention sans client.
  // Sans ce verrou, une UI buggée (cache PWA stale, validation contournée) crée
  // des interventions orphelines qui s'affichent "Client inconnu · —" et bloquent
  // le wizard d'envoi.
  let clientId: string | null = null
  if (body.client?.id) {
    clientId = body.client.id
    // Si l'UI a déjà résolu le client (autocomplete) ET que l'utilisateur a
    // saisi/modifié des champs dans la modale, on les applique sur la fiche
    // existante (merge non destructif via patchClient).
    await patchClient(clientId, {
      nom: body.client.nom ?? null,
      email: body.client.email ?? null,
      telephone: body.client.telephone ?? null,
      adresse: body.client.adresse ?? null,
      code_postal: body.client.code_postal ?? null,
      ville: body.client.ville ?? null,
    })
  } else if (body.client?.nom && body.client.nom.trim()) {
    clientId = await upsertClient({
      nom: body.client.nom,
      email: body.client.email ?? null,
      telephone: body.client.telephone ?? null,
      adresse: body.client.adresse ?? null,
      code_postal: body.client.code_postal ?? null,
      ville: body.client.ville ?? null,
    })
    if (!clientId) {
      return NextResponse.json({ error: 'Création du client impossible' }, { status: 500 })
    }
  } else {
    return NextResponse.json(
      { error: 'Nom du client requis (envoyez body.client.nom ou body.client.id).' },
      { status: 400 },
    )
  }

  // 2. Reference (avec retry sur collision unique)
  const baseReference = buildReference(body.date_prevue, body.heure_prevue)

  // 3. Default chantier address from client if not provided
  const adresseChantier = body.adresse_chantier ?? body.client?.adresse ?? null
  const ville = body.ville ?? body.client?.ville ?? null
  const codePostal = body.code_postal ?? body.client?.code_postal ?? null

  const heurePrevueClean = body.heure_prevue && /^\d{2}:\d{2}/.test(body.heure_prevue)
    ? body.heure_prevue.slice(0, 5)
    : null
  const heureFinPrevueClean = body.heure_fin_prevue && /^\d{2}:\d{2}/.test(body.heure_fin_prevue)
    ? body.heure_fin_prevue.slice(0, 5)
    : null

  if (heurePrevueClean && heureFinPrevueClean) {
    const creneau = validateCreneau(heurePrevueClean, heureFinPrevueClean)
    if (!creneau.ok) {
      return NextResponse.json({ error: creneau.error }, { status: 400 })
    }
  }

  const canalClean = isCanalAcquisition(body.canal_acquisition) ? body.canal_acquisition : null
  const modePaiementClean = normalizeModePaiementInput(body.mode_paiement)

  const baseRow: Record<string, unknown> = {
    client_id: clientId,
    technicien_id: body.technicien_id || null,
    agence: body.agence || null,
    type_intervention: body.type_intervention,
    adresse_chantier: adresseChantier,
    ville,
    code_postal: codePostal,
    date_prevue: body.date_prevue || null,
    heure_prevue: heurePrevueClean,
    heure_fin_prevue: heureFinPrevueClean,
    duree_estimee_min: typeof body.duree_estimee_min === 'number' ? body.duree_estimee_min : null,
    urgence: !!body.urgence,
    statut: 'planifiee',
    prix_prevu: typeof body.prix_prevu === 'number' ? body.prix_prevu : null,
    notes_internes: body.notes_internes || null,
    canal_acquisition: canalClean,
    mode_paiement: modePaiementClean,
  }

  let inserted: ({ id: string; technicien_id: string | null } & Record<string, unknown>) | null = null
  let insertErr: PostgrestError | null = null
  let currentRef = baseReference
  // Tant que 028/029 ne sont pas appliquées, on retire ces colonnes une fois pour toutes.
  let stripOptionalCols = false

  for (let attempt = 0; attempt < 8; attempt++) {
    const row: Record<string, unknown> = { ...baseRow }
    if (stripOptionalCols) {
      delete row.mode_paiement
      delete row.heure_fin_prevue
    }

    const res = await sb
      .from('interventions')
      .insert({ reference: currentRef, ...row })
      .select('*')
      .single()

    if (!res.error && res.data) {
      inserted = res.data
      insertErr = null
      break
    }

    insertErr = res.error
    const msg = res.error?.message || ''

    if (!stripOptionalCols && (msg.includes('mode_paiement') || msg.includes('heure_fin_prevue'))) {
      // Ancienne contrainte mono-mode (migration 030 absente) : garder le 1er mode.
      if (
        /check|constraint/i.test(msg)
        && typeof baseRow.mode_paiement === 'string'
        && String(baseRow.mode_paiement).includes(',')
      ) {
        baseRow.mode_paiement = String(baseRow.mode_paiement).split(',')[0]
        continue
      }
      // Colonnes absentes (028/029) → on les retire pour les essais suivants.
      stripOptionalCols = true
      continue
    }

    // Collision référence (même créneau HH:MM, ou double clic) → nouveau suffixe.
    if (
      res.error?.code === '23505'
      || /interventions_reference_key|duplicate key/i.test(msg)
    ) {
      const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
      currentRef = `${baseReference}-${suffix}`
      continue
    }

    break
  }

  if (insertErr || !inserted) {
    const msg = insertErr?.message || 'Insertion échouée'
    const friendly = /interventions_reference_key|duplicate key/i.test(msg)
      ? 'Une intervention existe déjà pour ce créneau (référence en doublon). Réessaie ou change l’heure.'
      : msg
    return NextResponse.json({ error: friendly }, { status: 500 })
  }

  // 4. Notification technicien (await — Vercel coupe le process si fire-and-forget)
  let notification: NotifyTechnicienResult | null = null
  if (inserted.technicien_id) {
    try {
      notification = await notifyTechnicienForIntervention(
        inserted.id,
        inserted.technicien_id,
        resolveNotifyBaseUrl(new URL(req.url).origin),
      )
    } catch (e) {
      console.error('[interventions.POST notify]', e)
      notification = {
        ok: false,
        mail_sent: false,
        sms_sent: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  return NextResponse.json({ intervention: inserted, notification }, { status: 201 })
}

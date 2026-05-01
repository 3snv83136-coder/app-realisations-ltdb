import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull, upsertClient } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const formData = await req.formData()

  const ltdbUrl = process.env.LTDB_API_URL
  const token = process.env.LTDB_PUBLISH_TOKEN

  if (!ltdbUrl || !token) {
    return NextResponse.json({ error: 'Config LTDB manquante' }, { status: 500 })
  }

  try {
    const response = await fetch(`${ltdbUrl}/api/gallery/publish/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })

    const txt = await response.text()
    let data: any = null
    try { data = JSON.parse(txt) } catch { /* réponse non-JSON (HTML d'erreur Django, etc.) */ }

    if (!response.ok) {
      console.error('[publish] LTDB API error', {
        status: response.status,
        url: `${ltdbUrl}/api/gallery/publish/`,
        contentType: response.headers.get('content-type'),
        bodyPreview: txt.slice(0, 2000),
        sentFields: Array.from(formData.keys()),
      })
      const msg = data
        ? (typeof data === 'string' ? data : data.error || data.detail || JSON.stringify(data))
        : `HTTP ${response.status} — ${txt.slice(0, 800)}`
      return NextResponse.json({ error: `LTDB API : ${msg}`, status: response.status, bodyPreview: txt.slice(0, 800) }, { status: response.status })
    }

    // Persiste l'intervention en DB (best-effort, on ne bloque pas la réponse)
    persistIntervention(formData, data).catch(e => console.error('[publish] supabase persist', e))

    return NextResponse.json(data ?? { ok: true }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: `Publish fetch failed : ${e.message || e.toString()}` }, { status: 500 })
  }
}

async function persistIntervention(formData: FormData, ltdbResponse: any) {
  const sb = getSupabaseOrNull()
  if (!sb) return

  const get = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : null
  }

  const clientNom = get('client_nom') || ''
  const clientEmail = get('client_email') || ''
  const clientAdresse = get('client_adresse') || ''
  const ville = get('intervention_city') || get('location') || ''
  const codePostal = get('postal_code') || ''
  const slug = ltdbResponse?.slug || get('slug') || ''
  const typeIntervention = get('service_type') || ''
  const dateRealisee = get('intervention_date') || null
  const transcription = get('transcription') || ''
  const rapportJson = safeParseJson(get('rapport_json'))
  const seoJson = safeParseJson(get('seo_json'))
  const reference = rapportJson?.reference || null
  const interventionId = get('intervention_id')

  // Upsert client
  const clientId = await upsertClient({
    nom: clientNom,
    email: clientEmail,
    adresse: clientAdresse,
    ville,
    code_postal: codePostal,
  })

  if (interventionId) {
    // Mise à jour de l'intervention planifiée existante
    const { error } = await sb.from('interventions').update({
      client_id: clientId,
      type_intervention: typeIntervention || null,
      adresse_chantier: clientAdresse || null,
      ville: ville || null,
      code_postal: codePostal || null,
      date_realisee: dateRealisee,
      statut: 'terminee',
      transcription: transcription || null,
      rapport_json: rapportJson,
      seo_json: seoJson,
      publie_slug: slug || null,
    }).eq('id', interventionId)
    if (error) console.error('[persistIntervention update]', error)
    return
  }

  // Sinon, insère une nouvelle intervention (status terminée car publiée)
  const { error } = await sb.from('interventions').insert({
    reference,
    client_id: clientId,
    type_intervention: typeIntervention || null,
    adresse_chantier: clientAdresse || null,
    ville: ville || null,
    code_postal: codePostal || null,
    date_realisee: dateRealisee,
    statut: 'terminee',
    transcription: transcription || null,
    rapport_json: rapportJson,
    seo_json: seoJson,
    publie_slug: slug || null,
  })
  if (error) console.error('[persistIntervention]', error)
}

function safeParseJson(s: string | null): any {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

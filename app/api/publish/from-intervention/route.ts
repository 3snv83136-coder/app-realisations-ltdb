import { NextRequest, NextResponse } from "next/server"
import { formatDjangoPublishError } from "@/lib/django-publish-error"
import { resolvePhotoCategory } from "@/lib/photo-categories"
import { buildPublishDescription } from "@/lib/publish-description"
import {
  buildPublishContentHtml,
  sortPhotosForPublish,
} from "@/lib/publish-content"
import { getSupabaseOrNull } from "@/lib/supabase"
import { REALISATION_PAGE_STYLE } from "@/lib/realisationPageCss"

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Publication directe d'une intervention déjà saisie (avec rapport_json,
 * seo_json et photos_urls) vers le site Django LTDB.
 *
 * Body : { interventionId: string }
 *
 * Évite le détour par /nouveau : le wizard Mode Terrain a déjà tout le
 * contenu nécessaire, pas besoin de re-cliquer sur "Publier".
 */
export async function POST(req: NextRequest) {
  const ltdbUrl = process.env.LTDB_API_URL
  const token = process.env.LTDB_PUBLISH_TOKEN
  if (!ltdbUrl || !token) {
    return NextResponse.json({ error: 'Config LTDB manquante (LTDB_API_URL / LTDB_PUBLISH_TOKEN)' }, { status: 500 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: 'Supabase non configuré' }, { status: 500 })

  let body: { interventionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }
  const interventionId = (body.interventionId || '').trim()
  if (!interventionId) return NextResponse.json({ error: 'interventionId requis' }, { status: 400 })

  const { data: interv, error: intErr } = await sb
    .from('interventions')
    .select('id, reference, type_intervention, ville, code_postal, adresse_chantier, date_realisee, date_prevue, client_id, technicien_id, rapport_json, seo_json, transcription, photos_urls, photos_legendes, photos_categories, publie_slug')
    .eq('id', interventionId)
    .maybeSingle()
  if (intErr) return NextResponse.json({ error: intErr.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

  if (!interv.rapport_json || Object.keys(interv.rapport_json).length === 0) {
    return NextResponse.json({ error: 'Le rapport n\'est pas généré pour cette intervention.' }, { status: 400 })
  }
  const seo = interv.seo_json
  if (!seo || Object.keys(seo).length === 0) {
    return NextResponse.json({ error: 'Le bloc SEO n\'est pas généré pour cette intervention.' }, { status: 400 })
  }
  const photosUrls: string[] = Array.isArray(interv.photos_urls) ? interv.photos_urls : []
  if (photosUrls.length === 0) {
    return NextResponse.json({ error: 'Aucune photo — au moins une est requise pour publier.' }, { status: 400 })
  }

  // Client : on remonte aussi l'adresse pour pouvoir basculer sur la fiche
  // quand l'intervention n'a pas d'adresse chantier (cas fréquent quand le
  // chantier est chez le client).
  let clientNom = ''
  let clientEmail = ''
  let clientAdresse: string | null = null
  let clientVille: string | null = null
  let clientCp: string | null = null
  if (interv.client_id) {
    const { data: c } = await sb
      .from('clients')
      .select('nom, email, adresse, ville, code_postal')
      .eq('id', interv.client_id)
      .maybeSingle()
    clientNom = c?.nom || ''
    clientEmail = c?.email || ''
    clientAdresse = c?.adresse || null
    clientVille = c?.ville || null
    clientCp = c?.code_postal || null
  }

  // Technicien : Django LTDB exige le champ technicien_name NOT NULL en base
  // (commit Django a904cfb). Sans ça, le serializer accepte sans valeur et
  // create() écrit null → IntegrityError 500. Fallback vide si pas de tech.
  let technicienNom = ''
  let technicienPhotoUrl: string | null = null
  let technicienAnnees: number | null = null
  let technicienTitre: string | null = null
  if (interv.technicien_id) {
    const { data: t } = await sb
      .from('techniciens')
      .select('nom, photo_url, annees_experience, titre_metier')
      .eq('id', interv.technicien_id)
      .maybeSingle()
    technicienNom = t?.nom || ''
    technicienPhotoUrl = t?.photo_url || null
    technicienAnnees = t?.annees_experience ?? null
    technicienTitre = t?.titre_metier || null
  }

  // Localisation effective (fallback sur la fiche client quand l'intervention
  // n'a pas de chantier renseigné) + base de nommage SEO des photos :
  // « <service>-<ville> » → ex. debouchage-wc-toulon.
  const ville = interv.ville || clientVille || ''
  const codePostal = interv.code_postal || clientCp || ''
  const adresse = interv.adresse_chantier || clientAdresse || ''
  if (!ville.trim()) {
    return NextResponse.json({
      error: 'Ville manquante — renseigne la ville sur l\'intervention ou la fiche client avant de publier.',
    }, { status: 400 })
  }
  const slugify = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[àâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const nomBase =
    [slugify(interv.type_intervention || 'intervention'), slugify(ville)]
      .filter(Boolean)
      .join('-') || 'realisation'

  // Récupère les photos depuis Storage en passant par le endpoint de transformation
  // Supabase pour les compresser. Sans ça, 2 photos iPhone ~1MB chacune dépassent
  // la limite de taille de body côté Django LTDB (~2MB) → HTTP 500 silencieux
  // sur l'endpoint /api/gallery/publish/. width=1280 + quality=70 ramène chaque
  // image à ~300-400KB.
  const toRenderUrl = (url: string) => {
    // /storage/v1/object/public/<bucket>/<path> → /storage/v1/render/image/public/<bucket>/<path>
    const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const sep = transformed.includes('?') ? '&' : '?'
    return `${transformed}${sep}width=1280&quality=70`
  }

  const photosLegendes: string[] = Array.isArray(interv.photos_legendes) ? interv.photos_legendes : []
  const photosCategories: string[] = Array.isArray(interv.photos_categories) ? interv.photos_categories : []

  const photoMetaSorted = sortPhotosForPublish(
    photosUrls.map((url, i) => ({
      url,
      legende: photosLegendes[i] || `Photo ${i + 1}`,
      categorie: resolvePhotoCategory(photosCategories, photosLegendes, i),
    })),
  )

  const photoBlobs = await Promise.all(
    photoMetaSorted.map(async (meta, i) => {
      try {
        const renderUrl = toRenderUrl(meta.url)
        const r = await fetch(renderUrl)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const blob = await r.blob()
        return {
          blob,
          filename: `${nomBase}-${i + 1}.jpg`,
          legende: meta.legende,
          categorie: meta.categorie,
          url: renderUrl,
        }
      } catch (e) {
        console.error('[publish/from-intervention] photo fetch', meta.url, e)
        return null
      }
    }),
  )
  const validPhotos = photoBlobs.filter((p): p is NonNullable<typeof p> => p !== null)
  if (validPhotos.length === 0) {
    return NextResponse.json({ error: 'Aucune photo téléchargeable depuis Storage.' }, { status: 502 })
  }

  // Contenu HTML : SEO + fallback rapport si contenu_principal vide (fréquent en terrain).
  void REALISATION_PAGE_STYLE
  const { content: contentWithContainers, seo: seoForPublish } = buildPublishContentHtml({
    seo: seo as Record<string, unknown>,
    rapport: interv.rapport_json as Record<string, unknown> | null,
    typeIntervention: interv.type_intervention,
    ville,
    codePostal,
    photos: validPhotos.map((p) => ({ legende: p.legende, categorie: p.categorie, url: p.url })),
    technicien: technicienNom
      ? {
          nom: technicienNom,
          photoUrl: technicienPhotoUrl,
          anneesExperience: technicienAnnees,
          titreMetier: technicienTitre,
        }
      : null,
  })

  const dateIntervention = interv.date_realisee || interv.date_prevue || new Date().toISOString().slice(0, 10)

  // Tronque les champs courts pour respecter les CharField Django.
  // title = CharField(max_length=100) côté Django → DeepSeek génère parfois
  // 108+ chars et le serveur renvoyait HTTP 500 silencieusement. On garde
  // 95 chars + une marge de sécurité. meta_description = max ~200, on garde 195.
  const truncate = (s: string, max: number) => {
    if (s.length <= max) return s
    return s.slice(0, max - 3).trimEnd() + '...'
  }
  const rawTitle = (typeof seoForPublish.titre_h1 === 'string' && seoForPublish.titre_h1)
    || `${interv.type_intervention || 'Intervention'} à ${ville}`
  const rawDesc = buildPublishDescription({
    seo: seoForPublish,
    rapport: interv.rapport_json as Record<string, unknown> | null,
    typeIntervention: interv.type_intervention,
    ville,
  })

  // Slug : republier = slug existant ; sinon SEO ou base service-ville + suffixe ID
  // (évite HTTP 400 Django quand slug vide ou déjà pris).
  const idSuffix = interventionId.replace(/-/g, '').slice(0, 8)
  let publishSlug = (interv.publie_slug || (typeof seoForPublish.slug === 'string' ? seoForPublish.slug : '') || nomBase || 'realisation').trim()
  if (!publishSlug) publishSlug = `realisation-${idSuffix}`
  if (!interv.publie_slug && !publishSlug.endsWith(idSuffix)) {
    publishSlug = `${publishSlug}-${idSuffix}`
  }
  publishSlug = publishSlug.slice(0, 95)

  // Construit le FormData attendu par /api/gallery/publish/ Django.
  const fd = new FormData()
  fd.append('title', truncate(rawTitle, 95))
  fd.append('slug', publishSlug)
  fd.append('service_type', interv.type_intervention || '')
  fd.append('location', ville)
  fd.append('intervention_city', ville)
  fd.append('postal_code', codePostal)
  fd.append('intervention_date', dateIntervention)
  fd.append('description', truncate(rawDesc, 195))
  fd.append('meta_keywords', Array.isArray(seoForPublish.meta_keywords) ? seoForPublish.meta_keywords.join(', ') : '')
  fd.append('content', contentWithContainers)
  fd.append('faq_json', JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (Array.isArray(seoForPublish.faq) ? seoForPublish.faq : []).map((f: { question?: string; reponse?: string }) => ({
      '@type': 'Question', name: f?.question || '',
      acceptedAnswer: { '@type': 'Answer', text: f?.reponse || '' },
    })),
  }))
  fd.append('jsonld', JSON.stringify(seoForPublish.jsonld || {}))
  fd.append('related_services_json', JSON.stringify(seoForPublish.related_services || []))
  fd.append('is_published', 'true')
  fd.append('transcription', interv.transcription || '')
  fd.append('rapport_json', JSON.stringify(interv.rapport_json))
  fd.append('seo_json', JSON.stringify(seoForPublish))
  fd.append('client_nom', clientNom)
  fd.append('client_email', clientEmail)
  fd.append('client_adresse', `${adresse} ${codePostal} ${ville}`.trim())
  fd.append('intervention_id', interventionId)
  fd.append('technicien_name', technicienNom)
  // Wrap les Blob en File explicite : certains parseurs multipart (Django
  // notamment) discriminent en fonction de l'objet, et un Blob "nu" peut
  // tomber dans un code path différent qui finit en 500 silencieux.
  const toFile = (b: { blob: Blob; filename: string }) =>
    new File([b.blob], b.filename, { type: b.blob.type || 'image/jpeg' })
  const beforePhoto = validPhotos.find(p => p.categorie === 'avant') || validPhotos[0]
  const afterPhoto = validPhotos.find(p => p.categorie === 'apres') || validPhotos[1] || validPhotos[0]
  const extraPhotos = validPhotos.filter(p => p !== beforePhoto && p !== afterPhoto)

  fd.append('before_image', toFile(beforePhoto))
  fd.append('after_image', toFile(afterPhoto))
  extraPhotos.forEach((p, i) => fd.append(`extra_image_${i}`, toFile(p)))

  // Métadonnées photos structurées — permet à Django de renommer chaque
  // fichier (SEO : activité + ville) et d'écrire des alt / ImageObject précis,
  // au lieu de déduire depuis le seul nom de fichier multipart.
  fd.append('photos_nom_base', nomBase)
  fd.append(
    'photos_json',
    JSON.stringify(
      [
        { field: 'before_image', ordre: 0, filename: beforePhoto.filename, legende: beforePhoto.legende, categorie: beforePhoto.categorie },
        { field: 'after_image', ordre: 1, filename: afterPhoto.filename, legende: afterPhoto.legende, categorie: afterPhoto.categorie },
        ...extraPhotos.map((p, i) => ({
          field: `extra_image_${i}`,
          ordre: i + 2,
          filename: p.filename,
          legende: p.legende,
          categorie: p.categorie,
        })),
      ],
    ),
  )

  // Forward au Django.
  let djResp: Response
  try {
    djResp = await fetch(`${ltdbUrl}/api/gallery/publish/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
  } catch (e) {
    return NextResponse.json({ error: `Appel Django échoué : ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
  }
  const txt = await djResp.text()
  let data: unknown = null
  try { data = JSON.parse(txt) } catch { /* HTML d'erreur */ }
  if (!djResp.ok) {
    // Log verbeux pour diagnostiquer un rejet Django : taille du content,
    // types des fichiers, liste des champs envoyés.
    const fieldSizes: Record<string, number | string> = {}
    fd.forEach((v, k) => {
      if (typeof v === 'string') fieldSizes[k] = v.length
      else if (v instanceof Blob) fieldSizes[k] = `Blob(${v.size}b, ${v.type || 'no-type'})`
    })
    console.error('[publish/from-intervention] Django error', {
      status: djResp.status,
      contentType: djResp.headers.get('content-type'),
      bodyFull: txt,
      fieldSizes,
      url: `${ltdbUrl}/api/gallery/publish/`,
    })
    const msg = formatDjangoPublishError(data, txt, djResp.status)
    return NextResponse.json({
      error: `LTDB : ${msg}`,
      bodyPreview: txt.slice(0, 800),
      fieldSizes,
    }, { status: djResp.status })
  }

  const slug = (data && typeof data === 'object' && 'slug' in data ? String((data as { slug: string }).slug) : '') || (typeof seoForPublish.slug === 'string' ? seoForPublish.slug : '') || ''
  // Persiste le slug sur l'intervention (best-effort).
  if (slug) {
    await sb.from('interventions').update({
      publie_slug: slug,
      seo_json: seoForPublish,
    }).eq('id', interventionId)
  }

  return NextResponse.json({ ok: true, slug, data })
}

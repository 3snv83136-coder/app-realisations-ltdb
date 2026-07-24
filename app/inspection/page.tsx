'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import AppTabs from "@/components/AppTabs"
import ClientAutocomplete, { type ClientRecord } from "@/components/ClientAutocomplete"
import VilleCombobox from "@/components/VilleCombobox"
import {
  DEFAUTS, MATERIAUX, DIAMETRES, RESEAUX, MATERIELS_INSPECTION,
  PRECONISATIONS, GRAVITE_LABELS,
} from "@/lib/camera-defauts"
import type { InspectionData, ObservationItem, Troncon } from "@/components/InspectionCameraPDF"
import { errorMessage } from "@/lib/error-message"

const InspectionDownloadButton = dynamic(() => import("@/components/InspectionCameraPDF"), { ssr: false })
const InspectionPDFViewer = dynamic(() => import("@/components/InspectionCameraPreviewModal"), { ssr: false })

type ObsForm = ObservationItem & { _photoFile?: File; _photoPreview?: string }

type InterventionPick = {
  id: string
  reference: string | null
  type_intervention: string | null
  date_prevue: string | null
  heure_prevue: string | null
  ville: string | null
  adresse_chantier: string | null
  statut: string | null
  client_nom: string | null
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const dataUrl = await fileToDataUrl(file)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim }
        else { width = Math.round(width * maxDim / height); height = maxDim }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas non supporté'))
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => {
          if (!blob) return reject(new Error('Compression échouée'))
          const compressed = new File([blob], file.name.replace(/\.(heic|heif|png|webp)$/i, '.jpg'), { type: 'image/jpeg' })
          resolve(compressed)
        },
        'image/jpeg', quality,
      )
    }
    img.onerror = () => reject(new Error('Lecture image impossible'))
    img.src = dataUrl
  })
}

function genNumero() {
  const d = new Date()
  const seq = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0')
  return `ITV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${seq}`
}

export default function InspectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Chargement…
      </div>
    }>
      <InspectionPageInner />
    </Suspense>
  )
}

function InspectionPageInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const interventionFromUrl = searchParams.get('intervention')

  const [numero, setNumero] = useState('')
  useEffect(() => { setNumero(genNumero()) }, [])

  const [dateInspection, setDateInspection] = useState(new Date().toISOString().split('T')[0])
  const [technicienNom, setTechnicienNom] = useState('')
  const [agence] = useState('LTDB Toulon')

  // Lien intervention
  const [linkedInterventionId, setLinkedInterventionId] = useState<string | null>(null)
  const [linkedInterventionLabel, setLinkedInterventionLabel] = useState('')
  const [prefillLoading, setPrefillLoading] = useState(!!interventionFromUrl)
  const [prefillError, setPrefillError] = useState('')
  const [showItvPicker, setShowItvPicker] = useState(false)
  const [itvLoading, setItvLoading] = useState(false)
  const [itvError, setItvError] = useState('')
  const [itvList, setItvList] = useState<InterventionPick[]>([])
  const [itvQuery, setItvQuery] = useState('')

  // Client
  const [clientNom, setClientNom] = useState('')
  const [clientAdresse, setClientAdresse] = useState('')
  const [clientCP, setClientCP] = useState('')
  const [clientVille, setClientVille] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientTel, setClientTel] = useState('')

  // Tronçon
  const [reseau, setReseau] = useState<string>(RESEAUX[0])
  const [materiau, setMateriau] = useState<string>(MATERIAUX[0])
  const [diametre, setDiametre] = useState<string>('DN 100')
  const [longueurM, setLongueurM] = useState<string>('')
  const [regardAmont, setRegardAmont] = useState('')
  const [regardAval, setRegardAval] = useState('')
  const [sensInspection, setSensInspection] = useState('amont vers aval')
  const [materielUtilise, setMaterielUtilise] = useState<string>(MATERIELS_INSPECTION[1])
  const [conditionsMeteo, setConditionsMeteo] = useState('')

  // Observations
  const [observations, setObservations] = useState<ObsForm[]>([
    { position: '', code: '', description: '' },
  ])
  const [photoError, setPhotoError] = useState('')

  // Préconisations
  const [precoSelected, setPrecoSelected] = useState<string[]>([])
  const [precoCustom, setPrecoCustom] = useState<{ titre: string; detail: string }[]>([])
  const [newPrecoTitre, setNewPrecoTitre] = useState('')
  const [newPrecoDetail, setNewPrecoDetail] = useState('')

  // Synthèse
  const [resume, setResume] = useState('')
  const [conclusionEtat, setConclusionEtat] = useState<InspectionData['conclusionEtat']>('a-surveiller')

  // Aperçu modal
  const [showPreview, setShowPreview] = useState(false)

  // Persist tech
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ltdb_technicien') : null
    if (saved) setTechnicienNom(saved)
  }, [])
  useEffect(() => {
    if (technicienNom && typeof window !== 'undefined') localStorage.setItem('ltdb_technicien', technicienNom)
  }, [technicienNom])

  function fillFromClient(c: ClientRecord) {
    setClientNom(c.nom || '')
    if (c.adresse) setClientAdresse(c.adresse)
    if (c.code_postal) setClientCP(c.code_postal)
    if (c.ville) setClientVille(c.ville)
    if (c.email) setClientEmail(c.email)
    if (c.telephone) setClientTel(c.telephone)
  }

  const applyIntervention = useCallback(async (id: string) => {
    setPrefillError('')
    setPrefillLoading(true)
    try {
      const res = await fetch(`/api/interventions/${id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const itv = data.intervention
      const c = data.client
      const tech = data.technicien

      setLinkedInterventionId(id)
      setLinkedInterventionLabel(
        [itv?.reference || id.slice(0, 8), itv?.type_intervention, c?.nom]
          .filter(Boolean)
          .join(' · '),
      )

      if (c?.nom) setClientNom(c.nom)
      if (c?.email) setClientEmail(c.email)
      if (c?.telephone) setClientTel(c.telephone)

      // Adresse chantier prioritaire, sinon fiche client
      const adresse = itv?.adresse_chantier || c?.adresse || ''
      const cp = itv?.code_postal || c?.code_postal || ''
      const ville = itv?.ville || c?.ville || ''
      if (adresse) setClientAdresse(adresse)
      if (cp) setClientCP(cp)
      if (ville) setClientVille(ville)

      const dateRaw = itv?.date_realisee || itv?.date_prevue
      if (dateRaw && /^\d{4}-\d{2}-\d{2}/.test(dateRaw)) {
        setDateInspection(String(dateRaw).slice(0, 10))
      }
      if (tech?.nom) setTechnicienNom(tech.nom)

      setShowItvPicker(false)
    } catch (e) {
      setPrefillError(errorMessage(e) || 'Impossible de charger l’intervention')
    } finally {
      setPrefillLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!interventionFromUrl) {
      setPrefillLoading(false)
      return
    }
    void applyIntervention(interventionFromUrl)
  }, [interventionFromUrl, applyIntervention])

  async function openInterventionPicker() {
    setShowItvPicker(true)
    setItvError('')
    setItvLoading(true)
    try {
      const today = new Date()
      const from = new Date(today)
      from.setDate(from.getDate() - 7)
      const to = new Date(today)
      to.setDate(to.getDate() + 14)
      const fromStr = from.toISOString().slice(0, 10)
      const toStr = to.toISOString().slice(0, 10)
      const res = await fetch(
        `/api/interventions?from=${fromStr}&to=${toStr}&limit=100`,
        { cache: 'no-store' },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const list = (Array.isArray(data.interventions) ? data.interventions : [])
        .filter((i: InterventionPick) => i.statut !== 'annulee') as InterventionPick[]
      setItvList(list)
    } catch (e) {
      setItvError(errorMessage(e) || 'Chargement impossible')
      setItvList([])
    } finally {
      setItvLoading(false)
    }
  }

  function unlinkIntervention() {
    setLinkedInterventionId(null)
    setLinkedInterventionLabel('')
  }

  const filteredItv = useMemo(() => {
    const q = itvQuery.trim().toLowerCase()
    if (!q) return itvList
    return itvList.filter(i => {
      const hay = [
        i.reference, i.client_nom, i.type_intervention, i.ville, i.adresse_chantier,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [itvList, itvQuery])

  // Gestion observations
  function addObservation() {
    setObservations(prev => [...prev, { position: '', code: '', description: '' }])
  }
  function updateObs(i: number, patch: Partial<ObsForm>) {
    setObservations(prev => prev.map((o, idx) => idx === i ? { ...o, ...patch } : o))
  }
  function removeObs(i: number) {
    setObservations(prev => prev.filter((_, idx) => idx !== i))
  }
  async function setObsPhoto(i: number, file: File | null) {
    if (!file) return
    setPhotoError('')
    try {
      const compressed = await compressImage(file)
      const dataUrl = await fileToDataUrl(compressed)
      const preview = URL.createObjectURL(compressed)
      updateObs(i, { _photoFile: compressed, _photoPreview: preview, photoUrl: dataUrl })
    } catch (e) {
      console.error(e)
      setPhotoError(`Photo n°${i + 1} : ${errorMessage(e) || 'compression impossible'}. Réessaie ou choisis une autre image.`)
    }
  }
  function clearObsPhoto(i: number) {
    updateObs(i, { _photoFile: undefined, _photoPreview: undefined, photoUrl: undefined })
  }

  function togglePreco(id: string) {
    setPrecoSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function addCustomPreco() {
    if (!newPrecoTitre.trim()) return
    setPrecoCustom(prev => [...prev, { titre: newPrecoTitre.trim(), detail: newPrecoDetail.trim() }])
    setNewPrecoTitre(''); setNewPrecoDetail('')
  }
  function removeCustomPreco(i: number) {
    setPrecoCustom(prev => prev.filter((_, idx) => idx !== i))
  }

  // Données pour PDF
  const data: InspectionData = useMemo(() => {
    const troncon: Troncon = {
      reseau, materiau, diametre,
      longueurM: longueurM ? Number(longueurM) : undefined,
      regardAmont, regardAval, sensInspection, materielUtilise, conditionsMeteo,
    }
    const fromPresets = precoSelected
      .map(id => PRECONISATIONS.find(p => p.id === id))
      .filter((p): p is (typeof PRECONISATIONS)[number] => Boolean(p))
      .map(p => ({ titre: p.titre, detail: p.detail, urgence: p.urgence }))
    const allPrecos = [...fromPresets, ...precoCustom.map(p => ({ titre: p.titre, detail: p.detail, urgence: undefined as string | undefined }))]
    const cleanObs: ObservationItem[] = observations
      .filter(o => o.position || o.description || o.photoUrl || o.code)
      .map(o => ({
        position: o.position,
        code: o.code || undefined,
        description: o.description,
        photoUrl: o.photoUrl,
        photoLegende: o.photoLegende,
      }))
    return {
      numero,
      dateInspection,
      technicienNom: technicienNom || session?.user?.name || 'Technicien',
      agence,
      client: {
        nom: clientNom,
        adresse: clientAdresse,
        codePostal: clientCP,
        ville: clientVille,
        email: clientEmail || undefined,
        telephone: clientTel || undefined,
      },
      troncon,
      observations: cleanObs,
      preconisations: allPrecos,
      resume,
      conclusionEtat,
    }
  }, [
    numero, dateInspection, technicienNom, session?.user?.name, agence,
    clientNom, clientAdresse, clientCP, clientVille, clientEmail, clientTel,
    reseau, materiau, diametre, longueurM, regardAmont, regardAval, sensInspection, materielUtilise, conditionsMeteo,
    observations, precoSelected, precoCustom, resume, conclusionEtat,
  ])

  const canPreview = clientNom.trim().length > 0

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <AppTabs />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header bandeau */}
        <div className="bg-gradient-to-br from-[#0e2a52] to-[#1a3a6b] text-white rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-orange-300/90 font-bold">Inspection télévisée · ITV · NF EN 13508-2</div>
            <h1 className="text-2xl sm:text-3xl font-black mt-1">Rapport d&apos;inspection caméra</h1>
            <p className="text-sm text-white/70 mt-1">N° {numero} · {dateInspection}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={!canPreview}
              className="bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
            >
              👁 Aperçu PDF
            </button>
            <InspectionDownloadButton
              data={data}
              filename={`inspection-camera-${(clientNom || 'client').toLowerCase().replace(/\s+/g, '-')}-${numero}.pdf`}
              className="bg-orange-500 hover:bg-orange-600 px-4 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
              label="📄 Télécharger PDF"
            />
          </div>
        </div>

        {(prefillLoading || linkedInterventionId || prefillError) && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${
            prefillError
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}>
            {prefillLoading ? (
              'Chargement de l’intervention…'
            ) : prefillError ? (
              prefillError
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Rapport lié à l’intervention{' '}
                  <Link href={`/intervention/${linkedInterventionId}`} className="font-bold underline">
                    {linkedInterventionLabel || linkedInterventionId}
                  </Link>
                  {' '}— date, nom et adresse préremplis.
                </span>
                <button
                  type="button"
                  onClick={unlinkIntervention}
                  className="text-xs font-bold text-sky-700 hover:text-sky-900 underline"
                >
                  Délier
                </button>
              </div>
            )}
          </div>
        )}

        {/* Identité */}
        <Section title="1. Informations générales" icon="📍">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="N° rapport"><input value={numero} onChange={e => setNumero(e.target.value)} className={inputCls} /></Field>
            <Field label="Date d'inspection"><input type="date" value={dateInspection} onChange={e => setDateInspection(e.target.value)} className={inputCls} /></Field>
            <Field label="Technicien"><input value={technicienNom} onChange={e => setTechnicienNom(e.target.value)} className={inputCls} placeholder="Nom du technicien" /></Field>
            <Field label="Agence"><input value={agence} disabled className={inputCls + ' bg-slate-50 text-slate-500'} /></Field>
          </div>
        </Section>

        {/* Client */}
        <Section title="2. Client" icon="👤">
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={openInterventionPicker}
              className="bg-[#0e2a52] hover:bg-[#1a3a6b] text-white text-sm font-bold px-3 py-2 rounded-lg transition"
            >
              🔗 Lier une intervention
            </button>
            <span className="text-xs text-slate-500 self-center">
              ou tape le nom client ci-dessous pour récupérer la fiche
            </span>
          </div>

          {showItvPicker && (
            <div className="mb-4 border-2 border-sky-200 bg-sky-50/60 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-[#0e2a52]">Choisir une intervention (±7 j / +14 j)</div>
                <button
                  type="button"
                  onClick={() => setShowItvPicker(false)}
                  className="text-slate-500 hover:text-slate-800 text-xl leading-none"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
              <input
                value={itvQuery}
                onChange={e => setItvQuery(e.target.value)}
                placeholder="Filtrer par client, référence, ville…"
                className={inputCls}
              />
              {itvLoading && <p className="text-sm text-slate-500">Chargement…</p>}
              {itvError && <p className="text-sm text-red-600">{itvError}</p>}
              {!itvLoading && !itvError && filteredItv.length === 0 && (
                <p className="text-sm text-slate-500">Aucune intervention sur cette période.</p>
              )}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredItv.map(i => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => void applyIntervention(i.id)}
                    className="w-full text-left bg-white hover:bg-sky-100 border border-slate-200 rounded-lg px-3 py-2.5 transition"
                  >
                    <div className="font-bold text-sm text-[#0e2a52]">
                      {i.client_nom || 'Client inconnu'}
                      {i.heure_prevue ? ` · ${String(i.heure_prevue).slice(0, 5)}` : ''}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {[i.date_prevue, i.type_intervention, i.ville || i.adresse_chantier, i.reference]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nom / Raison sociale">
              <ClientAutocomplete
                value={clientNom}
                onChange={setClientNom}
                onSelect={fillFromClient}
                placeholder="Rechercher un client…"
                className={inputCls}
              />
            </Field>
            <Field label="Adresse"><input value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} className={inputCls} /></Field>
            <Field label="Code postal"><input value={clientCP} onChange={e => setClientCP(e.target.value)} className={inputCls} /></Field>
            <Field label="Ville">
              <VilleCombobox
                value={clientVille}
                onChange={setClientVille}
                onSelect={(v) => { setClientVille(v.nom); if (v.cp) setClientCP(v.cp) }}
              />
            </Field>
            <Field label="Email (optionnel)"><input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className={inputCls} /></Field>
            <Field label="Téléphone (optionnel)"><input value={clientTel} onChange={e => setClientTel(e.target.value)} className={inputCls} /></Field>
          </div>
        </Section>

        {/* Tronçon */}
        <Section title="3. Caractéristiques du tronçon" icon="🛠">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Type de réseau">
              <select value={reseau} onChange={e => setReseau(e.target.value)} className={inputCls}>
                {RESEAUX.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Matériau">
              <select value={materiau} onChange={e => setMateriau(e.target.value)} className={inputCls}>
                {MATERIAUX.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Diamètre">
              <select value={diametre} onChange={e => setDiametre(e.target.value)} className={inputCls}>
                {DIAMETRES.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Linéaire inspecté (m)">
              <input type="number" min="0" step="0.1" value={longueurM} onChange={e => setLongueurM(e.target.value)} className={inputCls} placeholder="ex : 12" />
            </Field>
            <Field label="Regard amont"><input value={regardAmont} onChange={e => setRegardAmont(e.target.value)} className={inputCls} placeholder="ex : Regard 1 — pied façade" /></Field>
            <Field label="Regard aval"><input value={regardAval} onChange={e => setRegardAval(e.target.value)} className={inputCls} placeholder="ex : Regard 2 — collecteur rue" /></Field>
            <Field label="Sens d'inspection">
              <select value={sensInspection} onChange={e => setSensInspection(e.target.value)} className={inputCls}>
                <option>amont vers aval</option>
                <option>aval vers amont</option>
                <option>bidirectionnel</option>
              </select>
            </Field>
            <Field label="Matériel utilisé">
              <select value={materielUtilise} onChange={e => setMaterielUtilise(e.target.value)} className={inputCls}>
                {MATERIELS_INSPECTION.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Conditions" className="sm:col-span-2">
              <input value={conditionsMeteo} onChange={e => setConditionsMeteo(e.target.value)} className={inputCls} placeholder="ex : sec, accès facilité ; ou : pluie battante, regard partiellement immergé" />
            </Field>
          </div>
        </Section>

        {/* Observations */}
        <Section title="4. Observations & photos" icon="📷">
          <p className="text-xs text-slate-500 mb-3">
            Une observation = un point précis du tronçon. Renseigne la position (mètres ou repère), choisis le code défaut NF EN 13508-2 et joins la photo correspondante.
          </p>
          {photoError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm mb-3 flex items-start justify-between gap-3">
              <span>⚠ {photoError}</span>
              <button type="button" onClick={() => setPhotoError('')} className="text-red-500 hover:text-red-700 font-bold">×</button>
            </div>
          )}
          <div className="space-y-4">
            {observations.map((o, i) => {
              const def = DEFAUTS.find(d => d.code === o.code)
              const grav = def ? GRAVITE_LABELS[def.gravite] : null
              return (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#0e2a52] text-white text-xs font-black px-2 py-1 rounded">OBS {String(i + 1).padStart(2, '0')}</span>
                      {grav && <span className="text-xs font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: grav.color }}>{grav.label}</span>}
                    </div>
                    <button type="button" onClick={() => removeObs(i)} className="text-red-500 hover:text-red-700 text-xl leading-none" aria-label="Supprimer cette observation">×</button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Position / repère">
                      <input value={o.position} onChange={e => updateObs(i, { position: e.target.value })} className={inputCls} placeholder="ex : 4,80 m depuis regard 1" />
                    </Field>
                    <Field label="Code défaut (NF EN 13508-2)">
                      <select value={o.code || ''} onChange={e => updateObs(i, { code: e.target.value })} className={inputCls}>
                        <option value="">— Choisir un code —</option>
                        <optgroup label="Défauts structurels (BA*)">
                          {DEFAUTS.filter(d => d.categorie === 'structurel' || d.categorie === 'raccordement').map(d => (
                            <option key={d.code} value={d.code}>{d.code} — {d.libelle}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Défauts fonctionnels (BB*)">
                          {DEFAUTS.filter(d => d.categorie === 'fonctionnel').map(d => (
                            <option key={d.code} value={d.code}>{d.code} — {d.libelle}</option>
                          ))}
                        </optgroup>
                        <option value="RAS">RAS — Rien à signaler</option>
                      </select>
                    </Field>
                  </div>
                  {def && (
                    <p className="text-xs text-slate-600 italic bg-white border border-slate-200 rounded p-2">
                      <strong className="text-[#0e2a52]">{def.code}</strong> — {def.description}
                    </p>
                  )}
                  <Field label="Description / commentaire technicien">
                    <textarea
                      value={o.description}
                      onChange={e => updateObs(i, { description: e.target.value })}
                      rows={2}
                      className={inputCls + ' resize-y'}
                      placeholder="Détails observés sur place : étendue, conséquences, contexte…"
                    />
                  </Field>
                  <div className="grid sm:grid-cols-[180px_1fr] gap-3 items-start">
                    <div>
                      {o._photoPreview || o.photoUrl ? (
                        <div className="relative">
                          <img src={o._photoPreview || o.photoUrl} alt="" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => clearObsPhoto(i)} className="absolute top-1 right-1 bg-white/90 text-slate-700 rounded-full w-7 h-7 text-sm font-bold shadow">×</button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-full h-32 bg-white border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-500 text-sm font-semibold">
                          <span className="text-2xl mb-1">📷</span>
                          Ajouter une photo
                          <input
                            type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => setObsPhoto(i, e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                    <Field label="Légende photo">
                      <input
                        value={o.photoLegende || ''}
                        onChange={e => updateObs(i, { photoLegende: e.target.value })}
                        className={inputCls}
                        placeholder="ex : racines en chevelu obstruant 60% de la section"
                      />
                    </Field>
                  </div>
                </div>
              )
            })}
          </div>
          <button
            type="button" onClick={addObservation}
            className="mt-4 w-full bg-[#0e2a52] hover:bg-[#1a3a6b] text-white font-bold py-2.5 rounded-xl transition-all"
          >
            + Ajouter une observation
          </button>
        </Section>

        {/* Préconisations */}
        <Section title="5. Préconisations" icon="🛡">
          <p className="text-xs text-slate-500 mb-3">
            Sélectionne les actions recommandées. Tu peux ajouter une préconisation libre en bas.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {PRECONISATIONS.map(p => {
              const active = precoSelected.includes(p.id)
              return (
                <button
                  key={p.id} type="button" onClick={() => togglePreco(p.id)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    active
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-sm text-[#0e2a52]">{p.titre}</span>
                    {active && <span className="text-emerald-600 text-lg leading-none">✓</span>}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{p.detail}</p>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1.5">Urgence : {p.urgence}</div>
                </button>
              )
            })}
          </div>

          {precoCustom.length > 0 && (
            <div className="mt-4 space-y-2">
              {precoCustom.map((p, i) => (
                <div key={i} className="flex justify-between items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div>
                    <div className="font-bold text-sm text-[#0e2a52]">{p.titre}</div>
                    {p.detail && <div className="text-xs text-slate-600 mt-1">{p.detail}</div>}
                  </div>
                  <button type="button" onClick={() => removeCustomPreco(i)} className="text-red-500 hover:text-red-700 text-xl leading-none" aria-label="Supprimer cette préconisation">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Ajouter une préconisation libre</div>
            <input value={newPrecoTitre} onChange={e => setNewPrecoTitre(e.target.value)} placeholder="Titre" className={inputCls} />
            <textarea value={newPrecoDetail} onChange={e => setNewPrecoDetail(e.target.value)} placeholder="Détail (optionnel)" rows={2} className={inputCls + ' resize-y'} />
            <button
              type="button" onClick={addCustomPreco} disabled={!newPrecoTitre.trim()}
              className="bg-[#0e2a52] hover:bg-[#1a3a6b] disabled:opacity-50 text-white text-sm font-bold py-2 px-4 rounded-lg"
            >
              + Ajouter
            </button>
          </div>
        </Section>

        {/* Synthèse */}
        <Section title="6. Synthèse & conclusion" icon="📝">
          <Field label="Conclusion globale">
            <div className="grid sm:grid-cols-4 gap-2">
              {([
                { v: 'bon',           label: 'État satisfaisant',     cls: 'border-emerald-500 bg-emerald-50 text-emerald-900' },
                { v: 'a-surveiller',  label: 'À surveiller',           cls: 'border-amber-500 bg-amber-50 text-amber-900' },
                { v: 'desordre',      label: 'Désordres significatifs',cls: 'border-red-500 bg-red-50 text-red-900' },
                { v: 'critique',      label: 'Critique',               cls: 'border-red-800 bg-red-100 text-red-900' },
              ] as const).map(opt => (
                <button
                  key={opt.v} type="button" onClick={() => setConclusionEtat(opt.v)}
                  className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    conclusionEtat === opt.v ? opt.cls : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Résumé technique">
            <textarea
              value={resume} onChange={e => setResume(e.target.value)}
              rows={6} className={inputCls + ' resize-y'}
              placeholder="Synthèse libre du technicien : état général du tronçon, défauts marquants, urgences, contexte d'usage…"
            />
          </Field>
        </Section>
      </main>

      {showPreview && (
        <InspectionPDFViewer data={data} onClose={() => setShowPreview(false)} />
      )}
    </div>
  )
}

const inputCls = "w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-black text-[#0e2a52] flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className || ''}`}>
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

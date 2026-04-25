'use client'
import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import VoiceRecorder from "@/components/VoiceRecorder"
import GenerationPreview from "@/components/GenerationPreview"
import AppTabs from "@/components/AppTabs"
import dynamic from "next/dynamic"
import { VILLES_VAR, searchVilles, findVilleByName, type VilleVar } from "@/lib/villes-var"

const PDFDownloadButton = dynamic(() => import("@/components/RealisationPDF"), { ssr: false })
const PDFPreviewModal = dynamic(() => import("@/components/PDFPreviewModal"), { ssr: false })
const DriveSaveButton = dynamic(() => import("@/components/DriveSaveButton"), { ssr: false })
import SitePreviewModal from "@/components/SitePreviewModal"
import TruckLoader from "@/components/TruckLoader"

function notifyDone(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try { new Notification(title, { body, icon: '/icon-192.png', tag: 'ltdb-rapport' }) } catch {}
}

async function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission() } catch {}
  }
}

type Step = 'capture' | 'extracting' | 'validate' | 'generating' | 'preview' | 'publishing' | 'done'

const TYPES = [
  { v: 'Débouchage canalisation', icon: '🔧' },
  { v: 'Débouchage WC', icon: '🚽' },
  { v: 'Débouchage évier', icon: '🍽' },
  { v: 'Débouchage douche', icon: '🚿' },
  { v: 'Hydrocurage', icon: '💦' },
  { v: 'Inspection caméra', icon: '📹' },
  { v: 'Vidange fosse septique', icon: '🛢' },
  { v: 'Curage canalisation', icon: '⚙' },
]

const STEPPER_STEPS = [
  { key: 'capture', label: 'Dictée & Photos', icon: '🎤' },
  { key: 'validate', label: 'Vérification', icon: '✅' },
  { key: 'preview', label: 'Rapport', icon: '📄' },
  { key: 'done', label: 'Terminé', icon: '🎉' },
]

function getStepperIndex(step: Step): number {
  if (step === 'capture' || step === 'extracting') return 0
  if (step === 'validate' || step === 'generating') return 1
  if (step === 'preview' || step === 'publishing') return 2
  if (step === 'done') return 3
  return 0
}

export default function NouveauPage() {
  const { data: session } = useSession()
  const [step, setStep] = useState<Step>('capture')
  const [error, setError] = useState('')

  // Champs
  const [transcription, setTranscription] = useState('')
  const [typeIntervention, setTypeIntervention] = useState('Débouchage canalisation')
  const [adresse, setAdresse] = useState('')
  const [ville, setVille] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [dateIntervention, setDateIntervention] = useState(new Date().toISOString().split('T')[0])
  const [clientNom, setClientNom] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [technicienNom, setTechnicienNom] = useState('')
  const [editTech, setEditTech] = useState(false)
  type PhotoItem = { file: File; dataUrl: string; preview: string; legende: string }
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  // Résultats IA
  const [rapport, setRapport] = useState<any>(null)
  const [seo, setSeo] = useState<any>(null)
  const [publishedSlug, setPublishedSlug] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showSitePreview, setShowSitePreview] = useState(false)

  // Persist nom technicien
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ltdb_technicien') : null
    if (saved) setTechnicienNom(saved)
    else setEditTech(true)
  }, [])
  useEffect(() => {
    if (technicienNom && typeof window !== 'undefined') localStorage.setItem('ltdb_technicien', technicienNom)
  }, [technicienNom])

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.removeItem('ltdb_draft')
  }, [])

  // Animation progressive écran IA
  const GEN_STEPS = [
    '🎙️ Analyse de la dictée…',
    '📝 Structuration du rapport…',
    '⚙️ Identification des phases…',
    '📊 Génération du tableau d\'analyse…',
    '🏷️ Optimisation SEO local…',
    '🔗 Maillage interne…',
    '❓ Rédaction FAQ…',
    '📦 Assemblage JSON-LD…',
    '✨ Finalisation…',
  ]
  const [genStepIdx, setGenStepIdx] = useState(0)
  useEffect(() => {
    if (step !== 'generating') return
    setGenStepIdx(0)
    const interval = setInterval(() => setGenStepIdx(i => (i + 1) % GEN_STEPS.length), 3500)
    return () => clearInterval(interval)
  }, [step])

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function compressImage(file: File, maxDim = 1920, quality = 0.82): Promise<File> {
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
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Lecture image impossible'))
      img.src = dataUrl
    })
  }

  function defaultLegende(index: number) {
    if (index === 0) return 'Photo avant intervention'
    if (index === 1) return 'Photo après intervention'
    return `Photo ${index + 1}`
  }

  async function addPhoto(file: File | null) {
    if (!file) return
    try {
      const compressed = await compressImage(file)
      const dataUrl = await fileToDataUrl(compressed)
      const preview = URL.createObjectURL(compressed)
      setPhotos(prev => [...prev, { file: compressed, dataUrl, preview, legende: defaultLegende(prev.length) }])
    } catch (e: any) {
      setError(`Erreur photo : ${e.message || 'compression impossible'}`)
    }
  }

  function updatePhotoLegende(i: number, legende: string) {
    setPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, legende } : p))
  }

  function removePhoto(i: number) {
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
  }

  function movePhoto(i: number, dir: -1 | 1) {
    setPhotos(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function handleExtract() {
    setError('')
    if (!technicienNom) { setError('Indique ton nom de technicien.'); return }
    if (!transcription || transcription.trim().length < 20) { setError('Dicte ou tape au moins quelques phrases sur l\'intervention.'); return }
    if (photos.length === 0) { setError('Ajoute au moins une photo.'); return }

    setStep('extracting')
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Extraction échouée')
      if (data.type_intervention) setTypeIntervention(data.type_intervention)
      if (data.ville) setVille(data.ville)
      if (data.code_postal) setCodePostal(data.code_postal)
      if (data.adresse) setAdresse(data.adresse)
      if (data.client_nom) setClientNom(data.client_nom)
      if (data.client_email) setClientEmail(data.client_email)
      if (data.warning) setError(`⚠ ${data.warning}`)
      setStep('validate')
    } catch (e: any) {
      setError(`Erreur extraction : ${e.message}`)
      setStep('capture')
    }
  }

  async function handleGenerate() {
    if (!transcription || !typeIntervention || !ville) {
      setError('Renseignez la dictée, le type et la ville.')
      return
    }
    setError(''); setStep('generating')
    ensureNotificationPermission()
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription, type_intervention: typeIntervention, ville, code_postal: codePostal }),
        signal: AbortSignal.timeout(180_000),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Génération échouée')
      setRapport(data.rapport); setSeo(data.seo)
      setStep('preview')
      notifyDone('Rapport prêt', `${typeIntervention} — ${ville}`)
    } catch (e: any) {
      const isTimeout = e?.name === 'TimeoutError' || /aborted|timeout/i.test(String(e?.message || ''))
      setError(isTimeout
        ? 'La génération a dépassé 3 minutes. Réessaie ou raccourcis la dictée.'
        : `Erreur IA : ${e.message}`)
      setStep('validate')
    }
  }

  async function handleSendToClient() {
    if (!clientEmail) { setError('Email client manquant.'); return }
    setEmailSending(true); setError('')
    try {
      const res = await fetch('/api/notify-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientEmail, clientNom, technicienNom, ville, dateIntervention }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur envoi')
      }
      setEmailSent(true)
    } catch (e: any) {
      setError(`Erreur envoi : ${e.message}`)
    } finally {
      setEmailSending(false)
    }
  }

  async function handlePublish() {
    setStep('publishing'); setError('')
    if (photos.length === 0) {
      setError('Au moins une photo est requise.'); setStep('preview'); return
    }
    const totalBytes = photos.reduce((sum, p) => sum + p.file.size, 0)
    if (totalBytes > 4 * 1024 * 1024) {
      setError(`Photos trop lourdes (${(totalBytes / 1024 / 1024).toFixed(1)} MB). Retire les plus grandes.`)
      setStep('preview'); return
    }
    const formData = new FormData()
    const escapeHtml = (s: string) => s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    const galleryHtml = photos.length > 1
      ? `<section class="content-block gallery-block"><h2>Photos de l'intervention</h2><p>Ces photos documentent les étapes clés sur site (avant, pendant, après).</p><div class="photo-grid">${photos.map((p, i) => `<figure class="photo-card"><img src="{PHOTO_${i + 1}_URL}" alt="${escapeHtml(p.legende || `Photo ${i + 1}`)}" loading="lazy"><figcaption>${escapeHtml(p.legende || `Photo ${i + 1}`)}</figcaption></figure>`).join('')}</div></section>`
      : ''
    const contentWithContainers = `${seo.resume_rich_snippet ? `<section class="content-block resume-block"><h2>Resume de l'intervention</h2><p>${escapeHtml(seo.resume_rich_snippet)}</p></section>` : ''}${seo.contenu_principal || ''}${galleryHtml}`
    formData.append('title', seo.titre_h1)
    formData.append('slug', seo.slug || '')
    formData.append('service_type', typeIntervention)
    formData.append('location', ville)
    formData.append('intervention_city', ville)
    formData.append('postal_code', codePostal)
    formData.append('intervention_date', dateIntervention)
    formData.append('description', seo.meta_description)
    formData.append('meta_keywords', (seo.meta_keywords || []).join(', '))
    formData.append('content', contentWithContainers)
    formData.append('faq_json', JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": seo.faq.map((f: any) => ({ "@type": "Question", "name": f.question, "acceptedAnswer": { "@type": "Answer", "text": f.reponse } })) }))
    formData.append('jsonld', JSON.stringify(seo.jsonld || {}))
    formData.append('related_services_json', JSON.stringify(seo.related_services || []))
    formData.append('is_published', 'true')
    formData.append('transcription', transcription || '')
    formData.append('rapport_json', JSON.stringify(rapport || {}))
    formData.append('seo_json', JSON.stringify(seo || {}))
    formData.append('client_nom', clientNom || '')
    formData.append('client_email', clientEmail || '')
    formData.append('client_adresse', `${adresse || ''} ${codePostal || ''} ${ville || ''}`.trim())
    formData.append('before_image', photos[0].file)
    formData.append('after_image', (photos[1] || photos[0]).file)
    photos.slice(2).forEach((p, i) => formData.append(`extra_image_${i}`, p.file))
    try {
      const res = await fetch('/api/publish', { method: 'POST', body: formData })
      const txt = await res.text()
      let data: any = null
      try { data = JSON.parse(txt) } catch {}
      if (!res.ok) {
        const msg = data ? (typeof data === 'string' ? data : (data.error || JSON.stringify(data))) : txt.slice(0, 300)
        throw new Error(msg)
      }
      const slug = data?.slug || seo?.slug || ''
      setPublishedSlug(slug)
      setTranscription('')
      setRapport(null); setSeo(null)
      setClientNom(''); setClientEmail(''); setAdresse(''); setVille(''); setCodePostal('')
      setPhotos([])
      setEmailSent(false)
      if (typeof window !== 'undefined') localStorage.removeItem('ltdb_draft')
      setStep('done')
    } catch (e: any) {
      setError(`Erreur publication : ${e.message}`)
      setStep('preview')
    }
  }

  function resetForm() {
    setStep('capture')
    setTranscription(''); setRapport(null); setSeo(null); setError('')
    setClientNom(''); setClientEmail(''); setAdresse(''); setVille(''); setCodePostal('')
    setPhotos([])
    setEmailSent(false); setPublishedSlug('')
    if (typeof window !== 'undefined') localStorage.removeItem('ltdb_draft')
  }

  const totalMb = photos.reduce((s, p) => s + p.file.size, 0) / 1024 / 1024
  const currentStepperIdx = getStepperIndex(step)

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* App tabs (rapport vs devis) */}
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-3xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>
      {/* Header */}
      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-3">
          <div>
            <div className="font-black text-base sm:text-lg leading-tight">LTDB</div>
            <div className="text-[11px] opacity-70">Nouvelle réalisation</div>
          </div>
          <div className="text-right flex items-center gap-2">
            {editTech ? (
              <input
                autoFocus
                value={technicienNom}
                onChange={e => setTechnicienNom(e.target.value)}
                onBlur={() => technicienNom && setEditTech(false)}
                onKeyDown={e => { if (e.key === 'Enter' && technicienNom) setEditTech(false) }}
                placeholder="Ton nom"
                className="bg-white/20 placeholder:text-white/60 text-white text-sm font-semibold px-3 py-1.5 rounded-lg outline-none border border-white/30 focus:border-white"
              />
            ) : technicienNom ? (
              <button onClick={() => setEditTech(true)} className="text-right group">
                <div className="text-[10px] opacity-60 group-hover:opacity-100">Technicien ✎</div>
                <div className="text-sm font-semibold">{technicienNom}</div>
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      {/* STEPPER */}
      <div className="bg-white border-b border-slate-200 shadow-sm sticky top-[52px] sm:top-[60px] z-20">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {STEPPER_STEPS.map((s, i) => {
              const isActive = i === currentStepperIdx
              const isDone = i < currentStepperIdx
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all ${
                      isDone ? 'bg-emerald-500 text-white shadow-md' :
                      isActive ? 'bg-[#0e2a52] text-white shadow-lg ring-4 ring-blue-100' :
                      'bg-slate-100 text-slate-400 border-2 border-slate-200'
                    }`}>
                      {isDone ? '✓' : s.icon}
                    </div>
                    <span className={`text-[10px] sm:text-xs mt-1 font-semibold text-center leading-tight ${
                      isActive ? 'text-[#0e2a52]' : isDone ? 'text-emerald-600' : 'text-slate-400'
                    }`}>{s.label}</span>
                  </div>
                  {i < STEPPER_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-all ${
                      i < currentStepperIdx ? 'bg-emerald-400' : 'bg-slate-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* ═══════════ ÉTAPE 1 — DICTÉE + PHOTOS ═══════════ */}
        {(step === 'capture' || step === 'extracting') && (
          <>
            {/* Dictée */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-xl font-black text-[#0e2a52]">Raconte l&apos;intervention</h2>
                <p className="text-sm text-slate-500 mt-1">Dicte ou tape : l&apos;IA remplira les champs.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <VoiceRecorder onTranscription={t => setTranscription(prev => prev ? prev + ' ' + t : t)} />
              </div>

              <textarea
                value={transcription}
                onChange={e => setTranscription(e.target.value)}
                rows={5}
                placeholder="Ex : Débouchage WC chez Mme Dupont à Toulon, 5 rue des Tombades. Colonne EU bouchée au 2e étage, furet électrique 15m…"
                className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>{transcription.length} car.</span>
                <span>{transcription.length < 50 ? 'Ajoute plus de détails' : '✓ OK'}</span>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-[#0e2a52]">Photos</h2>
                  <p className="text-sm text-slate-500">Avant / après — min. 1 photo</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#0e2a52] text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">{photos.length}</span>
                  {photos.length > 0 && <span className="text-[11px] text-slate-400">{totalMb.toFixed(1)} MB</span>}
                </div>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((p, i) => (
                    <PhotoItemCard
                      key={p.preview}
                      index={i}
                      photo={p}
                      isFirst={i === 0}
                      isLast={i === photos.length - 1}
                      onLegendeChange={lg => updatePhotoLegende(i, lg)}
                      onRemove={() => removePhoto(i)}
                      onMoveUp={() => movePhoto(i, -1)}
                      onMoveDown={() => movePhoto(i, 1)}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label htmlFor="add-cam" className="bg-[#0e2a52] text-white px-4 py-3.5 rounded-xl text-sm font-bold cursor-pointer active:scale-95 transition text-center">
                  📸 Prendre photo
                  <input id="add-cam" type="file" accept="image/*" capture="environment" onChange={e => { addPhoto(e.target.files?.[0] || null); (e.target as HTMLInputElement).value = '' }} className="hidden" />
                </label>
                <label htmlFor="add-gal" className="bg-white border-2 border-[#0e2a52] text-[#0e2a52] px-4 py-3.5 rounded-xl text-sm font-bold cursor-pointer active:scale-95 transition text-center">
                  🖼 Galerie
                  <input id="add-gal" type="file" accept="image/*" multiple onChange={async e => {
                    const files = Array.from(e.target.files || [])
                    for (const f of files) await addPhoto(f)
                    ;(e.target as HTMLInputElement).value = ''
                  }} className="hidden" />
                </label>
              </div>
            </div>

            {/* Loading extraction */}
            {step === 'extracting' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center space-y-3">
                <div className="text-4xl animate-pulse">✨</div>
                <p className="text-sm font-semibold text-blue-900">Lecture de ta dictée…</p>
                <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden max-w-xs mx-auto">
                  <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════ ÉTAPE 2 — VÉRIFICATION ═══════════ */}
        {(step === 'validate' || step === 'generating') && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
              <div>
                <h2 className="text-xl font-black text-[#0e2a52]">Vérifie les informations</h2>
                <p className="text-sm text-slate-500 mt-1">Pré-rempli par l&apos;IA. Corrige si besoin.</p>
              </div>

              {/* Type intervention */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type d&apos;intervention</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPES.map(t => (
                    <button key={t.v} type="button"
                      onClick={() => setTypeIntervention(t.v)}
                      className={`p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all ${
                        typeIntervention === t.v
                          ? 'border-blue-500 bg-blue-50 text-[#0e2a52] shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}>
                      <span className="text-lg mr-1">{t.icon}</span>
                      {t.v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ville */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ville *</label>
                <VilleCombobox value={ville} onSelect={(v: VilleVar) => { setVille(v.nom); setCodePostal(v.cp) }} onChange={setVille} />
              </div>

              {/* CP + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Code postal</label>
                  <input value={codePostal} onChange={e => setCodePostal(e.target.value)} placeholder="83000" inputMode="numeric" pattern="[0-9]*" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                  <input type="date" value={dateIntervention} onChange={e => setDateIntervention(e.target.value)} className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
              </div>

              {/* Adresse */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adresse <span className="font-normal text-slate-400 normal-case">(optionnel)</span></label>
                <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="ex: 5 rue des Tombades" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
              </div>
            </div>

            {/* Client */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Client (optionnel)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Nom</label>
                  <input value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="M. Dupont" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Email</label>
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@exemple.fr" inputMode="email" autoCapitalize="none" autoCorrect="off" className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors" />
                </div>
              </div>
            </div>

            {/* Loading génération */}
            {step === 'generating' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center space-y-3">
                <p className="text-sm font-bold text-blue-900">{GEN_STEPS[genStepIdx]}</p>
                <TruckLoader />
                <p className="text-[11px] text-slate-500">
                  Compte 30 à 90 secondes — tu peux laisser la page ouverte, on te notifie quand c'est prêt.
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══════════ ÉTAPE 3 — RAPPORT PRÊT ═══════════ */}
        {(step === 'preview' || step === 'publishing') && rapport && seo && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-xl font-black text-[#0e2a52]">Rapport prêt</h2>
              <p className="text-sm text-slate-500 mt-1">Vérifie, exporte ou publie.</p>
            </div>

            <GenerationPreview rapport={rapport} seo={seo} onRapportChange={setRapport} onSeoChange={setSeo} />

            {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>}

            {(() => {
              const pdfProps = {
                clientNom, adresse, ville, codePostal, dateIntervention, typeIntervention,
                technicienNom: technicienNom || session?.user?.name || 'Technicien',
                rapport,
                photos: photos.map(p => ({ url: p.dataUrl, legende: p.legende })),
              }
              const pdfFilename = `rapport-${(ville || 'intervention').toLowerCase()}-${dateIntervention}.pdf`
              return (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  {/* Aperçus */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowPdfPreview(true)} className="bg-slate-50 text-[#0e2a52] px-4 py-3 rounded-xl font-bold hover:bg-slate-100 active:scale-95 transition-all border-2 border-slate-200">
                      👁 Aperçu PDF
                    </button>
                    <button onClick={() => setShowSitePreview(true)} className="bg-slate-50 text-[#0e2a52] px-4 py-3 rounded-xl font-bold hover:bg-slate-100 active:scale-95 transition-all border-2 border-slate-200">
                      🌐 Aperçu page
                    </button>
                  </div>

                  {/* Export */}
                  <div className="grid grid-cols-2 gap-3">
                    <PDFDownloadButton {...pdfProps} />
                    <DriveSaveButton pdfProps={pdfProps} filename={pdfFilename} />
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={handleSendToClient}
                      disabled={emailSending || emailSent || !clientEmail}
                      className="bg-blue-600 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {emailSent ? '✓ Email envoyé' : emailSending ? 'Envoi…' : '✉ Envoyer au client'}
                    </button>
                    <button
                      onClick={handlePublish}
                      disabled={step === 'publishing'}
                      className="bg-emerald-600 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {step === 'publishing' ? 'Publication…' : '🌐 Publier sur le site'}
                    </button>
                  </div>

                  <PDFPreviewModal open={showPdfPreview} onClose={() => setShowPdfPreview(false)} pdfProps={pdfProps} />
                  <SitePreviewModal open={showSitePreview} onClose={() => setShowSitePreview(false)} seo={seo} ville={ville} photos={photos.map(p => ({ dataUrl: p.dataUrl, legende: p.legende }))} />
                </div>
              )
            })()}
          </div>
        )}

        {/* ═══════════ ÉTAPE 4 — TERMINÉ ═══════════ */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-3xl">🎉</div>
            <h2 className="text-2xl font-black text-emerald-700">Réalisation publiée !</h2>
            <p className="text-slate-600">La page est en ligne sur le site.</p>
            <a
              href={`https://lestechniciensdudebouchage.fr/nos-realisations/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[#0e2a52] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#1a3a6b] transition-colors"
            >
              Voir la page publiée →
            </a>
            <div className="pt-4">
              <button onClick={resetForm} className="text-blue-600 hover:underline font-bold">+ Nouvelle réalisation</button>
            </div>
          </div>
        )}
      </main>

      {/* ═══════════ BARRE D'ACTION BOTTOM ═══════════ */}
      {(['capture', 'validate'] as Step[]).includes(step) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-3 z-30">
          <div className="max-w-3xl mx-auto">
            {error && <div className="text-red-600 text-sm font-semibold mb-2 text-center">{error}</div>}
            <div className="flex gap-3">
              {step === 'capture' ? (
                <button onClick={() => {}} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                  Annuler
                </button>
              ) : (
                <button onClick={() => setStep('capture')} className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                  ← Retour
                </button>
              )}
              <button
                onClick={step === 'capture' ? handleExtract : handleGenerate}
                className="flex-[2] bg-[#0e2a52] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all disabled:opacity-60"
              >
                {step === 'capture' ? 'Suivant →' : '🚀 Générer le rapport'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(['preview', 'publishing'] as Step[]).includes(step) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-3 z-30">
          <div className="max-w-3xl mx-auto">
            <button onClick={() => setStep('validate')} className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all">
              ← Modifier les informations
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function VilleCombobox({ value, onChange, onSelect }: { value: string; onChange: (s: string) => void; onSelect: (v: VilleVar) => void }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const suggestions = value.trim().length >= 1 ? searchVilles(value, 8) : VILLES_VAR.slice(0, 8)
  const isExactMatch = !!findVilleByName(value)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(v: VilleVar) {
    onSelect(v)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter' && suggestions[highlight]) { e.preventDefault(); pick(suggestions[highlight]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Toulon, Hyères, Bandol…"
        autoComplete="off"
        className={`w-full border-2 ${isExactMatch ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'} focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-base transition-colors`}
      />
      {isExactMatch && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-lg">✓</span>}
      {open && suggestions.length > 0 && (
        <div className="absolute z-40 left-0 right-0 mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {suggestions.map((v, i) => (
            <button
              key={v.nom}
              type="button"
              onClick={() => pick(v)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-4 py-3 flex justify-between items-center border-b border-slate-100 last:border-b-0 transition ${
                i === highlight ? 'bg-blue-50 text-blue-700' : 'text-[#0e2a52] hover:bg-slate-50'
              }`}
            >
              <span className="font-semibold text-sm">{v.nom}</span>
              <span className="text-xs text-slate-500 font-mono">{v.cp}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type PhotoItemCardProps = {
  index: number
  photo: { preview: string; legende: string }
  isFirst: boolean
  isLast: boolean
  onLegendeChange: (s: string) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function PhotoItemCard({ index, photo, isFirst, isLast, onLegendeChange, onRemove, onMoveUp, onMoveDown }: PhotoItemCardProps) {
  return (
    <div className="bg-white border-2 border-slate-200 rounded-xl overflow-hidden">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.preview} alt={photo.legende} className="w-full h-36 object-cover" />
        <div className="absolute top-2 left-2 bg-[#0e2a52] text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow">
          {index + 1}
        </div>
        <button onClick={onRemove} type="button" aria-label="Supprimer"
          className="absolute top-2 right-2 bg-white/95 w-7 h-7 rounded-full text-red-600 font-bold shadow flex items-center justify-center text-sm">✕</button>
        <div className="absolute bottom-2 right-2 flex gap-1">
          {!isFirst && (
            <button onClick={onMoveUp} type="button" aria-label="Monter"
              className="bg-white/95 w-7 h-7 rounded-full text-[#0e2a52] font-bold shadow flex items-center justify-center text-sm">↑</button>
          )}
          {!isLast && (
            <button onClick={onMoveDown} type="button" aria-label="Descendre"
              className="bg-white/95 w-7 h-7 rounded-full text-[#0e2a52] font-bold shadow flex items-center justify-center text-sm">↓</button>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <input
          value={photo.legende}
          onChange={e => onLegendeChange(e.target.value)}
          placeholder={`Photo ${index + 1}`}
          className="w-full border border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm transition-colors"
        />
      </div>
    </div>
  )
}

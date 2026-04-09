'use client'
import { useState } from "react"
import { useSession } from "next-auth/react"
import VoiceRecorder from "@/components/VoiceRecorder"
import GenerationPreview from "@/components/GenerationPreview"
import dynamic from "next/dynamic"

// @react-pdf/renderer ne supporte pas SSR
const PDFDownloadButton = dynamic(() => import("@/components/RealisationPDF"), { ssr: false })

type Step = 'form' | 'generating' | 'preview' | 'publishing' | 'done'

export default function NouveauPage() {
  const { data: session } = useSession()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')

  // Champs de base
  const [transcription, setTranscription] = useState('')
  const [typeIntervention, setTypeIntervention] = useState('Débouchage')
  const [adresse, setAdresse] = useState('')
  const [ville, setVille] = useState('')
  const [codePostal, setCodePostal] = useState('')
  const [dateIntervention, setDateIntervention] = useState(new Date().toISOString().split('T')[0])
  const [clientNom, setClientNom] = useState('')
  const [beforeImage, setBeforeImage] = useState<File | null>(null)
  const [afterImage, setAfterImage] = useState<File | null>(null)

  // Résultats IA
  const [rapport, setRapport] = useState<any>(null)
  const [seo, setSeo] = useState<any>(null)

  // Résultat publication
  const [publishedSlug, setPublishedSlug] = useState('')

  async function handleGenerate() {
    if (!transcription || !typeIntervention || !ville) {
      setError('Remplissez au minimum : dictée/texte, type d\'intervention et ville.')
      return
    }
    setError('')
    setStep('generating')
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcription, type_intervention: typeIntervention, ville, code_postal: codePostal }),
      })
      if (!res.ok) throw new Error('Génération échouée')
      const { rapport: r, seo: s } = await res.json()
      setRapport(r)
      setSeo(s)
      setStep('preview')
    } catch (e) {
      setError('Erreur génération IA. Vérifiez ANTHROPIC_API_KEY.')
      setStep('form')
    }
  }

  async function handlePublish() {
    setStep('publishing')
    setError('')
    const formData = new FormData()
    formData.append('title', seo.titre_h1)
    formData.append('service_type', typeIntervention)
    formData.append('location', ville)
    formData.append('intervention_city', ville)
    formData.append('postal_code', codePostal)
    formData.append('intervention_date', dateIntervention)
    formData.append('description', seo.meta_description)
    formData.append('content', seo.contenu_principal)
    formData.append('faq_json', JSON.stringify({ "@type": "FAQPage", "mainEntity": seo.faq.map((f: any) => ({ "@type": "Question", "name": f.question, "acceptedAnswer": { "@type": "Answer", "text": f.reponse } })) }))
    formData.append('is_published', 'true')
    if (beforeImage) formData.append('before_image', beforeImage)
    if (afterImage) formData.append('after_image', afterImage)
    // before_image requis — si pas fourni, dupliquer after ou error
    if (!beforeImage && !afterImage) {
      setError('Au moins une photo est requise.')
      setStep('preview')
      return
    }
    if (!beforeImage && afterImage) formData.append('before_image', afterImage)

    try {
      const res = await fetch('/api/publish', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(JSON.stringify(data))
      setPublishedSlug(data.slug)
      setStep('done')
    } catch (e: any) {
      setError(`Erreur publication : ${e.message}`)
      setStep('preview')
    }
  }

  const TYPES = ['Débouchage', 'Hydrocurage', 'Inspection caméra', 'Débouchage WC', 'Chemisage', 'Débouchage évier', 'Débouchage douche']

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-800 text-white px-6 py-3 flex justify-between items-center">
        <h1 className="font-bold">LTDB — Nouvelle réalisation</h1>
        <span className="text-sm opacity-75">{session?.user?.name}</span>
      </nav>

      <main className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Étape 1 — Formulaire de base */}
        {(step === 'form' || step === 'generating') && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">1. Informations de l'intervention</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type d'intervention *</label>
                <select value={typeIntervention} onChange={e => setTypeIntervention(e.target.value)} className="w-full border rounded px-3 py-2">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={dateIntervention} onChange={e => setDateIntervention(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ville *</label>
                <input value={ville} onChange={e => setVille(e.target.value)} placeholder="ex: Toulon" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
                <input value={codePostal} onChange={e => setCodePostal(e.target.value)} placeholder="ex: 83000" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse (public)</label>
                <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="ex: Rue de la Paix" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom client (PDF privé)</label>
                <input value={clientNom} onChange={e => setClientNom(e.target.value)} placeholder="M. Dupont" className="w-full border rounded px-3 py-2" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo avant</label>
                <input type="file" accept="image/*" onChange={e => setBeforeImage(e.target.files?.[0] || null)} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo après</label>
                <input type="file" accept="image/*" onChange={e => setAfterImage(e.target.files?.[0] || null)} className="w-full border rounded px-3 py-2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dictée vocale ou texte libre *</label>
              <VoiceRecorder onTranscription={t => setTranscription(prev => prev ? prev + ' ' + t : t)} />
              <textarea
                value={transcription}
                onChange={e => setTranscription(e.target.value)}
                rows={5}
                placeholder="Décrivez l'intervention : problème constaté, travaux effectués, état final..."
                className="mt-2 w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={step === 'generating'}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50"
            >
              {step === 'generating' ? 'Génération IA en cours...' : 'Générer rapport + SEO'}
            </button>
          </div>
        )}

        {/* Étape 2 — Preview et édition */}
        {(step === 'preview' || step === 'publishing') && rapport && seo && (
          <div className="bg-white rounded-xl shadow p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">2. Vérification et publication</h2>
              <button onClick={() => setStep('form')} className="text-sm text-gray-500 hover:text-gray-700">Modifier</button>
            </div>

            <GenerationPreview
              rapport={rapport}
              seo={seo}
              onRapportChange={setRapport}
              onSeoChange={setSeo}
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 pt-4 border-t">
              <PDFDownloadButton
                clientNom={clientNom}
                adresse={adresse}
                ville={ville}
                codePostal={codePostal}
                dateIntervention={dateIntervention}
                typeIntervention={typeIntervention}
                technicienNom={session?.user?.name || 'Technicien'}
                rapport={rapport}
              />
              <button
                onClick={handlePublish}
                disabled={step === 'publishing'}
                className="flex-1 bg-green-700 text-white py-2 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-50"
              >
                {step === 'publishing' ? 'Publication...' : 'Publier sur le site'}
              </button>
            </div>
          </div>
        )}

        {/* Étape 3 — Succès */}
        {step === 'done' && (
          <div className="bg-white rounded-xl shadow p-8 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h2 className="text-2xl font-bold text-green-700">Réalisation publiée !</h2>
            <p className="text-gray-600">La page est maintenant en ligne.</p>
            <a
              href={`https://lestechniciensdudebouchage.fr/nos-realisations/${publishedSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800"
            >
              Voir la page publiée
            </a>
            <div className="pt-4">
              <button
                onClick={() => {
                  setStep('form'); setTranscription(''); setRapport(null); setSeo(null)
                  setClientNom(''); setAdresse(''); setVille(''); setCodePostal('')
                  setBeforeImage(null); setAfterImage(null)
                }}
                className="text-blue-700 hover:underline"
              >
                + Nouvelle réalisation
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

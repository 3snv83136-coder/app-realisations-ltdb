'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { AttestationData, AttestationObservation, Variante } from '@/components/AttestationPDF'
import { attestationVarianteFromType } from '@/lib/types-intervention'
import { splitNomPrenom } from '@/lib/rapportToDevis'
import { errorMessage } from '@/lib/error-message'
import VoiceRecorder from '@/components/VoiceRecorder'

const AttestationDownloadButton = dynamic(() => import('@/components/AttestationPDF'), { ssr: false })

type Client = {
  nom: string | null
  email: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
} | null

type Interv = {
  id: string
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_realisee: string | null
  date_prevue: string | null
  transcription?: string | null
  rapport_json: { diagnostic?: string; travaux_realises?: string; objet?: string } | null
  photos_urls: string[] | null
  photos_legendes: string[] | null
}

const VARIANT_LABELS: Record<Variante, string> = {
  'tout-a-legout': "Tout-à-l'égout",
  'fosse-septique': 'Fosse septique',
  'non-conforme': 'Non-conforme',
}

export default function StepAttestationConformite({
  interv,
  client,
  technicienNom,
  onDone,
  onSkip,
  onError,
}: {
  interv: Interv
  client: Client
  technicienNom?: string
  onDone: () => void | Promise<void>
  onSkip: () => void | Promise<void>
  onError: (e: string) => void
}) {
  const varianteDefaut = attestationVarianteFromType(interv.type_intervention) || 'tout-a-legout'
  const { prenom: prenomDefaut, nomFamille: nomDefaut } = splitNomPrenom(client?.nom || '')

  const [variante, setVariante] = useState<Variante>(varianteDefaut)
  const [nom, setNom] = useState(nomDefaut)
  const [prenom, setPrenom] = useState(prenomDefaut)
  const [adresse, setAdresse] = useState(interv.adresse_chantier || client?.adresse || '')
  const [codePostal, setCodePostal] = useState(interv.code_postal || client?.code_postal || '')
  const [ville, setVille] = useState(interv.ville || client?.ville || '')
  const [date, setDate] = useState(
    (interv.date_realisee || interv.date_prevue || new Date().toISOString().slice(0, 10)).slice(0, 10),
  )
  const seedTranscription = useMemo(() => {
    const parts = [
      interv.transcription,
      interv.rapport_json?.objet,
      interv.rapport_json?.diagnostic,
      interv.rapport_json?.travaux_realises,
    ].filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    return parts.join('\n\n')
  }, [interv])
  const [transcription, setTranscription] = useState(seedTranscription)
  const [data, setData] = useState<AttestationData | null>(null)
  const [phase, setPhase] = useState<'capture' | 'generating' | 'preview'>('capture')
  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)

  const photosForPdf = useMemo(() => {
    const urls = interv.photos_urls || []
    const legendes = interv.photos_legendes || []
    return urls.map((url, i) => ({ url, legende: legendes[i] || undefined }))
  }, [interv.photos_urls, interv.photos_legendes])

  async function generer() {
    if (transcription.trim().length < 15) {
      onError('Dictée trop courte — décris l’inspection, les constats et les conclusions.')
      return
    }
    setPhase('generating')
    onError('')
    try {
      const res = await fetch('/api/generate-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          variante,
          nom,
          prenom,
          adresse,
          code_postal: codePostal,
          ville,
          date,
          technicien_nom: technicienNom || '',
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Génération échouée')
      setData(result as AttestationData)
      setPhase('preview')
    } catch (e) {
      onError(`Erreur IA : ${errorMessage(e)}`)
      setPhase('capture')
    }
  }

  async function enregistrer() {
    if (!data) return
    setSaving(true)
    onError('')
    try {
      const res = await fetch('/api/save-attestation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attestation: data,
          clientNom: `${data.prenom || ''} ${data.nom || ''}`.trim(),
          clientEmail: client?.email || null,
          clientAdresse: data.adresse,
          clientCP: data.codePostal,
          ville: data.ville,
          numero: data.numero,
          variante: data.variante,
          dateAttestation: data.date,
          interventionId: interv.id,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Sauvegarde échouée')

      await fetch(`/api/interventions/${interv.id}/attestation-conformite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generated', document_id: result.id || null }),
      })

      await onDone()
    } catch (e) {
      onError(errorMessage(e) || 'Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function passer() {
    setSkipping(true)
    onError('')
    try {
      const res = await fetch(`/api/interventions/${interv.id}/attestation-conformite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Impossible de passer l’étape')
      await onSkip()
    } catch (e) {
      onError(errorMessage(e))
    } finally {
      setSkipping(false)
    }
  }

  function updateObservation(i: number, patch: Partial<AttestationObservation>) {
    if (!data) return
    const obs = [...data.observations]
    obs[i] = { ...obs[i], ...patch }
    setData({ ...data, observations: obs })
  }

  if (phase === 'generating') {
    return (
      <section className="space-y-4 text-center py-10">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-[#0f2e5c]" />
        <h1 className="text-xl font-black text-[#0f2e5c]">Rédaction de l&apos;attestation…</h1>
        <p className="text-sm text-slate-500">L&apos;IA structure objet, méthode, relevés et conclusion.</p>
      </section>
    )
  }

  if (phase === 'preview' && data) {
    return (
      <section className="space-y-4">
        <header className="text-center">
          <div className="text-4xl mb-1">📜</div>
          <h1 className="text-2xl font-black text-slate-800">Attestation prête</h1>
          <p className="text-sm text-slate-600 mt-1">
            {data.numero} · {VARIANT_LABELS[data.variante] || data.variante}
          </p>
        </header>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Objet</label>
          <textarea
            value={data.objet}
            onChange={e => setData({ ...data, objet: e.target.value })}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Conclusion</label>
          <textarea
            value={data.conclusion}
            onChange={e => setData({ ...data, conclusion: e.target.value })}
            rows={4}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Observations</p>
            {data.observations.map((obs, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={obs.label}
                  onChange={e => updateObservation(i, { label: e.target.value })}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                  placeholder="Label"
                />
                <input
                  value={obs.valeur}
                  onChange={e => updateObservation(i, { valeur: e.target.value })}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm"
                  placeholder="Valeur"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <AttestationDownloadButton data={data} photos={photosForPdf} />
          <button
            type="button"
            onClick={() => setPhase('capture')}
            className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
          >
            ← Modifier la dictée
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void enregistrer()}
          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-base hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.99] transition"
        >
          {saving ? 'Enregistrement…' : '✓ Enregistrer et continuer'}
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">📜</div>
        <h1 className="text-2xl font-black text-slate-800">Attestation de conformité</h1>
        <p className="text-sm text-slate-600 mt-2">
          Générer l&apos;attestation liée à cette intervention, ou passer si elle n&apos;est pas nécessaire.
        </p>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Type</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(Object.keys(VARIANT_LABELS) as Variante[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setVariante(key)}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold text-left transition ${
                variante === key
                  ? 'border-[#0f2e5c] bg-blue-50 text-[#0f2e5c]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {VARIANT_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Prénom" value={prenom} onChange={setPrenom} />
          <Field label="Nom" value={nom} onChange={setNom} />
        </div>
        <Field label="Adresse du bien" value={adresse} onChange={setAdresse} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code postal" value={codePostal} onChange={setCodePostal} />
          <Field label="Ville" value={ville} onChange={setVille} />
        </div>
        <Field label="Date d'inspection" value={date} onChange={setDate} type="date" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dictée / constats</p>
        <VoiceRecorder
          interventionId={interv.id}
          onTranscription={t => setTranscription(prev => (prev ? `${prev} ${t}` : t))}
        />
        <textarea
          value={transcription}
          onChange={e => setTranscription(e.target.value)}
          rows={8}
          placeholder="Décris l'inspection, les constats et les conclusions…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={() => void generer()}
        className="w-full bg-[#0f2e5c] text-white py-4 rounded-2xl font-black text-base hover:bg-[#163a6b] active:scale-[0.99] transition"
      >
        Générer l&apos;attestation
      </button>

      <button
        type="button"
        disabled={skipping}
        onClick={() => void passer()}
        className="w-full py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {skipping ? '…' : 'Passer sans attestation'}
      </button>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
      />
    </label>
  )
}

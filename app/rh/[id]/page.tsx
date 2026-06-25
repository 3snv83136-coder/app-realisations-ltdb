'use client'

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import AppTabs from "@/components/AppTabs"
import SalarieForm, { formToPayload, salarieToForm, type SalarieFormValues } from "@/components/rh/SalarieForm"
import { proxyImageUrl } from "@/lib/proxyImageUrl"
import type { RhDocumentGenereType, Salarie, SalarieDocument } from "@/lib/rh/types"
import { RH_DOCUMENT_LABELS, RH_SCAN_TYPES } from "@/lib/rh/types"

const DOC_TYPES: RhDocumentGenereType[] = [
  'cdi', 'cdd', 'due', 'fin_contrat', 'rupture_conventionnelle',
]

export default function RhSalariePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [values, setValues] = useState<SalarieFormValues | null>(null)
  const [documents, setDocuments] = useState<SalarieDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [scanType, setScanType] = useState('permis')

  const load = useCallback(async () => {
    setError('')
    const res = await fetch(`/api/rh/salaries/${params.id}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    setValues(salarieToForm(data.salarie as Salarie))
    setDocuments(data.documents || [])
  }, [params.id])

  useEffect(() => {
    load()
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [load])

  async function handleSave() {
    if (!values) return
    setSaving(true)
    setError('')
    setOk('')
    try {
      const res = await fetch(`/api/rh/salaries/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(values)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setValues(salarieToForm(data.salarie))
      setOk('Dossier enregistré.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', scanType)
      const res = await fetch(`/api/rh/salaries/${params.id}/documents`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await load()
      setOk('Document ajouté.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleGeneratePdf(type: RhDocumentGenereType) {
    setGenerating(type)
    setError('')
    try {
      const res = await fetch(`/api/rh/salaries/${params.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, lieuSignature: values?.ville || 'Toulon' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rh-${type}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setOk(`${RH_DOCUMENT_LABELS[type]} généré.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setGenerating(null)
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer définitivement ce dossier salarié ?')) return
    const res = await fetch(`/api/rh/salaries/${params.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Suppression impossible')
      return
    }
    router.push('/rh')
  }

  if (loading || !values) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Chargement…</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
      </div>

      <header className="bg-[#0e2a52] text-white px-4 py-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/rh" className="text-sm text-white/70 hover:text-white">← RH</Link>
            <h1 className="text-xl font-black mt-1">{values.prenom} {values.nom}</h1>
            <p className="text-sm text-white/70">{values.poste || 'Dossier salarié'}</p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs font-bold text-red-200 hover:text-white border border-red-300/40 px-3 py-2 rounded-lg"
          >
            Supprimer
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {error && <p className="text-red-600 text-sm font-semibold bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
        {ok && <p className="text-emerald-700 text-sm font-semibold bg-emerald-50 border border-emerald-200 rounded-xl p-3">{ok}</p>}

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold text-[#0e2a52] mb-4">Informations salarié</h2>
          <SalarieForm values={values} onChange={patch => setValues(v => v ? { ...v, ...patch } : v)} />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-5 w-full bg-[#0e2a52] text-white font-bold rounded-xl py-3 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-bold text-[#0e2a52]">Scans (permis, mutuelle…)</h2>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-sm">
              <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Type</span>
              <select
                value={scanType}
                onChange={e => setScanType(e.target.value)}
                className="border-2 border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {RH_SCAN_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 min-w-[200px] text-sm">
              <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Fichier</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                disabled={uploading}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) void handleUpload(f)
                  e.target.value = ''
                }}
                className="w-full text-sm"
              />
            </label>
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun scan enregistré.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.map(doc => (
                <li key={doc.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <a href={proxyImageUrl(doc.url)} target="_blank" rel="noopener noreferrer" className="block">
                    {/\.(jpg|jpeg|png|webp|gif)/i.test(doc.url) ? (
                      <img src={proxyImageUrl(doc.url)} alt={doc.type} className="w-full h-36 object-cover bg-slate-100" />
                    ) : (
                      <div className="h-36 flex items-center justify-center bg-slate-100 text-slate-500 text-sm">📄 {doc.filename || 'Document'}</div>
                    )}
                  </a>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-600 capitalize">{doc.type}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <h2 className="font-bold text-[#0e2a52]">Documents RH à générer</h2>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            Gabarits standards pré-remplis — validation juridique recommandée avant envoi ou signature.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DOC_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => void handleGeneratePdf(type)}
                disabled={!!generating}
                className="text-left border-2 border-slate-200 hover:border-[#0e2a52] rounded-xl px-4 py-3 text-sm font-bold text-[#0e2a52] disabled:opacity-50 transition"
              >
                {generating === type ? 'Génération…' : `📄 ${RH_DOCUMENT_LABELS[type]}`}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

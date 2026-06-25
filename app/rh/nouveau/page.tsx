'use client'

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import AppTabs from "@/components/AppTabs"
import SalarieForm, { emptySalarieForm, formToPayload } from "@/components/rh/SalarieForm"

export default function RhNouveauPage() {
  const router = useRouter()
  const [values, setValues] = useState(emptySalarieForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!values.nom.trim() || !values.prenom.trim()) {
      setError('Nom et prénom obligatoires.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/rh/salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formToPayload(values)),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      router.push(`/rh/${data.salarie.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
      </div>

      <header className="bg-[#0e2a52] text-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/rh" className="text-sm text-white/70 hover:text-white">← RH</Link>
          <h1 className="text-xl font-black mt-1">Nouveau salarié</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <SalarieForm values={values} onChange={patch => setValues(v => ({ ...v, ...patch }))} />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#0e2a52] text-white font-bold rounded-xl py-3 disabled:opacity-50"
        >
          {saving ? 'Création…' : 'Créer le dossier'}
        </button>
      </main>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import AppTabs from "@/components/AppTabs"
import { proxyImageUrl } from "@/lib/proxyImageUrl"

type Technicien = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  agence: string | null
  actif: boolean
  photo_url: string | null
  annees_experience: number | null
  titre_metier: string | null
}

function TechnicienCard({
  tech,
  onUpdated,
}: {
  tech: Technicien
  onUpdated: (t: Technicien) => void
}) {
  const [titre, setTitre] = useState(tech.titre_metier || 'technicien déboucheur')
  const [annees, setAnnees] = useState(tech.annees_experience?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitre(tech.titre_metier || 'technicien déboucheur')
    setAnnees(tech.annees_experience?.toString() || '')
  }, [tech])

  async function saveProfile() {
    setSaving(true)
    setError('')
    setOk('')
    try {
      const res = await fetch('/api/techniciens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tech.id,
          titre_metier: titre.trim() || 'technicien déboucheur',
          annees_experience: annees.trim() ? Number(annees) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onUpdated(data.technicien)
      setOk('Profil enregistré')
      setTimeout(() => setOk(''), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handlePhoto(file: File | null) {
    if (!file) return
    setUploading(true)
    setError('')
    setOk('')
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const res = await fetch(`/api/techniciens/${tech.id}/photo`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onUpdated(data.technicien)
      setOk('Photo mise à jour')
      setTimeout(() => setOk(''), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const previewPhrase = annees.trim()
    ? `${titre.trim() || 'technicien déboucheur'} dans le Var depuis ${annees} an${Number(annees) > 1 ? 's' : ''}`
    : `${titre.trim() || 'technicien déboucheur'} sur le Var`

  return (
    <article className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm">
      <div className="flex flex-col sm:flex-row gap-5 p-5">
        <div className="flex flex-col items-center gap-3 shrink-0">
          {tech.photo_url ? (
            <img
              src={proxyImageUrl(tech.photo_url)}
              alt={tech.nom}
              className="w-28 h-28 rounded-full object-cover border-4 border-[#e67e22] shadow-md"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-[#0e2a52] text-white flex items-center justify-center text-4xl font-black border-4 border-slate-200">
              {tech.nom.charAt(0).toUpperCase()}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { void handlePhoto(e.target.files?.[0] || null) }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-50"
          >
            {uploading ? 'Envoi…' : tech.photo_url ? 'Changer la photo' : 'Ajouter une photo'}
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <h2 className="text-xl font-black text-slate-800">{tech.nom}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {[tech.agence, tech.telephone, tech.email].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Titre métier</span>
              <input
                value={titre}
                onChange={e => setTitre(e.target.value)}
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="technicien déboucheur"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Années d&apos;expérience</span>
              <input
                type="number"
                min={0}
                max={50}
                value={annees}
                onChange={e => setAnnees(e.target.value)}
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="ex. 8"
              />
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
            <div className="text-[10px] uppercase font-bold text-blue-700 mb-1">Aperçu page réalisation</div>
            <p>
              Intervention réalisée par <strong>{tech.nom}</strong>, {previewPhrase}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { void saveProfile() }}
              disabled={saving}
              className="bg-[#0e2a52] hover:bg-[#1a3a6b] text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 transition"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
            </button>
            {ok && <span className="text-sm font-bold text-emerald-600">✓ {ok}</span>}
            {error && <span className="text-sm font-bold text-red-600">⚠ {error}</span>}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function TechniciensPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [techniciens, setTechniciens] = useState<Technicien[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }
    if (!isAdmin) {
      setLoading(false)
      return
    }
    fetch('/api/techniciens?all=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setTechniciens(d.techniciens || [])
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [status, isAdmin, router])

  function handleUpdated(updated: Technicien) {
    setTechniciens(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t)))
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
      </div>

      <header className="bg-[#0e2a52] text-white px-4 py-5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-black">Techniciens — profils site</h1>
          <p className="text-sm text-white/70 mt-1">
            Photo, expérience et titre affichés sur les pages réalisations (E-E-A-T)
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {!isAdmin && status !== 'loading' && (
          <div className="bg-amber-50 border-2 border-amber-200 text-amber-900 p-4 rounded-xl text-sm">
            Accès réservé à l&apos;administrateur.{' '}
            <Link href="/planning" className="font-bold underline">Retour planning</Link>
          </div>
        )}

        {loading && <p className="text-slate-500 text-sm">Chargement…</p>}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 p-4 rounded-xl text-sm font-semibold">
            ⚠ {error}
          </div>
        )}

        {!loading && isAdmin && techniciens.length === 0 && !error && (
          <p className="text-slate-500 text-sm italic">Aucun technicien en base.</p>
        )}

        {isAdmin && techniciens.map(tech => (
          <TechnicienCard key={tech.id} tech={tech} onUpdated={handleUpdated} />
        ))}

        {isAdmin && (
          <p className="text-xs text-slate-400 pt-2">
            Ces informations apparaissent sur{' '}
            <a
              href="https://lestechniciensdudebouchage.fr/nos-realisations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              lestechniciensdudebouchage.fr/nos-realisations
            </a>{' '}
            à chaque publication d&apos;intervention.
          </p>
        )}
      </main>
    </div>
  )
}

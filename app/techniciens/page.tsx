'use client'

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import AppTabs from "@/components/AppTabs"
import { proxyImageUrl } from "@/lib/proxyImageUrl"
import { AGENCES } from "@/lib/agences"

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

function AddTechnicienForm({ onAdded }: { onAdded: (t: Technicien) => void }) {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [agence, setAgence] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/techniciens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: nom.trim(),
          email: email.trim() || null,
          telephone: telephone.trim() || null,
          agence: agence || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onAdded(data.technicien as Technicien)
      setNom('')
      setEmail('')
      setTelephone('')
      setAgence('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm space-y-4">
      <h2 className="text-lg font-black text-slate-800">+ Ajouter un technicien</h2>
      <form onSubmit={e => { void handleSubmit(e) }} className="grid sm:grid-cols-2 gap-3">
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom *</span>
          <input
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Jean Dupont"
            className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jean@ltdb.fr"
            className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Téléphone</span>
          <input
            type="tel"
            value={telephone}
            onChange={e => setTelephone(e.target.value)}
            placeholder="06 12 34 56 78"
            className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Agence</span>
          <select
            value={agence}
            onChange={e => setAgence(e.target.value)}
            className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option value="">— Aucune —</option>
            {AGENCES.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        {error && <p className="sm:col-span-2 text-sm font-semibold text-red-600">⚠ {error}</p>}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 transition"
          >
            {busy ? 'Ajout…' : '+ Ajouter'}
          </button>
        </div>
      </form>
    </section>
  )
}

function TechnicienCard({
  tech,
  onUpdated,
  onRemoved,
}: {
  tech: Technicien
  onUpdated: (t: Technicien) => void
  onRemoved: (id: string) => void
}) {
  const [nom, setNom] = useState(tech.nom)
  const [email, setEmail] = useState(tech.email || '')
  const [telephone, setTelephone] = useState(tech.telephone || '')
  const [agence, setAgence] = useState(tech.agence || '')
  const [titre, setTitre] = useState(tech.titre_metier || 'technicien déboucheur')
  const [annees, setAnnees] = useState(tech.annees_experience?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNom(tech.nom)
    setEmail(tech.email || '')
    setTelephone(tech.telephone || '')
    setAgence(tech.agence || '')
    setTitre(tech.titre_metier || 'technicien déboucheur')
    setAnnees(tech.annees_experience?.toString() || '')
  }, [tech])

  async function saveAll() {
    if (!nom.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    setSaving(true)
    setError('')
    setOk('')
    try {
      const res = await fetch('/api/techniciens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tech.id,
          nom: nom.trim(),
          email: email.trim() || null,
          telephone: telephone.trim() || null,
          agence: agence || null,
          titre_metier: titre.trim() || 'technicien déboucheur',
          annees_experience: annees.trim() ? Number(annees) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onUpdated(data.technicien)
      setOk('Fiche enregistrée')
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
      onUpdated({ ...tech, ...data.technicien })
      setOk('Photo mise à jour')
      setTimeout(() => setOk(''), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removePhoto() {
    if (!tech.photo_url) return
    if (!window.confirm('Supprimer la photo de ce technicien ?')) return
    setUploading(true)
    setError('')
    try {
      const res = await fetch(`/api/techniciens/${tech.id}/photo`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onUpdated({ ...tech, ...data.technicien, photo_url: null })
      setOk('Photo supprimée')
      setTimeout(() => setOk(''), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function toggleActif() {
    const label = tech.actif ? 'désactiver' : 'réactiver'
    if (!window.confirm(`${tech.actif ? 'Désactiver' : 'Réactiver'} ${tech.nom} ?${tech.actif ? ' Il n\'apparaîtra plus dans le planning.' : ''}`)) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/techniciens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tech.id, actif: !tech.actif }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onUpdated(data.technicien)
      if (!data.technicien.actif) onRemoved(tech.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const previewPhrase = annees.trim()
    ? `${titre.trim() || 'technicien déboucheur'} dans le Var depuis ${annees} an${Number(annees) > 1 ? 's' : ''}`
    : `${titre.trim() || 'technicien déboucheur'} sur le Var`

  return (
    <article className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm ${tech.actif ? 'border-slate-200' : 'border-slate-300 opacity-75'}`}>
      <div className="flex flex-col sm:flex-row gap-5 p-5">
        <div className="flex flex-col items-center gap-2 shrink-0">
          {tech.photo_url ? (
            <img
              src={proxyImageUrl(tech.photo_url)}
              alt={nom}
              className="w-28 h-28 rounded-full object-cover border-4 border-[#e67e22] shadow-md"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-[#0e2a52] text-white flex items-center justify-center text-4xl font-black border-4 border-slate-200">
              {(nom || tech.nom).charAt(0).toUpperCase()}
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
          {tech.photo_url && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => { void removePhoto() }}
              className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
            >
              Supprimer la photo
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tech.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                {tech.actif ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom *</span>
              <input
                value={nom}
                onChange={e => setNom(e.target.value)}
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jean@ltdb.fr"
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Téléphone</span>
              <input
                type="tel"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Agence</span>
              <select
                value={agence}
                onChange={e => setAgence(e.target.value)}
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
              >
                <option value="">— Aucune —</option>
                {AGENCES.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Titre métier (site)</span>
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
              Intervention réalisée par <strong>{nom.trim() || tech.nom}</strong>, {previewPhrase}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { void saveAll() }}
              disabled={saving}
              className="bg-[#0e2a52] hover:bg-[#1a3a6b] text-white font-bold px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 transition"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => { void toggleActif() }}
              disabled={saving}
              className={`font-bold px-4 py-2.5 rounded-xl text-sm border-2 transition disabled:opacity-50 ${
                tech.actif
                  ? 'border-red-200 text-red-700 hover:bg-red-50'
                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {tech.actif ? 'Retirer du planning' : 'Réactiver'}
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
  const [showInactifs, setShowInactifs] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isAdmin = session?.user?.role === 'admin'

  function loadList() {
    setLoading(true)
    setError('')
    fetch('/api/techniciens?all=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setTechniciens(d.techniciens || [])
      })
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

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
    loadList()
  }, [status, isAdmin, router])

  function handleUpdated(updated: Technicien) {
    setTechniciens(prev => prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t)))
  }

  function handleAdded(t: Technicien) {
    setTechniciens(prev => [...prev, t].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
  }

  function handleRemoved(id: string) {
    if (showInactifs) {
      setTechniciens(prev => prev.map(t => (t.id === id ? { ...t, actif: false } : t)))
    } else {
      setTechniciens(prev => prev.filter(t => t.id !== id))
    }
  }

  const visible = techniciens.filter(t => showInactifs || t.actif)
  const inactifCount = techniciens.filter(t => !t.actif).length

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
      </div>

      <header className="bg-[#0e2a52] text-white px-4 py-5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-black">Techniciens</h1>
          <p className="text-sm text-white/70 mt-1">
            Gestion des fiches : contact, photo, profil site et planning
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

        {isAdmin && <AddTechnicienForm onAdded={handleAdded} />}

        {inactifCount > 0 && isAdmin && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactifs}
              onChange={e => setShowInactifs(e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            Afficher les techniciens inactifs ({inactifCount})
          </label>
        )}

        {loading && <p className="text-slate-500 text-sm">Chargement…</p>}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 p-4 rounded-xl text-sm font-semibold">
            ⚠ {error}
          </div>
        )}

        {!loading && isAdmin && visible.length === 0 && !error && (
          <p className="text-slate-500 text-sm italic">Aucun technicien actif.</p>
        )}

        {isAdmin && visible.map(tech => (
          <TechnicienCard
            key={tech.id}
            tech={tech}
            onUpdated={handleUpdated}
            onRemoved={handleRemoved}
          />
        ))}
      </main>
    </div>
  )
}

'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppTabs from '@/components/AppTabs'
import { errorMessage } from '@/lib/error-message'
import type { AdminDocKind, AdminDocMeta } from '@/lib/admin-documents'

type DocsState = { kbis: AdminDocMeta | null; rib: AdminDocMeta | null }

function fmtDate(iso?: string) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<DocsState>({ kbis: null, rib: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState<AdminDocKind | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/documents', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDocs({ kbis: data.kbis || null, rib: data.rib || null })
    } catch (e) {
      setError(errorMessage(e) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleUpload(kind: AdminDocKind, file: File | null) {
    if (!file) return
    setBusy(kind)
    setError('')
    setInfo('')
    try {
      const fd = new FormData()
      fd.append('kind', kind)
      fd.append('file', file)
      const res = await fetch('/api/admin/documents', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInfo(`${kind === 'kbis' ? 'Kbis' : 'RIB'} enregistré.`)
      await load()
    } catch (e) {
      setError(errorMessage(e) || 'Upload échoué')
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(kind: AdminDocKind) {
    const label = kind === 'kbis' ? 'Kbis' : 'RIB'
    if (!confirm(`Supprimer le ${label} stocké ?`)) return
    setBusy(kind)
    setError('')
    setInfo('')
    try {
      const res = await fetch('/api/admin/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setInfo(`${label} supprimé.`)
      await load()
    } catch (e) {
      setError(errorMessage(e) || 'Suppression échouée')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-3xl mx-auto px-4">
          <AppTabs />
        </div>
      </div>

      <nav className="bg-white border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <Link href="/" className="text-xs font-bold text-blue-800 underline">← Accueil</Link>
            <h1 className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 mt-1">
              Documents administratifs
            </h1>
            <p className="text-[11px] text-slate-500">Kbis &amp; RIB — accessibles et joignables aux factures</p>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-sm">
          Dépose ici ton <strong>Kbis</strong> et ton <strong>RIB</strong> (PDF ou image).
          À l’envoi d’une facture, tu pourras cocher pour les joindre au mail client.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {info && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{info}</div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
            Chargement…
          </div>
        ) : (
          <div className="space-y-4">
            <DocCard
              kind="kbis"
              title="Extrait Kbis"
              hint="Extrait Kbis à jour (PDF recommandé)"
              doc={docs.kbis}
              busy={busy === 'kbis'}
              onUpload={f => handleUpload('kbis', f)}
              onDelete={() => handleDelete('kbis')}
            />
            <DocCard
              kind="rib"
              title="RIB"
              hint="Relevé d’identité bancaire (PDF ou photo nette)"
              doc={docs.rib}
              busy={busy === 'rib'}
              onUpload={f => handleUpload('rib', f)}
              onDelete={() => handleDelete('rib')}
            />
          </div>
        )}
      </main>
    </div>
  )
}

function DocCard({
  kind, title, hint, doc, busy, onUpload, onDelete,
}: {
  kind: AdminDocKind
  title: string
  hint: string
  doc: AdminDocMeta | null
  busy: boolean
  onUpload: (file: File | null) => void
  onDelete: () => void
}) {
  const inputId = `upload-${kind}`
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-[#0e2a52] text-base">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${
          doc ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
        }`}>
          {doc ? 'Disponible' : 'Absent'}
        </span>
      </div>

      {doc ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-2">
          <div className="text-sm font-semibold text-slate-800 truncate">{doc.filename}</div>
          {doc.uploadedAt && (
            <div className="text-[11px] text-slate-500">Mis à jour le {fmtDate(doc.uploadedAt)}</div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#0e2a52] text-white text-xs font-bold hover:bg-[#0a1f3d]"
            >
              Ouvrir / télécharger
            </a>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Aucun fichier enregistré pour le moment.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          disabled={busy}
          onChange={e => {
            const f = e.target.files?.[0] || null
            e.target.value = ''
            onUpload(f)
          }}
        />
        <label
          htmlFor={inputId}
          className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition ${
            busy
              ? 'bg-slate-200 text-slate-500 cursor-wait'
              : 'bg-amber-500 hover:bg-amber-600 text-white'
          }`}
        >
          {busy ? 'Envoi…' : doc ? 'Remplacer le fichier' : 'Déposer un fichier'}
        </label>
        <span className="text-[11px] text-slate-400">PDF, JPG, PNG · max 12 Mo</span>
      </div>
    </section>
  )
}

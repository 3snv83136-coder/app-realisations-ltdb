'use client'

import { useState } from 'react'

type NetworkResult = {
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok'
  ok: boolean
  url?: string
  error?: string
}

const LABELS: Record<NetworkResult['platform'], string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
}

export default function ArticleSocialContainer({
  title,
  meta,
  disabled,
}: {
  title: string
  meta: string
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [results, setResults] = useState<NetworkResult[]>([])

  async function postOne() {
    setBusy(true)
    setNote('')
    setResults([])
    try {
      const res = await fetch('/api/articles/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, meta }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNote(data.error || 'Diffusion impossible')
        return
      }
      setResults(Array.isArray(data.results) ? data.results : [])
      const failed = (data.results || []).filter((item: NetworkResult) => !item.ok).length
      setNote(failed === 0
        ? 'Article envoyé sur les quatre réseaux. Le site n’a pas été modifié.'
        : 'Envoi terminé. Les réseaux en erreur restent à connecter ou à réessayer. Le site n’a pas été modifié.')
    } catch {
      setNote('Le serveur n’a pas répondu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
      <h3 className="font-bold text-[#0e2a52]">Conteneur de diffusion</h3>
      <p className="mt-1 text-sm text-slate-700">
        Un clic envoie seulement l’article ouvert sur Facebook, LinkedIn, Instagram et TikTok.
        Les 20 brouillons ne sont pas publiés sur lestechniciensdudebouchage.fr.
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <a className="underline" href="/api/oauth/facebook">Connecter Facebook et Instagram</a>
        <a className="underline" href="/api/oauth/linkedin">Connecter LinkedIn</a>
        <a className="underline" href="/api/oauth/tiktok">Connecter TikTok</a>
      </div>
      <button
        type="button"
        disabled={disabled || busy || !title.trim() || !meta.trim()}
        onClick={() => { void postOne() }}
        className="mt-4 rounded-lg bg-[#0e2a52] px-4 py-3 text-white disabled:opacity-50"
      >
        {busy ? 'Envoi en cours…' : 'Poster cet article en un clic'}
      </button>
      {note && <p role="status" className="mt-3 text-sm text-slate-700">{note}</p>}
      {results.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {results.map(item => (
            <li key={item.platform}>
              <strong>{LABELS[item.platform]} :</strong>{' '}
              {item.ok
                ? <a className="underline" href={item.url} target="_blank" rel="noopener noreferrer">publié</a>
                : <span>{item.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

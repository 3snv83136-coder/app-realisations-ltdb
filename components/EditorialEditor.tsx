'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import seed from '@/lib/editorial-seed.json'

type Draft = (typeof seed)[number]
const KEY = 'ltdb-editorial-drafts-v2'
const fields = [
  ['title', 'Titre de la page'], ['keyword', 'Mot-clé principal'],
  ['secondary', 'Mots-clés secondaires'], ['seoTitle', 'Title SEO'],
  ['meta', 'Méta-description'], ['body', 'Contenu (titres précédés de ##)'],
  ['sourceNotes', 'Faits et sources à vérifier'],
] as const

function photoStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ltdb-editorial-photos-v1', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('photos')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function photoRead(id: string): Promise<Blob | null> {
  const db = await photoStore()
  try { return await new Promise((resolve, reject) => {
    const req = db.transaction('photos').objectStore('photos').get(id)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  }) } finally { db.close() }
}
async function photoWrite(id: string, blob: Blob) {
  const db = await photoStore()
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite')
    tx.objectStore('photos').put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  }) } finally { db.close() }
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function EditorialEditor() {
  const [drafts, setDrafts] = useState<Draft[]>(seed)
  const [selected, setSelected] = useState(seed[0].id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Tous')
  const [ready, setReady] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [photo, setPhoto] = useState('')
  const [busy, setBusy] = useState(false)
  const article = drafts.find(a => a.id === selected)!

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const saved: unknown = JSON.parse(raw)
        if (Array.isArray(saved) && saved.length === seed.length && seed.every(a => saved.some(s => s?.id === a.id && typeof s.body === 'string'))) setDrafts(saved as Draft[])
        else setMessage('Sauvegarde locale non reconnue. Les brouillons initiaux sont affichés.')
      }
    } catch { setMessage('Le stockage du navigateur est indisponible. Exporte tes modifications pour les conserver.') }
    setReady(true)
  }, [])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    let alive = true, objectUrl = ''
    setPhoto('')
    photoRead(selected).then(blob => {
      if (blob && alive) { objectUrl = URL.createObjectURL(blob); setPhoto(objectUrl) }
    }).catch(() => { if (alive) setMessage('Le stockage des photos est indisponible dans ce navigateur.') })
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selected, article.photoName])

  function persist(next: Draft[]) {
    setDrafts(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)); setDirty(false); setMessage('Enregistré dans ce navigateur.') }
    catch { setDirty(true); setMessage('Enregistrement impossible. Exporte les fiches pour conserver le travail.') }
  }
  function edit(field: keyof Draft, value: string) {
    setDrafts(prev => prev.map(a => a.id === selected ? { ...a, [field]: value, status: 'Brouillon', updatedAt: new Date().toISOString() } : a))
    setDirty(true)
  }
  async function upload(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) { setMessage('Choisis une image de moins de 20 Mo.'); return }
    const id = selected
    setBusy(true)
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Conversion impossible')), 'image/jpeg', .8))
      await photoWrite(id, blob)
      const next = drafts.map(a => a.id === id ? { ...a, photoName: file.name, status: 'Brouillon', updatedAt: new Date().toISOString() } : a)
      persist(next)
    } catch { setMessage('Photo non enregistrée. Essaie un fichier JPEG ou PNG.') }
    finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="bg-[#0e2a52] text-white px-5 py-5"><div className="max-w-7xl mx-auto flex flex-wrap justify-between gap-4"><div><Link href="/" className="text-sm underline">← Accueil LTDB</Link><h1 className="text-2xl font-bold mt-2">Articles SEO · rédaction et validation</h1></div><a href="https://ltdb-growth-dashboard.alikeglint.chatgpt.site" target="_blank" rel="noopener noreferrer" className="underline self-center">Ouvrir le Growth Dashboard</a></div></header>
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm mb-5">20 brouillons d’intervention · un article tous les deux jours dès le 10 novembre 2026. Chaque texte répond à une recherche réelle et se termine par un appel dans le Var. Aucun mode d’emploi pour déboucher soi-même. Le jeton {'{TEL_PRINCIPAL}'} sera remplacé par le numéro de la base à la publication. Les textes restent dans ce navigateur tant qu’ils ne sont pas validés. La validation ne met aucun article en ligne.</p>
      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <aside className="space-y-3"><label className="block text-sm">Rechercher<input value={query} onChange={e => setQuery(e.target.value)} className="border rounded-lg p-3 w-full bg-white" /></label><label className="block text-sm">Statut<select className="border rounded-lg p-3 w-full bg-white" value={filter} onChange={e => setFilter(e.target.value)}><option>Tous</option><option>Brouillon</option><option>Validé</option></select></label>
          <p className="text-sm text-slate-600">{drafts.filter(a => a.status === 'Validé').length} / 20 validés</p>
          <div className="max-h-[65vh] overflow-auto space-y-2">{drafts.filter(a => (filter === 'Tous' || a.status === filter) && a.title.toLowerCase().includes(query.toLowerCase())).map(a => <button key={a.id} disabled={busy} onClick={() => { if (dirty) { setMessage('Enregistre les modifications avant de changer d’article.'); return } setSelected(a.id) }} className={`w-full text-left rounded-xl p-3 border bg-white ${a.id === selected ? 'border-cyan-600 ring-1 ring-cyan-600' : 'border-slate-200'}`}><strong className="text-sm block">{a.title}</strong><span className="text-xs text-slate-500">{a.scheduled} · {a.status}</span></button>)}</div>
          <button disabled={!ready} className="rounded-lg border p-3 w-full bg-white" onClick={() => download('ltdb-articles.json', JSON.stringify(drafts, null, 2))}>Exporter les 20 fiches (hors photos)</button>
        </aside>
        <section className="bg-white border rounded-xl p-4 md:p-6"><div className="flex justify-between gap-3 mb-5"><h2 className="font-bold">{article.title}</h2><span className="text-sm whitespace-nowrap">{article.status}</span></div>
          {!ready ? <p>Chargement…</p> : <><div className="grid gap-4">{fields.map(([field, label]) => <label key={field} className="block text-sm font-semibold">{label}{['body', 'meta', 'sourceNotes'].includes(field) ? <textarea className="block w-full border rounded-lg p-3 mt-1 font-normal" rows={field === 'body' ? 20 : 3} value={article[field]} onChange={e => edit(field, e.target.value)} /> : <input className="block w-full border rounded-lg p-3 mt-1 font-normal" value={article[field]} onChange={e => edit(field, e.target.value)} />}</label>)}
          <label className="text-sm font-semibold">Photo de ton appareil<input type="file" accept="image/*" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} className="block mt-2" /><span className="text-xs text-slate-500">{article.photoName || article.photoHint}</span></label>
          {photo && <div><img src={photo} alt={article.title} className="max-h-64 rounded-lg object-contain" /><a href={photo} download={article.id + '.jpg'} className="text-sm underline">Télécharger la photo associée</a></div>}
          </div><div className="flex flex-wrap gap-3 mt-6"><button disabled={busy} onClick={() => persist(drafts)} className="bg-[#0e2a52] text-white rounded-lg px-4 py-3">Enregistrer{dirty ? ' les modifications' : ''}</button><button disabled={busy} onClick={() => { if (!article.title.trim() || !article.body.trim()) { setMessage('Le titre et le contenu sont obligatoires.'); return } persist(drafts.map(a => a.id === selected ? { ...a, status: a.status === 'Validé' ? 'Brouillon' : 'Validé', updatedAt: new Date().toISOString() } : a)) }} className="bg-emerald-100 text-emerald-900 rounded-lg px-4 py-3">{article.status === 'Validé' ? 'Retirer la validation' : 'Valider le brouillon'}</button></div></>}
          <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-600">{message}</p>
        </section>
      </div>
    </div>
  </main>
}

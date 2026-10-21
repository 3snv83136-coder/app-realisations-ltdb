'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppTabs from '@/components/AppTabs'
type Report = { id: string; numero: string; date_emission: string; statut: string; clientNom: string; ville: string; technicienNom: string }
export default function InspectionReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    fetch(`/api/inspections?offset=${offset}`, { cache: 'no-store', signal: controller.signal }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Chargement impossible')
      setReports(data.reports); setTotal(data.total)
    }).catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Chargement impossible') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [offset])
  const visible = reports.filter(r => `${r.numero} ${r.clientNom} ${r.ville} ${r.technicienNom}`.toLowerCase().includes(search.toLowerCase()))
  const button = 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-50'
  return <main className="min-h-screen bg-slate-50 pb-20 text-slate-900"><AppTabs /><div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
    <Link href="/inspection" className="font-semibold text-blue-900 underline">← Caméra</Link>
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-black">Tous les rapports caméra</h1><Link href="/inspection/nouveau" className={button}>Créer un nouveau rapport</Link></div>
    <label className="block font-medium">Rechercher dans cette page<input className="mt-2 block min-h-[44px] w-full rounded-xl border border-slate-300 px-4 py-2" value={search} onChange={e => setSearch(e.target.value)} placeholder="Client, numéro, ville…" /></label>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {loading ? <p role="status">Chargement…</p> : !error && <><p className="text-sm text-slate-600">{total} rapport(s) enregistré(s)</p>{visible.length === 0 && <p className="rounded-xl bg-white p-6">Aucun rapport à afficher.</p>}{visible.map(r => <article key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div><h2 className="font-bold">{r.numero} · {r.clientNom}</h2><p className="mt-1 text-sm text-slate-600">{r.date_emission} · {r.ville} · {r.technicienNom} · {r.statut === 'envoye' ? 'Envoyé' : 'Enregistré'}</p></div><Link href={`/inspection/nouveau?document=${r.id}`} className={button}>Ouvrir / Modifier</Link></article>)}<div className="flex items-center gap-3"><button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))} className={button}>Précédents</button><button disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)} className={button}>Suivants</button></div></>}
  </div></main>
}

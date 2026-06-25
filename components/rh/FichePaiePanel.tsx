'use client'

import { useEffect, useState } from "react"

type FicheResume = {
  id: string
  periode_annee: number
  periode_mois: number
  brut: number
  net_a_payer: number
  created_at: string
}

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

type Props = {
  salarieId: string
  defaultBrut: string
  onError: (msg: string) => void
  onOk: (msg: string) => void
}

export default function FichePaiePanel({ salarieId, defaultBrut, onError, onOk }: Props) {
  const now = new Date()
  const [mois, setMois] = useState(now.getMonth() + 1)
  const [annee, setAnnee] = useState(now.getFullYear())
  const [salaireBase, setSalaireBase] = useState(defaultBrut)
  const [primes, setPrimes] = useState('')
  const [primeAstreinte, setPrimeAstreinte] = useState('')
  const [prime13Mois, setPrime13Mois] = useState('')
  const [heuresSupp, setHeuresSupp] = useState('')
  const [repasNb, setRepasNb] = useState('')
  const [repasMontant, setRepasMontant] = useState('')
  const [congesPris, setCongesPris] = useState('')
  const [acompte, setAcompte] = useState('')
  const [remplacer, setRemplacer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fiches, setFiches] = useState<FicheResume[]>([])

  useEffect(() => { setSalaireBase(defaultBrut) }, [defaultBrut])

  useEffect(() => {
    fetch(`/api/rh/salaries/${salarieId}/fiche-paie`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setFiches(d.fiches || []))
      .catch(() => {})
  }, [salarieId])

  async function handleGenerate() {
    setBusy(true)
    onError('')
    try {
      const res = await fetch(`/api/rh/salaries/${salarieId}/fiche-paie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mois,
          annee,
          salaireBase: salaireBase ? Number(salaireBase) : undefined,
          primes: primes ? Number(primes) : 0,
          primeAstreinte: primeAstreinte ? Number(primeAstreinte) : 0,
          prime13Mois: prime13Mois ? Number(prime13Mois) : 0,
          heuresSupp: heuresSupp ? Number(heuresSupp) : 0,
          indemniteRepasNb: repasNb ? Number(repasNb) : 0,
          indemniteRepasMontant: repasMontant ? Number(repasMontant) : 0,
          congesPrisMois: congesPris ? Number(congesPris) : 0,
          acompte: acompte ? Number(acompte) : 0,
          remplacer,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bulletin-paie-${annee}-${String(mois).padStart(2, '0')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      onOk(`Bulletin ${MOIS_LABELS[mois - 1]} ${annee} généré.`)
      const list = await fetch(`/api/rh/salaries/${salarieId}/fiche-paie`).then(r => r.json())
      setFiches(list.fiches || [])
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Mois</span>
          <select
            value={mois}
            onChange={e => setMois(Number(e.target.value))}
            className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm"
          >
            {MOIS_LABELS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Année</span>
          <input
            type="number"
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Brut (€)</span>
          <input
            type="number"
            step="0.01"
            value={salaireBase}
            onChange={e => setSalaireBase(e.target.value)}
            className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Primes (€)</span>
          <input
            type="number"
            step="0.01"
            value={primes}
            onChange={e => setPrimes(e.target.value)}
            placeholder="0"
            className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Prime astreinte (€)</span>
          <input type="number" step="0.01" value={primeAstreinte} onChange={e => setPrimeAstreinte(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Prime 13e mois (€)</span>
          <input type="number" step="0.01" value={prime13Mois} onChange={e => setPrime13Mois(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Heures suppl.</span>
          <input type="number" step="0.01" value={heuresSupp} onChange={e => setHeuresSupp(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Congés pris (j)</span>
          <input type="number" step="0.5" value={congesPris} onChange={e => setCongesPris(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Repas (nb)</span>
          <input type="number" step="1" value={repasNb} onChange={e => setRepasNb(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Repas (€/u)</span>
          <input type="number" step="0.01" value={repasMontant} onChange={e => setRepasMontant(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="text-xs uppercase text-slate-500 font-semibold block mb-1">Acompte déduit (€)</span>
          <input type="number" step="0.01" value={acompte} onChange={e => setAcompte(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-lg px-2 py-2 text-sm" />
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 mt-6">
          <input type="checkbox" checked={remplacer} onChange={e => setRemplacer(e.target.checked)} />
          Remplacer
        </label>
      </div>
      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={busy}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3 disabled:opacity-50"
      >
        {busy ? 'Génération…' : '🧾 Générer la fiche de paie PDF'}
      </button>
      {fiches.length > 0 && (
        <div>
          <h3 className="text-xs uppercase font-bold text-slate-500 mb-2">Historique</h3>
          <ul className="text-sm space-y-1">
            {fiches.slice(0, 6).map(f => (
              <li key={f.id} className="text-slate-600">
                {MOIS_LABELS[f.periode_mois - 1]} {f.periode_annee} — brut {Number(f.brut).toFixed(2)} € → net {Number(f.net_a_payer).toFixed(2)} €
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
        Cotisations calculées selon le barème URSSAF {annee} (non-cadre). Faire valider par votre expert-comptable.
      </p>
    </div>
  )
}

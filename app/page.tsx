'use client'
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Tool = {
  href: string
  emoji: string
  label: string
  desc: string
  /** Fond du container (gradient ou couleur vive) */
  bg: string
  /** Couleur du texte par-dessus */
  text: 'white' | 'black'
}

const TOOLS: Tool[] = [
  { href: '/planning',     emoji: '📅', label: 'Planning',     desc: 'Prendre RDV, dispatcher',     bg: 'bg-gradient-to-br from-blue-500 to-blue-700',           text: 'white' },
  { href: '/nouveau',      emoji: '📝', label: 'Rapport',      desc: 'Rédiger sur place',           bg: 'bg-gradient-to-br from-slate-700 to-slate-900',         text: 'white' },
  { href: '/inspection',   emoji: '📹', label: 'Caméra',       desc: 'Inspection NF EN 13508-2',    bg: 'bg-gradient-to-br from-sky-400 to-sky-600',             text: 'white' },
  { href: '/devis',        emoji: '📋', label: 'Devis',        desc: 'Établir un devis',            bg: 'bg-gradient-to-br from-amber-400 to-amber-600',         text: 'white' },
  { href: '/facture',      emoji: '🧾', label: 'Facturation',  desc: 'Suivi, paiements & relances', bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700',     text: 'white' },
  { href: '/attestation',  emoji: '✅', label: 'Attestation',  desc: 'Raccordement / SPANC',        bg: 'bg-gradient-to-br from-[#a18249] to-[#6e5530]',         text: 'white' },
  { href: '/historique',   emoji: '📚', label: 'Historique',   desc: 'Tout retrouver',              bg: 'bg-gradient-to-br from-slate-400 to-slate-600',         text: 'white' },
  { href: '/statistiques', emoji: '📊', label: 'Statistiques', desc: 'Canaux d’acquisition',        bg: 'bg-gradient-to-br from-rose-500 to-rose-700',           text: 'white' },
  { href: '/comptabilite', emoji: '💼', label: 'Comptabilité', desc: 'Bilan, FEC, exports',         bg: 'bg-gradient-to-br from-violet-500 to-violet-700',       text: 'white' },
]

const DASHBOARD_CODE = '1004'
const TECH_RAPPORT_CODE = '0901'

export default function Home() {
  const router = useRouter()
  const [skipAnimation, setSkipAnimation] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [codeChecked, setCodeChecked] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_tech_only') === '1') {
      router.replace('/nouveau')
      return
    }
    if (sessionStorage.getItem('ltdb_dashboard_unlocked') === '1') {
      setUnlocked(true)
    }
    setCodeChecked(true)
    if (sessionStorage.getItem('ltdb_seen_intro') === '1') {
      setSkipAnimation(true)
    } else {
      sessionStorage.setItem('ltdb_seen_intro', '1')
    }
  }, [router])

  function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const value = codeInput.trim()
    if (value === DASHBOARD_CODE) {
      sessionStorage.setItem('ltdb_dashboard_unlocked', '1')
      sessionStorage.removeItem('ltdb_tech_only')
      setUnlocked(true); setCodeError('')
      return
    }
    if (value === TECH_RAPPORT_CODE) {
      sessionStorage.setItem('ltdb_tech_only', '1')
      sessionStorage.removeItem('ltdb_dashboard_unlocked')
      setCodeError('')
      router.replace('/nouveau')
      return
    }
    setCodeError('Code incorrect.')
    setCodeInput('')
  }

  if (codeChecked && !unlocked) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 px-4">
        <div className="relative z-10 w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
          <div className="text-center mb-5">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mt-1 font-semibold">Code d&apos;accès requis</p>
          </div>
          <form onSubmit={handleCodeSubmit} className="space-y-3" autoComplete="off">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value); if (codeError) setCodeError('') }}
              placeholder="••••"
              className="w-full text-center text-2xl font-bold tracking-[0.6em] bg-slate-50 text-slate-900 rounded-xl px-4 py-4 outline-none border border-slate-200 focus:border-[#0e2a52] focus:ring-4 focus:ring-[#0e2a52]/10 placeholder:text-slate-300"
            />
            {codeError && <p className="text-red-600 text-sm text-center font-medium">{codeError}</p>}
            <button
              type="submit"
              className="w-full bg-[#0e2a52] hover:bg-[#0a1f3d] active:scale-[0.98] transition-all text-white font-semibold py-3 rounded-xl"
            >
              Déverrouiller
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-900">
      {/* Header — bleu marine sobre */}
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between gap-4">
          <div className={`flex items-baseline gap-3 ${skipAnimation ? '' : 'ltdb-drop'}`}>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">LTDB</h1>
            <div className="hidden sm:block text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">
              Les Techniciens du Débouchage · CRM
            </div>
          </div>
          <div className="text-[11px] text-white/70">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <div className="relative z-10">

        {/* Tools grid — tuiles carrées colorées avec emoji en fond */}
        <div className={`px-4 sm:px-6 pt-6 sm:pt-8 pb-12 ${skipAnimation ? '' : 'buttons-reveal'}`}>
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-4 px-1">Modules</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {TOOLS.map(t => {
                const textColor = t.text === 'white' ? 'text-white' : 'text-black'
                const descColor = t.text === 'white' ? 'text-white/80' : 'text-black/70'
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`group relative rounded-3xl overflow-hidden aspect-square flex flex-col justify-end p-5 sm:p-6 shadow-md hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 ${t.bg}`}
                  >
                    {/* Emoji géant en fond */}
                    <span
                      aria-hidden
                      className="pointer-events-none select-none absolute -top-4 -right-4 sm:-top-6 sm:-right-6 text-[140px] sm:text-[170px] leading-none opacity-25 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500"
                    >
                      {t.emoji}
                    </span>

                    {/* Texte */}
                    <div className={`relative z-10 ${textColor}`}>
                      <div className="text-xl sm:text-2xl font-black leading-tight tracking-tight drop-shadow-sm">
                        {t.label}
                      </div>
                      <div className={`text-xs sm:text-sm mt-1 leading-snug ${descColor}`}>
                        {t.desc}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes softFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ltdb-drop      { opacity: 0; animation: softFadeUp 0.4s ease-out 0.05s forwards; }
        .buttons-reveal { opacity: 0; animation: softFadeUp 0.4s ease-out 0.15s forwards; }
        .dashboard-reveal { opacity: 0; animation: softFadeUp 0.4s ease-out 0.25s forwards; }

        @media (prefers-reduced-motion: reduce) {
          .ltdb-drop, .buttons-reveal, .dashboard-reveal {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </main>
  )
}


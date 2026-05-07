'use client'
import { useEffect, useState, type ComponentType } from "react"
import Link from "next/link"
import {
  CalendarIcon, DocumentIcon, CameraIcon, ClipboardIcon, ReceiptIcon,
  CheckBadgeIcon, ArchiveIcon, ChartBarIcon, BriefcaseIcon,
} from "@/components/Icons"

type Tool = {
  href: string
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  desc: string
  /** Container : fond clair + bordure colorée + hover */
  card: string
  /** Pastille icône : fond + couleur */
  iconClass: string
}

const TOOLS: Tool[] = [
  { href: '/planning',     Icon: CalendarIcon,    label: 'Planning',     desc: 'Prendre RDV, dispatcher',
    card: 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 hover:border-blue-400 hover:shadow-blue-100',
    iconClass: 'bg-blue-500 text-white shadow-md shadow-blue-200' },
  { href: '/nouveau',      Icon: DocumentIcon,    label: 'Rapport',      desc: 'Rédiger sur place',
    card: 'bg-gradient-to-br from-slate-50 to-slate-100/70 border-slate-200 hover:border-slate-400 hover:shadow-slate-200',
    iconClass: 'bg-slate-700 text-white shadow-md shadow-slate-300' },
  { href: '/inspection',   Icon: CameraIcon,      label: 'Caméra',       desc: 'Inspection NF EN 13508-2',
    card: 'bg-gradient-to-br from-sky-50 to-sky-100/50 border-sky-200 hover:border-sky-400 hover:shadow-sky-100',
    iconClass: 'bg-sky-500 text-white shadow-md shadow-sky-200' },
  { href: '/devis',        Icon: ClipboardIcon,   label: 'Devis',        desc: 'Établir un devis',
    card: 'bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200 hover:border-amber-400 hover:shadow-amber-100',
    iconClass: 'bg-amber-500 text-white shadow-md shadow-amber-200' },
  { href: '/facture',      Icon: ReceiptIcon,     label: 'Facturation',  desc: 'Suivi, paiements & relances',
    card: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-100',
    iconClass: 'bg-emerald-500 text-white shadow-md shadow-emerald-200' },
  { href: '/attestation',  Icon: CheckBadgeIcon,  label: 'Attestation',  desc: 'Raccordement / SPANC',
    card: 'bg-gradient-to-br from-[#f5efe2] to-[#ebe0c5]/60 border-[#d4c08a] hover:border-[#a08049] hover:shadow-amber-100',
    iconClass: 'bg-[#8a6d3b] text-white shadow-md shadow-amber-200' },
  { href: '/historique',   Icon: ArchiveIcon,     label: 'Historique',   desc: 'Tout retrouver',
    card: 'bg-gradient-to-br from-slate-100 to-slate-200/60 border-slate-300 hover:border-slate-500 hover:shadow-slate-200',
    iconClass: 'bg-slate-600 text-white shadow-md shadow-slate-300' },
  { href: '/statistiques', Icon: ChartBarIcon,    label: 'Statistiques', desc: 'Canaux d’acquisition',
    card: 'bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200 hover:border-rose-400 hover:shadow-rose-100',
    iconClass: 'bg-rose-500 text-white shadow-md shadow-rose-200' },
  { href: '/comptabilite', Icon: BriefcaseIcon,   label: 'Comptabilité', desc: 'Bilan, FEC, exports',
    card: 'bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200 hover:border-violet-400 hover:shadow-violet-100',
    iconClass: 'bg-violet-500 text-white shadow-md shadow-violet-200' },
]

const DASHBOARD_CODE = '1004'

export default function Home() {
  const [skipAnimation, setSkipAnimation] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [codeChecked, setCodeChecked] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_dashboard_unlocked') === '1') {
      setUnlocked(true)
    }
    setCodeChecked(true)
    if (sessionStorage.getItem('ltdb_seen_intro') === '1') {
      setSkipAnimation(true)
    } else {
      sessionStorage.setItem('ltdb_seen_intro', '1')
    }
  }, [])

  function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (codeInput.trim() === DASHBOARD_CODE) {
      sessionStorage.setItem('ltdb_dashboard_unlocked', '1')
      setUnlocked(true); setCodeError('')
    } else {
      setCodeError('Code incorrect.')
      setCodeInput('')
    }
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

        {/* Tools grid — modules colorés */}
        <div className={`px-4 sm:px-6 pt-6 sm:pt-8 pb-12 ${skipAnimation ? '' : 'buttons-reveal'}`}>
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-4 px-1">Modules</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {TOOLS.map(t => {
                const Icon = t.Icon
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`group relative rounded-2xl p-5 text-left border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${t.card}`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-12 h-12 rounded-2xl ${t.iconClass} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110`}>
                        <Icon className="w-6 h-6" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-slate-900 leading-tight tracking-tight">{t.label}</div>
                        <div className="text-xs text-slate-600 mt-0.5 leading-snug">{t.desc}</div>
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


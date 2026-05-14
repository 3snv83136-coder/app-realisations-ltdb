'use client'
import { useEffect, useState } from "react"
import Link from "next/link"

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
  { href: '/clients',      emoji: '👥', label: 'Clients',      desc: 'Annuaire, dossier, envoi',    bg: 'bg-gradient-to-br from-teal-500 to-teal-700',           text: 'white' },
  { href: '/statistiques', emoji: '📊', label: 'Statistiques', desc: 'Canaux d’acquisition',        bg: 'bg-gradient-to-br from-rose-500 to-rose-700',           text: 'white' },
  { href: '/comptabilite', emoji: '💼', label: 'Comptabilité', desc: 'Bilan, FEC, exports',         bg: 'bg-gradient-to-br from-violet-500 to-violet-700',       text: 'white' },
  { href: '/mail',         emoji: '📧', label: 'Mail',         desc: 'Emails envoyés',              bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700',           text: 'white' },
]

export default function Home() {
  const [skipAnimation, setSkipAnimation] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_seen_intro') === '1') {
      setSkipAnimation(true)
    } else {
      sessionStorage.setItem('ltdb_seen_intro', '1')
    }
  }, [])

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


'use client'
import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import LtdbLogoLink from "@/components/LtdbLogoLink"

type Tool = {
  href: string
  emoji: string
  label: string
  desc: string
  bg: string
  text: 'white' | 'black'
  ownerOnly?: boolean
}

type HubGroup = {
  id: string
  title: string
  bg: string
  emoji: string
  links: { href: string; label: string }[]
}

const HERO: Tool = {
  href: '/planning',
  emoji: '📅',
  label: 'Planning',
  desc: 'RDV, dispatch et tournées',
  bg: 'bg-gradient-to-br from-blue-500 to-blue-700',
  text: 'white',
}

const HUBS: HubGroup[] = [
  {
    id: 'rapports',
    title: 'Rapports',
    bg: 'bg-gradient-to-br from-slate-600 to-slate-900',
    emoji: '📄',
    links: [
      { href: '/nouveau', label: 'Nouveau' },
      { href: '/rapports', label: 'Tous' },
    ],
  },
  {
    id: 'devis',
    title: 'Devis',
    bg: 'bg-gradient-to-br from-amber-500 to-orange-700',
    emoji: '📋',
    links: [
      { href: '/devis', label: 'Nouveau' },
      { href: '/devis/tous', label: 'Tous' },
    ],
  },
  {
    id: 'facturation',
    title: 'Facturation',
    bg: 'bg-gradient-to-br from-emerald-500 to-green-800',
    emoji: '🧾',
    links: [
      { href: '/facture/nouvelle', label: 'Nouvelle' },
      { href: '/facture', label: 'Suivi' },
    ],
  },
]

const SMALL_TOOLS: Tool[] = [
  { href: '/accord',         emoji: '🤝', label: 'Accords',      desc: 'Liste et création',     bg: 'bg-gradient-to-br from-red-500 to-red-700',       text: 'white' },
  { href: '/relances',       emoji: '🔔', label: 'Relances',     desc: 'Avis et devis',         bg: 'bg-gradient-to-br from-orange-500 to-red-600',    text: 'white' },
  { href: '/inspection',     emoji: '📹', label: 'Caméra',       desc: 'Inspection caméra',     bg: 'bg-gradient-to-br from-sky-400 to-sky-600',       text: 'white' },
  { href: '/attestation',    emoji: '✅', label: 'Attestation',  desc: 'Attestation SPANC',     bg: 'bg-gradient-to-br from-[#a18249] to-[#6e5530]',   text: 'white' },
  { href: '/historique',     emoji: '📚', label: 'Historique',   desc: 'Interventions passées', bg: 'bg-gradient-to-br from-slate-400 to-slate-600',   text: 'white' },
  { href: '/clients',        emoji: '👥', label: 'Clients',      desc: 'Annuaire clients',      bg: 'bg-gradient-to-br from-teal-500 to-teal-700',     text: 'white' },
  { href: '/statistiques',   emoji: '📊', label: 'Statistiques', desc: 'Canaux acquisition',    bg: 'bg-gradient-to-br from-rose-500 to-rose-700',     text: 'white' },
  { href: '/comptabilite',   emoji: '💼', label: 'Comptabilité', desc: 'Bilan et FEC',          bg: 'bg-gradient-to-br from-violet-500 to-violet-700', text: 'white' },
  { href: '/rh',             emoji: '👔', label: 'RH',           desc: 'Salariés',              bg: 'bg-gradient-to-br from-fuchsia-600 to-purple-800', text: 'white' },
  { href: '/techniciens',    emoji: '🦺', label: 'Techniciens',  desc: 'Profils site public',   bg: 'bg-gradient-to-br from-orange-500 to-amber-700',  text: 'white' },
  { href: '/acces-demo',     emoji: '🔑', label: 'Accès démo',   desc: 'Essai client',          bg: 'bg-gradient-to-br from-yellow-500 to-amber-700',  text: 'white', ownerOnly: true },
  { href: '/mail',           emoji: '📧', label: 'Mail',         desc: 'Emails envoyés',        bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700',     text: 'white' },
  { href: '/post-gmb',       emoji: '📍', label: 'Post GMB',     desc: 'Google Business',       bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700', text: 'white' },
  { href: '/connexions',     emoji: '🔐', label: 'Connexions',   desc: 'Journal connexions',    bg: 'bg-gradient-to-br from-zinc-600 to-zinc-800',     text: 'white', ownerOnly: true },
]

function HeroTile({ t, introClass }: { t: Tool; introClass?: string }) {
  return (
    <Link
      href={t.href}
      title={t.desc}
      className={`group relative min-h-[100px] sm:min-h-[108px] rounded-2xl overflow-hidden flex items-end p-4 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] ${t.bg} text-white ${introClass || ''}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-2.5 right-3 text-2xl sm:text-3xl leading-none opacity-10"
      >
        {t.emoji}
      </span>
      <div className="relative z-10 text-2xl sm:text-[1.65rem] font-black tracking-tight drop-shadow-sm">
        {t.label}
      </div>
    </Link>
  )
}

function HubTile({ hub, introClass }: { hub: HubGroup; introClass?: string }) {
  return (
    <div
      className={`relative min-h-[124px] sm:min-h-[132px] rounded-2xl overflow-hidden shadow-md ${hub.bg} text-white ${introClass || ''}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-2 right-2.5 text-xl sm:text-2xl leading-none opacity-10"
      >
        {hub.emoji}
      </span>
      <div className="relative z-10 flex flex-col h-full p-3 sm:p-3.5">
        <div className="text-base sm:text-lg font-black tracking-tight drop-shadow-sm mb-2.5">
          {hub.title}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-1.5">
          {hub.links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-center rounded-lg bg-black/20 hover:bg-black/30 backdrop-blur-sm px-2 py-2 transition border border-white/10 text-sm font-bold leading-tight text-center"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function SmallTile({ t }: { t: Tool }) {
  const textColor = t.text === 'white' ? 'text-white' : 'text-black'
  return (
    <Link
      href={t.href}
      title={t.desc}
      className={`group relative min-h-[72px] sm:min-h-[76px] rounded-xl overflow-hidden flex items-end p-2.5 sm:p-3 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] ${t.bg} ${textColor}`}
    >
      <span
        aria-hidden
        className="pointer-events-none select-none absolute top-1.5 right-1.5 text-lg sm:text-xl leading-none opacity-10"
      >
        {t.emoji}
      </span>
      <div className="relative z-10 text-sm sm:text-[0.9rem] font-extrabold leading-tight tracking-tight drop-shadow-sm pr-6">
        {t.label}
      </div>
    </Link>
  )
}

export default function Home() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo
  const visibleTools = SMALL_TOOLS.filter(t => !t.ownerOnly || isOwner)

  const [intro, setIntro] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIntro(sessionStorage.getItem('ltdb_seen_intro') !== '1')
    sessionStorage.setItem('ltdb_seen_intro', '1')
  }, [])

  const introClass = intro ? 'ltdb-drop' : ''

  return (
    <main className="min-h-dvh bg-[#0a1f3d] text-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-[#0e2a52]/95 backdrop-blur-md text-white border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className={`flex items-baseline gap-2 sm:gap-3 ${introClass}`}>
            <LtdbLogoLink variant="header" />
            <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold hidden sm:block">
              CRM
            </div>
          </div>
          <div className="text-[10px] sm:text-[11px] text-white/70 text-right leading-tight">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-5 space-y-4">
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-2 px-0.5">
            Priorités
          </h2>
          <div className="space-y-2 sm:space-y-2.5">
            <HeroTile t={HERO} introClass={introClass} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {HUBS.map(hub => (
                <HubTile key={hub.id} hub={hub} introClass={introClass} />
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/50 font-semibold mb-2 px-0.5">
            Tous les modules
          </h2>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 100px), 1fr))' }}
          >
            {visibleTools.map(t => (
              <SmallTile key={t.href} t={t} />
            ))}
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes softFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ltdb-drop { opacity: 0; animation: softFadeUp 0.4s ease-out 0.05s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .ltdb-drop { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </main>
  )
}

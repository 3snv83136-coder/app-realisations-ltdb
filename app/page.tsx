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
  /** Lien externe (ouvre dans un nouvel onglet) */
  external?: boolean
}

const TOOLS: Tool[] = [
  { href: '/accord',            emoji: '🤝', label: 'Accord',          desc: 'Accords signés avant travaux',     bg: 'bg-gradient-to-br from-red-500 to-red-700',         text: 'white' },
  { href: '/accord/nouveau',    emoji: '✍️', label: 'Nouvel accord',   desc: 'Créer un accord client',           bg: 'bg-gradient-to-br from-red-400 to-rose-600',        text: 'white' },
  { href: '/planning',          emoji: '📅', label: 'Planning',        desc: 'RDV, dispatch, tournées',          bg: 'bg-gradient-to-br from-blue-500 to-blue-700',       text: 'white' },
  { href: '/nouveau',           emoji: '📝', label: 'Rapport',         desc: 'Rédiger sur le terrain',           bg: 'bg-gradient-to-br from-slate-700 to-slate-900',     text: 'white' },
  { href: '/rapports',          emoji: '📄', label: 'Rapports',        desc: 'Liste et publication',             bg: 'bg-gradient-to-br from-slate-500 to-slate-700',     text: 'white' },
  { href: '/inspection',        emoji: '📹', label: 'Caméra',          desc: 'Inspection NF EN 13508-2',       bg: 'bg-gradient-to-br from-sky-400 to-sky-600',         text: 'white' },
  { href: '/devis',             emoji: '📋', label: 'Devis',           desc: 'Établir un devis',                 bg: 'bg-gradient-to-br from-amber-400 to-amber-600',     text: 'white' },
  { href: '/devis/tous',        emoji: '📑', label: 'Tous les devis',  desc: 'Historique et suivi devis',        bg: 'bg-gradient-to-br from-yellow-500 to-orange-600',   text: 'white' },
  { href: '/facture',           emoji: '🧾', label: 'Facturation',     desc: 'Suivi, paiements, relances',       bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', text: 'white' },
  { href: '/facture/nouvelle',  emoji: '➕', label: 'Nouvelle facture', desc: 'Créer une facture',                bg: 'bg-gradient-to-br from-lime-500 to-green-700',     text: 'white' },
  { href: '/attestation',       emoji: '✅', label: 'Attestation',     desc: 'Raccordement / SPANC',             bg: 'bg-gradient-to-br from-[#a18249] to-[#6e5530]',     text: 'white' },
  { href: '/historique',        emoji: '📚', label: 'Historique',      desc: 'Interventions passées',            bg: 'bg-gradient-to-br from-slate-400 to-slate-600',     text: 'white' },
  { href: '/clients',           emoji: '👥', label: 'Clients',         desc: 'Annuaire, dossier, envoi',         bg: 'bg-gradient-to-br from-teal-500 to-teal-700',       text: 'white' },
  { href: '/statistiques',      emoji: '📊', label: 'Statistiques',    desc: 'Canaux d’acquisition',             bg: 'bg-gradient-to-br from-rose-500 to-rose-700',       text: 'white' },
  { href: '/comptabilite',      emoji: '💼', label: 'Comptabilité',    desc: 'Bilan, FEC, exports',              bg: 'bg-gradient-to-br from-violet-500 to-violet-700',   text: 'white' },
  { href: '/mail',              emoji: '📧', label: 'Mail',            desc: 'Emails envoyés',                   bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700',       text: 'white' },
  { href: '/post-gmb',          emoji: '📍', label: 'Post GMB',        desc: 'Posts Google Business',            bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700',   text: 'white' },
  { href: 'https://adsconstructor.vercel.app/', emoji: '📢', label: 'ADS MY SELF', desc: 'Constructeur de pubs', bg: 'bg-gradient-to-br from-orange-500 to-pink-600', text: 'white', external: true },
]

type Scatter = { tx: number; ty: number; rot: number; order: number }

/**
 * Positions de départ dispersées + ordre d'arrivée mélangé : les tuiles entrent
 * une par une, en désordre, et rejoignent leur place dans la grille.
 */
function genScatter(n: number): Scatter[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const rnd = (min: number, max: number) => Math.round(min + Math.random() * (max - min))
  return order.map(rank => ({
    tx: rnd(-300, 300),
    ty: rnd(-170, 170),
    rot: rnd(-30, 30),
    order: rank,
  }))
}

export default function Home() {
  const [skipAnimation, setSkipAnimation] = useState(false)
  // Entrée des tuiles : 'pending' avant la décision, 'play' = animation, 'skip' = déjà vue.
  const [tilesIntro, setTilesIntro] = useState<'pending' | 'play' | 'skip'>('pending')
  const [scatter, setScatter] = useState<Scatter[] | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_seen_intro') === '1') {
      setSkipAnimation(true)
      setTilesIntro('skip')
    } else {
      sessionStorage.setItem('ltdb_seen_intro', '1')
      setScatter(genScatter(TOOLS.length))
      setTilesIntro('play')
    }
  }, [])

  return (
    <main className="relative min-h-screen bg-[#0a1f3d] text-slate-100">
      {/* Header — bleu marine sobre */}
      <header className="bg-[#0e2a52] text-white border-b border-white/10">
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

      <div className="relative z-10 flex flex-col min-h-[calc(100dvh-4.5rem)]">

        {/* Tools grid — tuiles denses, remplissent l’écran */}
        <div className="px-3 sm:px-5 pt-5 sm:pt-6 pb-8 flex-1">
          <div className="max-w-[1600px] mx-auto w-full">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/55 font-semibold mb-3 px-1">
              Modules · {TOOLS.length}
            </div>
            <div
              className="grid gap-2 sm:gap-2.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 148px), 1fr))' }}
            >
              {TOOLS.map((t, i) => {
                const textColor = t.text === 'white' ? 'text-white' : 'text-black'
                const sc = scatter?.[i]
                const introClass =
                  tilesIntro === 'pending'
                    ? 'opacity-0'
                    : sc && tilesIntro === 'play'
                    ? 'tile-in'
                    : ''
                const tileStyle: React.CSSProperties | undefined =
                  sc && tilesIntro === 'play'
                    ? ({
                        '--tx': `${sc.tx}px`,
                        '--ty': `${sc.ty}px`,
                        '--rot': `${sc.rot}deg`,
                        animationDelay: `${(sc.order * 0.07).toFixed(3)}s`,
                      } as React.CSSProperties)
                    : undefined
                // Effet loupe : la tuile survolée grossit et passe au-dessus de ses voisines.
                const tileClass = `group relative rounded-2xl overflow-hidden min-h-[118px] sm:min-h-[128px] flex flex-col justify-end p-3 sm:p-3.5 shadow-sm transition-all duration-200 ease-out hover:shadow-xl hover:scale-[1.08] hover:z-10 ${introClass} ${t.bg}`
                const inner = (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none select-none absolute -top-2 -right-1 text-[56px] sm:text-[64px] leading-none opacity-20 transition-transform duration-200 group-hover:scale-110"
                    >
                      {t.emoji}
                    </span>

                    <div className={`relative z-10 ${textColor}`}>
                      <div className="text-sm sm:text-[15px] font-extrabold leading-tight tracking-tight drop-shadow-sm">
                        {t.label}
                      </div>
                      <p className="mt-1 text-[10px] sm:text-[11px] leading-snug opacity-80 line-clamp-2 font-medium">
                        {t.desc}
                      </p>
                    </div>
                  </>
                )

                if (t.external) {
                  return (
                    <a
                      key={`${t.href}-${t.label}`}
                      href={t.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t.desc}
                      className={tileClass}
                      style={tileStyle}
                    >
                      {inner}
                    </a>
                  )
                }

                return (
                  <Link key={`${t.href}-${t.label}`} href={t.href} title={t.desc} className={tileClass} style={tileStyle}>
                    {inner}
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
        .ltdb-drop { opacity: 0; animation: softFadeUp 0.4s ease-out 0.05s forwards; }

        /* Entrée des tuiles : chaque tuile arrive d'une position dispersée
           (variables --tx/--ty/--rot inline) et se range à sa place.
           fill-mode backwards → masquée pendant le délai, puis libère le
           transform à la fin (l'effet loupe au survol reste opérationnel). */
        @keyframes tileIn {
          0% {
            opacity: 0;
            transform: translate(var(--tx, 0), var(--ty, 0)) rotate(var(--rot, 0deg)) scale(0.5);
          }
          100% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
        }
        .tile-in { animation: tileIn 0.6s cubic-bezier(0.34, 1.25, 0.45, 1) backwards; }

        @media (prefers-reduced-motion: reduce) {
          .ltdb-drop { animation: none !important; opacity: 1 !important; transform: none !important; }
          .tile-in { animation: none !important; }
        }
      `}</style>
    </main>
  )
}

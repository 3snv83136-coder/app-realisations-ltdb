'use client'
import Link from "next/link"
import { useSession } from "next-auth/react"

export type HubTool = {
  href: string
  emoji: string
  label: string
  desc: string
  bg: string
  text: 'white' | 'black'
  ownerOnly?: boolean
}

export type HubGroup = {
  id: string
  title: string
  desc: string
  bg: string
  emoji: string
  links: { href: string; label: string; sub?: string }[]
}

export const ADMIN_HUBS: HubGroup[] = [
  {
    id: 'rapports',
    title: 'Rapports',
    desc: 'Terrain & publication',
    bg: 'bg-gradient-to-br from-slate-600 to-slate-900',
    emoji: '📄',
    links: [
      { href: '/nouveau', label: 'Nouveau rapport', sub: 'Mode terrain' },
      { href: '/rapports', label: 'Tous les rapports', sub: 'Liste & envoi' },
    ],
  },
  {
    id: 'devis',
    title: 'Devis',
    desc: 'Création & suivi',
    bg: 'bg-gradient-to-br from-amber-500 to-orange-700',
    emoji: '📋',
    links: [
      { href: '/devis', label: 'Nouveau devis', sub: 'Rédiger' },
      { href: '/devis/tous', label: 'Tous les devis', sub: 'Historique' },
    ],
  },
  {
    id: 'facturation',
    title: 'Facturation',
    desc: 'Factures & relances',
    bg: 'bg-gradient-to-br from-emerald-500 to-green-800',
    emoji: '🧾',
    links: [
      { href: '/facture/nouvelle', label: 'Nouvelle facture', sub: 'Créer' },
      { href: '/facture', label: 'Suivi facturation', sub: 'Liste & paiements' },
    ],
  },
]

export const ADMIN_TOOLS: HubTool[] = [
  { href: '/accord',           emoji: '🤝', label: 'Accords',       desc: 'Liste signés',        bg: 'bg-gradient-to-br from-red-500 to-red-700',       text: 'white' },
  { href: '/accord/nouveau',   emoji: '✍️', label: 'Nouvel accord', desc: 'Créer',               bg: 'bg-gradient-to-br from-red-400 to-rose-600',      text: 'white' },
  { href: '/relances',         emoji: '🔔', label: 'Relances',      desc: 'Stop avis/devis',     bg: 'bg-gradient-to-br from-orange-500 to-red-600',    text: 'white' },
  { href: '/inspection',       emoji: '📹', label: 'Caméra',        desc: 'Inspection NF',       bg: 'bg-gradient-to-br from-sky-400 to-sky-600',       text: 'white' },
  { href: '/attestation',      emoji: '✅', label: 'Attestation',   desc: 'SPANC',               bg: 'bg-gradient-to-br from-[#a18249] to-[#6e5530]',   text: 'white' },
  { href: '/historique',       emoji: '📚', label: 'Historique',    desc: 'Interventions',       bg: 'bg-gradient-to-br from-slate-400 to-slate-600',   text: 'white' },
  { href: '/clients',          emoji: '👥', label: 'Clients',       desc: 'Annuaire',            bg: 'bg-gradient-to-br from-teal-500 to-teal-700',     text: 'white' },
  { href: '/statistiques',     emoji: '📊', label: 'Statistiques',  desc: 'Acquisition',         bg: 'bg-gradient-to-br from-rose-500 to-rose-700',     text: 'white' },
  { href: '/comptabilite',     emoji: '💼', label: 'Comptabilité',  desc: 'Bilan & FEC',         bg: 'bg-gradient-to-br from-violet-500 to-violet-700', text: 'white' },
  { href: '/rh',               emoji: '👔', label: 'RH',            desc: 'Salariés',            bg: 'bg-gradient-to-br from-fuchsia-600 to-purple-800', text: 'white' },
  { href: '/techniciens',      emoji: '🦺', label: 'Techniciens',   desc: 'Profils site',        bg: 'bg-gradient-to-br from-orange-500 to-amber-700',  text: 'white' },
  { href: '/admin/comptes',    emoji: '👷', label: 'Comptes techs', desc: 'Login & accès',       bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', text: 'white', ownerOnly: true },
  { href: '/acces-demo',       emoji: '🔑', label: 'Accès démo',    desc: 'Essai client',        bg: 'bg-gradient-to-br from-yellow-500 to-amber-700',  text: 'white', ownerOnly: true },
  { href: '/mail',             emoji: '📧', label: 'Mail',          desc: 'Emails envoyés',      bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700',     text: 'white' },
  { href: '/post-gmb',         emoji: '📍', label: 'Post GMB',      desc: 'Google Business',     bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700', text: 'white' },
  { href: '/connexions',       emoji: '🔐', label: 'Connexions',    desc: 'Historique & pays',   bg: 'bg-gradient-to-br from-zinc-600 to-zinc-800',     text: 'white', ownerOnly: true },
]

function LtdbWatermark() {
  return (
    <span
      aria-hidden
      className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <span className="text-[4.5rem] sm:text-[6rem] font-black tracking-tighter text-white/[0.07] leading-none rotate-[-12deg] translate-y-2">
        LTDB
      </span>
    </span>
  )
}

function HubTile({ hub }: { hub: HubGroup }) {
  return (
    <div className={`group relative min-h-[156px] sm:min-h-[168px] rounded-2xl overflow-hidden shadow-md ${hub.bg} text-white`}>
      <LtdbWatermark />
      <span aria-hidden className="pointer-events-none absolute top-2 right-2 text-[2.5rem] sm:text-[3rem] leading-none opacity-20">
        {hub.emoji}
      </span>
      <div className="relative z-10 flex flex-col h-full p-3.5 sm:p-4">
        <div className="mb-3">
          <div className="text-lg sm:text-xl font-black tracking-tight drop-shadow-sm">{hub.title}</div>
          <p className="text-[10px] sm:text-xs opacity-85 font-medium">{hub.desc}</p>
        </div>
        <div className="mt-auto grid grid-cols-1 gap-1.5">
          {hub.links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between gap-2 rounded-xl bg-black/20 hover:bg-black/30 backdrop-blur-sm px-3 py-2.5 transition border border-white/10"
            >
              <span className="text-sm font-bold leading-tight">{link.label}</span>
              {link.sub && (
                <span className="text-[10px] opacity-75 shrink-0 hidden sm:inline">{link.sub}</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function SmallTile({ t }: { t: HubTool }) {
  const textColor = t.text === 'white' ? 'text-white' : 'text-black'
  return (
    <Link
      href={t.href}
      title={t.desc}
      className={`group relative min-h-[96px] sm:min-h-[104px] rounded-xl overflow-hidden flex flex-col justify-end p-3 shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${t.bg} ${textColor}`}
    >
      <span aria-hidden className="pointer-events-none select-none absolute -top-1 -right-1 text-[2.5rem] sm:text-[3rem] leading-none opacity-20">
        {t.emoji}
      </span>
      <div className="relative z-10">
        <div className="text-sm sm:text-base font-extrabold leading-tight tracking-tight drop-shadow-sm">
          {t.label}
        </div>
        <p className="mt-0.5 text-[10px] sm:text-[11px] leading-snug opacity-85 line-clamp-2 font-medium">
          {t.desc}
        </p>
      </div>
    </Link>
  )
}

/** Grille complète des modules (hubs + tuiles) — page /admin-world. */
export default function AdminWorldModules() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo
  const visibleTools = ADMIN_TOOLS.filter(t => !t.ownerOnly || isOwner)
  const total = ADMIN_HUBS.length + visibleTools.length

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-amber-300/90 font-bold">
            ADMIN OF THE WORLD
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
            {total} modules
          </h2>
        </div>
        <Link
          href="/"
          className="text-xs font-bold text-white/70 hover:text-white underline underline-offset-2"
        >
          ← Accueil
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        {ADMIN_HUBS.map(hub => (
          <HubTile key={hub.id} hub={hub} />
        ))}
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-semibold mb-2 px-0.5">
          Modules · {visibleTools.length}
        </div>
        <div
          className="grid gap-2 sm:gap-2.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 118px), 1fr))' }}
        >
          {visibleTools.map(t => (
            <SmallTile key={`${t.href}-${t.label}`} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function adminWorldModuleCount(isOwner: boolean): number {
  return ADMIN_HUBS.length + ADMIN_TOOLS.filter(t => !t.ownerOnly || isOwner).length
}

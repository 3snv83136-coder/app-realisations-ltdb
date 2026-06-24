'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { type ComponentType, useEffect, useState } from "react"
import {
  HomeIcon, CalendarIcon, DocumentIcon, CameraIcon, ClipboardIcon, ReceiptIcon,
  CheckBadgeIcon, ArchiveIcon, ChartBarIcon, BriefcaseIcon, EnvelopeIcon,
} from "@/components/Icons"

type Tab = {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
}

const TABS: Tab[] = [
  { href: '/',             label: 'Accueil',      Icon: HomeIcon },
  { href: '/planning',     label: 'Planning',     Icon: CalendarIcon },
  { href: '/nouveau',      label: 'Rapport',      Icon: DocumentIcon },
  { href: '/inspection',   label: 'Caméra',       Icon: CameraIcon },
  { href: '/devis',        label: 'Devis',        Icon: ClipboardIcon },
  { href: '/facture',      label: 'Facturation',  Icon: ReceiptIcon },
  { href: '/attestation',  label: 'Attestation',  Icon: CheckBadgeIcon },
  { href: '/historique',   label: 'Historique',   Icon: ArchiveIcon },
  { href: '/statistiques', label: 'Statistiques', Icon: ChartBarIcon },
  { href: '/comptabilite', label: 'Comptabilité', Icon: BriefcaseIcon },
  { href: '/mail',         label: 'Mail',         Icon: EnvelopeIcon },
]

/** Raccourcis terrain les plus utilisés — visibles sans ouvrir le menu. */
const MOBILE_QUICK_HREFS = ['/planning', '/nouveau', '/devis', '/facture'] as const

function isTabActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function tabLinkClass(active: boolean, compact = false) {
  return [
    'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all duration-200',
    compact
      ? 'flex-col flex-1 min-w-0 px-1 py-2.5 text-[10px] leading-tight min-h-[52px]'
      : 'px-3.5 py-2 text-sm',
    active
      ? 'bg-white text-[#0e2a52] shadow-sm ring-1 ring-black/5'
      : 'text-slate-500 hover:text-slate-800 hover:bg-white/60',
  ].join(' ')
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export default function AppTabs() {
  const pathname = usePathname() || ''
  const [menuOpen, setMenuOpen] = useState(false)

  const activeTab = TABS.find(t => isTabActive(pathname, t.href)) ?? TABS[0]
  const quickTabs = TABS.filter(t => (MOBILE_QUICK_HREFS as readonly string[]).includes(t.href))

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [menuOpen])

  return (
    <nav className="mb-3" aria-label="Navigation principale">
      {/* Mobile : raccourcis + menu plein écran */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="app-nav-menu"
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-[#0e2a52] shadow-sm min-h-[44px] shrink-0"
          >
            <MenuIcon className="w-5 h-5" />
            <span>Tout</span>
          </button>
          <div className="flex-1 min-w-0 rounded-xl bg-slate-100 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Section</div>
            <div className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
              <activeTab.Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{activeTab.label}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
          {quickTabs.map(t => {
            const active = isTabActive(pathname, t.href)
            const Icon = t.Icon
            return (
              <Link
                key={t.href}
                href={t.href}
                className={tabLinkClass(active, true)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate w-full text-center">{t.label}</span>
              </Link>
            )
          })}
        </div>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Fermer le menu"
              className="fixed inset-0 z-40 bg-black/45"
              onClick={() => setMenuOpen(false)}
            />
            <div
              id="app-nav-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
              className="fixed inset-x-0 top-0 z-50 max-h-[min(88vh,640px)] flex flex-col bg-white rounded-b-3xl shadow-2xl border-b border-slate-200"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 shrink-0">
                <div>
                  <div className="font-black text-[#0e2a52]">Navigation</div>
                  <div className="text-xs text-slate-500">Toutes les sections de l&apos;app</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-lg"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto p-3 grid grid-cols-2 gap-2">
                {TABS.map(t => {
                  const active = isTabActive(pathname, t.href)
                  const Icon = t.Icon
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3.5 rounded-2xl border-2 text-sm font-bold transition min-h-[56px] ${
                        active
                          ? 'border-[#0e2a52] bg-[#0e2a52]/5 text-[#0e2a52]'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                      }`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="leading-tight">{t.label}</span>
                    </Link>
                  )
                })}
              </div>

              <div className="p-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-200 transition min-h-[48px]"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Se déconnecter
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Desktop : barre horizontale classique */}
      <div className="hidden md:block">
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-2xl">
          {TABS.map(t => {
            const active = isTabActive(pathname, t.href)
            const Icon = t.Icon
            return (
              <Link
                key={t.href}
                href={t.href}
                className={tabLinkClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            title="Se déconnecter"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-white/60 transition-all duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

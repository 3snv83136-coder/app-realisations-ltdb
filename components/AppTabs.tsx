'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: '/',             label: 'Dashboard',   icon: '🏠' },
  { href: '/planning',     label: 'Planning',    icon: '📅' },
  { href: '/nouveau',      label: 'Rapport',     icon: '📄' },
  { href: '/devis',        label: 'Devis',       icon: '📝' },
  { href: '/facture',      label: 'Facture',     icon: '🧾' },
  { href: '/attestation',  label: 'Attestation', icon: '✅' },
  { href: '/historique',   label: 'Historique',  icon: '📚' },
  { href: '/statistiques', label: 'Stats',       icon: '📊' },
  { href: '/comptabilite', label: 'Compta',      icon: '💼' },
]

export default function AppTabs() {
  const pathname = usePathname() || ''
  return (
    <nav className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
      <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-xl mb-3 whitespace-nowrap min-w-max sm:min-w-0">
        {TABS.map(t => {
          const active = t.href === '/'
            ? pathname === '/'
            : pathname.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? 'bg-white text-[#0e2a52] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              <span className="hidden xs:inline sm:inline">{t.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: '/planning',     label: 'Planning',    icon: '📅' },
  { href: '/nouveau',      label: 'Rapport',     icon: '📄' },
  { href: '/devis',        label: 'Devis',       icon: '📝' },
  { href: '/facture',      label: 'Facture',     icon: '🧾' },
  { href: '/attestation',  label: 'Attestation', icon: '✅' },
  { href: '/historique',   label: 'Historique',  icon: '📚' },
  { href: '/comptabilite', label: 'Compta',      icon: '💼' },
]

export default function AppTabs() {
  const pathname = usePathname() || ''
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl max-w-fit mx-auto mb-3">
      {TABS.map(t => {
        const active = pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              active
                ? 'bg-white text-[#0e2a52] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </Link>
        )
      })}
    </div>
  )
}

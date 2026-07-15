'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { isAccordFinDeMois } from "@/lib/fin-de-mois"
import LtdbLogoLink from "@/components/LtdbLogoLink"

export default function TechNav() {
  const pathname = usePathname() || ''
  const showAccord = isAccordFinDeMois()

  const linkClass = (href: string) => {
    const active = href === '/planning'
      ? pathname === '/planning' || pathname === '/mes-interventions'
      : pathname.startsWith(href)
    return `inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
      active
        ? 'bg-white text-[#0e2a52] shadow-sm ring-1 ring-black/5'
        : 'text-white/80 hover:text-white hover:bg-white/10'
    }`
  }

  return (
    <nav className="bg-[#0e2a52] text-white border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <LtdbLogoLink variant="nav" className="text-white mr-1" />
          <Link href="/planning" className={linkClass('/planning')}>
            📅 Planning
          </Link>
          {showAccord && (
            <Link href="/accord" className={linkClass('/accord')}>
              🤝 Accord
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs font-semibold text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 shrink-0"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  )
}

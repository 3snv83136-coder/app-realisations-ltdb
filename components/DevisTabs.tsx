'use client'
import Link from "next/link"

export type DevisTabKey = 'nouveau' | 'travaux' | 'liste'

export default function DevisTabs({ current }: { current: DevisTabKey }) {
  const tabCls = (active: boolean) =>
    `px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
      active ? 'border-[#0e2a52] text-[#0e2a52]' : 'border-transparent text-slate-500 hover:text-slate-800'
    }`

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
        <Link href="/devis" className={tabCls(current === 'nouveau')}>
          🔧 Débouchage &amp; curage
        </Link>
        <Link href="/devis/travaux" className={tabCls(current === 'travaux')}>
          🏗 Travaux assainissement
        </Link>
        <Link href="/devis/tous" className={tabCls(current === 'liste')}>
          📚 Tous les devis
        </Link>
      </div>
    </div>
  )
}

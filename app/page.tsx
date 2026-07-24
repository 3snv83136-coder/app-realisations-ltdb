'use client'
import Link from "next/link"
import { useSession } from "next-auth/react"
import LtdbLogoLink from "@/components/LtdbLogoLink"
import { adminWorldModuleCount } from "@/components/AdminWorldModules"

export default function Home() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo
  const moduleCount = adminWorldModuleCount(isOwner)

  return (
    <main className="min-h-dvh bg-[#0a1f3d] text-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col">
      <header className="sticky top-0 z-20 bg-[#0e2a52]/95 backdrop-blur-md text-white border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 sm:gap-3">
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

      <div className="flex-1 flex items-center justify-center px-3 sm:px-5 py-8 sm:py-12">
        <Link
          href="/admin-world"
          className="group w-full max-w-xl rounded-3xl overflow-hidden border-2 border-amber-400/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/40"
        >
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 px-6 sm:px-8 py-8 sm:py-10 text-center">
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-black/50">
              Conteneur unique
            </div>
            <h1 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight text-[#0a1f3d]">
              ADMIN OF THE WORLD
            </h1>
            <p className="mt-3 text-sm sm:text-base font-semibold text-[#0a1f3d]/80">
              Clique pour ouvrir les {moduleCount} modules
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black/15 px-5 py-2.5 text-sm font-bold text-[#0a1f3d] group-hover:bg-black/25 transition">
              Ouvrir →
            </div>
          </div>
        </Link>
      </div>
    </main>
  )
}

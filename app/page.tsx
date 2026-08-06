'use client'
import { useEffect, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import LtdbLogoLink from "@/components/LtdbLogoLink"
import { adminWorldModuleCount } from "@/components/AdminWorldModules"

const EnvoyerAvisSmsPanel = dynamic(
  () => import("@/components/EnvoyerAvisSmsPanel"),
  { ssr: false },
)

function LtdbWatermark() {
  return (
    <span
      aria-hidden
      className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <span className="text-[4.5rem] sm:text-[6rem] md:text-[7rem] font-black tracking-tighter text-white/[0.07] leading-none rotate-[-12deg] translate-y-2">
        LTDB
      </span>
    </span>
  )
}

function PlanningTile() {
  return (
    <Link
      href="/planning"
      title="RDV, dispatch & tournées"
      className="group relative min-h-[132px] sm:min-h-[148px] rounded-2xl overflow-hidden flex flex-col justify-end p-4 sm:p-5 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.01] bg-gradient-to-br from-blue-500 to-blue-700 text-white"
    >
      <LtdbWatermark />
      <span aria-hidden className="pointer-events-none absolute top-3 right-3 text-[3.5rem] sm:text-[4rem] leading-none opacity-25">
        📅
      </span>
      <div className="relative z-10">
        <div className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm">Planning</div>
        <p className="mt-1 text-xs sm:text-sm opacity-90 font-medium">RDV, dispatch &amp; tournées</p>
      </div>
    </Link>
  )
}

export default function Home() {
  const { data: session } = useSession()
  const isOwner = session?.user?.role === 'admin' && !session?.user?.isDemo
  const moduleCount = adminWorldModuleCount(isOwner)

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

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* 1 — Planning */}
        <div className={introClass}>
          <PlanningTile />
        </div>

        {/* 2 — Envoyer avis SMS */}
        <EnvoyerAvisSmsPanel className={introClass} />

        {/* 3 — ADMIN OF THE WORLD (porte uniquement) */}
        <Link
          href="/admin-world"
          className={`block rounded-3xl overflow-hidden border-2 border-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_20px_40px_-12px_rgba(0,0,0,0.5)] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/40 ${introClass}`}
        >
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 px-5 sm:px-8 py-8 sm:py-10 text-center">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-[#0a1f3d]">
              ADMIN OF THE WORLD
            </h1>
            <p className="mt-2 text-sm font-semibold text-[#0a1f3d]/75">
              Clique pour ouvrir les {moduleCount} modules →
            </p>
          </div>
        </Link>
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

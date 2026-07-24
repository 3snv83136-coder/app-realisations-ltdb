'use client'
import LtdbLogoLink from "@/components/LtdbLogoLink"
import AdminWorldModules from "@/components/AdminWorldModules"
import AppTabs from "@/components/AppTabs"

export default function AdminWorldPage() {
  return (
    <main className="min-h-dvh bg-[#0a1f3d] text-slate-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-[#0e2a52]/95 backdrop-blur-md text-white border-b border-white/10 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 sm:gap-3">
            <LtdbLogoLink variant="header" />
            <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold hidden sm:block">
              ADMIN OF THE WORLD
            </div>
          </div>
          <div className="text-[10px] sm:text-[11px] text-white/70 text-right leading-tight">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-3 sm:px-5 pb-3">
          <AppTabs />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6">
        <section className="rounded-3xl overflow-hidden border-2 border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_25px_50px_-12px_rgba(0,0,0,0.55)]">
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 px-4 sm:px-6 py-3 sm:py-4">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0a1f3d]">
              ADMIN OF THE WORLD
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-[#0a1f3d]/75 mt-0.5">
              Tous les modules CRM
            </p>
          </div>
          <div className="bg-[#0d1830] p-3 sm:p-5">
            <AdminWorldModules />
          </div>
        </section>
      </div>
    </main>
  )
}

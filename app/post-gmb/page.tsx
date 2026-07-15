import Link from "next/link"
import LtdbLogoLink from "@/components/LtdbLogoLink"
import GmbHub from "@/components/gmb/GmbHub"

export const dynamic = "force-dynamic"

export default function PostGmbPage() {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <LtdbLogoLink variant="nav" className="text-white shrink-0" />
            <div>
              <h1 className="font-black text-lg sm:text-xl leading-tight">Google Business</h1>
              <div className="text-[11px] opacity-70">Connexion, fiche et posts</div>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition shrink-0"
          >
            ← Accueil
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5">
        <GmbHub />
      </main>
    </div>
  )
}

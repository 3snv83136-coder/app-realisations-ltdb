'use client'

import AppTabs from "@/components/AppTabs"
import RelanceAvisGooglePanel from "@/components/RelanceAvisGooglePanel"
import EnvoyerAvisSmsPanel from "@/components/EnvoyerAvisSmsPanel"
import Link from "next/link"

/**
 * Hub Avis Google — Admin of the World.
 * Stats d'envoi (mail J+1 → SMS J+2 → mail J+4 → mail J+7) + renvoi manuel.
 */
export default function AvisGooglePage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <AppTabs />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-5">
        <header>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link href="/admin-world" className="hover:text-[#0e2a52] font-semibold">
              ← Admin of the World
            </Link>
          </div>
          <div className="text-4xl mb-1">⭐</div>
          <h1 className="text-2xl font-black text-slate-900">Avis Google</h1>
          <p className="text-sm text-slate-600 mt-1">
            Suivi des relances automatiques, statistiques d&apos;envoi, et renvoi manuel
            par mail ou SMS.
          </p>
        </header>

        <RelanceAvisGooglePanel />

        <EnvoyerAvisSmsPanel showNom />
      </main>
    </div>
  )
}

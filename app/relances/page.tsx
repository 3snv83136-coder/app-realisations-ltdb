'use client'

import AppTabs from "@/components/AppTabs"
import RelancesHubPanel from "@/components/RelancesHubPanel"
import RelanceAvisGooglePanel from "@/components/RelanceAvisGooglePanel"
import Link from "next/link"

export default function RelancesPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <AppTabs />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-5">
        <header className="mb-1">
          <div className="text-4xl mb-1">🔔</div>
          <h1 className="text-2xl font-black text-slate-900">Relances</h1>
          <p className="text-sm text-slate-600 mt-1">
            Avis Google · devis · factures impayées — tout centralisé ici.
            {" "}
            <Link href="/avis-google" className="font-semibold text-[#0e2a52] underline">
              Hub Avis Google →
            </Link>
          </p>
        </header>
        <RelanceAvisGooglePanel />
        <RelancesHubPanel />
      </main>
    </div>
  )
}

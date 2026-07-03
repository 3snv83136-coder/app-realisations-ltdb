'use client'

import AppTabs from "@/components/AppTabs"
import RelancesHubPanel from "@/components/RelancesHubPanel"

export default function RelancesPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <AppTabs />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        <header className="mb-5">
          <div className="text-4xl mb-1">🔔</div>
          <h1 className="text-2xl font-black text-slate-900">Relances</h1>
          <p className="text-sm text-slate-600 mt-1">
            Avis Google · devis · factures impayées — tout centralisé ici.
          </p>
        </header>
        <RelancesHubPanel />
      </main>
    </div>
  )
}

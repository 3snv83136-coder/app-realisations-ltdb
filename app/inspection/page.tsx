import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppTabs from '@/components/AppTabs'

export default function InspectionHub({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (searchParams.intervention || searchParams.recup || searchParams.document) {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) if (typeof value === 'string') query.set(key, value)
    redirect(`/inspection/nouveau?${query}`)
  }
  return <main className="min-h-screen bg-slate-50 pb-20 text-slate-900">
    <AppTabs />
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="rounded-2xl bg-[#0e2a52] p-6 text-white"><h1 className="text-2xl font-black">Rapports caméra</h1><p className="mt-2 text-blue-100">Créer une inspection ou reprendre un rapport enregistré.</p></header>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/inspection/nouveau" className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm transition hover:border-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><h2 className="text-xl font-bold text-blue-900">Créer un nouveau rapport</h2><p className="mt-2 text-slate-600">Ouvrir une trame vierge avec les tronçons, observations et photos.</p><p className="mt-4 font-semibold text-blue-900">Commencer →</p></Link>
        <Link href="/inspection/rapports" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><h2 className="text-xl font-bold text-blue-900">Voir tous les rapports</h2><p className="mt-2 text-slate-600">Retrouver les inspections enregistrées, les modifier et télécharger leur PDF.</p><p className="mt-4 font-semibold text-blue-900">Ouvrir la liste →</p></Link>
      </div>
    </div>
  </main>
}

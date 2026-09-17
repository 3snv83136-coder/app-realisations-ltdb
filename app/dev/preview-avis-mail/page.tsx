import { buildEmailRelanceAvisHtml } from "@/lib/avis-relance"

export const dynamic = "force-dynamic"

const SAMPLE = {
  clientNom: "Mme Dupont",
  technicienNom: "Julien",
  ville: "Toulon",
  reviewUrl: "https://g.page/r/CascWzNKHgyEEAE/review",
  tel: "04 94 00 00 00",
  stopUrl: "https://app-realisations-ltdb.vercel.app/api/notify-client/stop-review?demo=1",
}

const VARIANTS: { jour: number; label: string }[] = [
  { jour: 1, label: "Mail J+1 — 1ʳᵉ relance" },
  { jour: 4, label: "Mail J+4 — 2ᵉ relance" },
  { jour: 7, label: "Mail J+7 — dernière relance" },
]

export default function PreviewAvisMailPage() {
  return (
    <main className="min-h-screen bg-slate-200 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h1 className="text-xl font-black text-[#0e2a52]">Prévisualisation — mails avis Google</h1>
          <p className="text-sm text-slate-600 mt-1">
            Rendu réel du template (`buildEmailRelanceAvisHtml`). Les 3 variantes de la séquence.
          </p>
        </header>

        {VARIANTS.map(v => {
          const html = buildEmailRelanceAvisHtml({ ...SAMPLE, jour: v.jour })
          return (
            <section key={v.jour} className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">{v.label}</h2>
              <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-300 bg-white">
                <iframe
                  title={v.label}
                  srcDoc={html}
                  className="w-full border-0 bg-[#eef3fb]"
                  style={{ height: 820 }}
                  sandbox=""
                />
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}

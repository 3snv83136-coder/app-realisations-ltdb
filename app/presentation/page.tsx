import Link from "next/link"
import {
  CalendarIcon,
  ClipboardIcon,
  ReceiptIcon,
  CameraIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ArchiveIcon,
  BriefcaseIcon,
  DocumentIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  MapPinIcon,
  ClockIcon,
} from "@/components/Icons"

const FEATURES = [
  {
    Icon: ClipboardIcon,
    title: "Devis en 2 minutes",
    desc: "Catalogue de prestations, calcul TVA, signature client. Envoyé par email en un clic.",
  },
  {
    Icon: ReceiptIcon,
    title: "Facturation & relances",
    desc: "Conversion devis → facture, suivi des paiements, relances automatiques.",
  },
  {
    Icon: CalendarIcon,
    title: "Planning équipes",
    desc: "Dispatch des interventions, rappels, synchronisation Google Agenda.",
  },
  {
    Icon: CameraIcon,
    title: "Inspection caméra",
    desc: "Rapports NF EN 13508-2 illustrés, photos horodatées, export PDF clé en main.",
  },
  {
    Icon: ChartBarIcon,
    title: "Statistiques canaux",
    desc: "Mesurez le ROI de chaque source d'acquisition. Décidez avec des chiffres.",
  },
  {
    Icon: BriefcaseIcon,
    title: "Compta & exports",
    desc: "FEC, journal, exports comptable. Votre expert-comptable vous remerciera.",
  },
]

export default function PresentationPage() {
  return (
    <main className="presentation">
      <FloatingHeader />

      <Hero />

      <ToolsBand />

      <FeatureSpotlight />

      <FeaturesGrid />

      <PWASection />

      <FinalCTA />

      <Footer />
    </main>
  )
}

/* -------------------------------------------------------------------------- */

function FloatingHeader() {
  return (
    <div className="sticky top-3 z-50 px-3 sm:px-6 pt-3">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-[0_8px_32px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <Link href="/presentation" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1F5BFF] flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-sm tracking-tighter">L</span>
          </div>
          <span className="font-black text-[#1F5BFF] text-xl tracking-tight">
            LTDB
          </span>
        </Link>
        <Link
          href="/"
          className="bg-[#0B1220] hover:bg-[#1a2436] text-white text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-xl transition-colors active:scale-[0.98]"
        >
          Lancer l&apos;app
        </Link>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative px-5 sm:px-6 pt-10 sm:pt-20 pb-16 sm:pb-24">
      <div className="max-w-5xl mx-auto text-center">
        <div className="p-anim p-anim-1 inline-flex items-center gap-2 bg-white/80 ring-1 ring-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 mb-6">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Nouveau · Rapport vocal sur le terrain
        </div>

        <h1 className="p-anim p-anim-2 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-[#0B1220] text-balance">
          Le CRM qui pilote
          <br />
          toute votre activité
          <br />
          <span className="serif-italic text-[#1F5BFF] font-normal">
            de débouchage
          </span>
        </h1>

        <p className="p-anim p-anim-3 mt-7 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Devis, factures, planning, inspection caméra, attestations.
          <br className="hidden sm:block" />
          Tout-en-un, sur le téléphone du technicien comme au bureau.
        </p>

        <div className="p-anim p-anim-3 mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/"
            className="group bg-[#0B1220] hover:bg-[#1a2436] text-white font-semibold px-6 py-3.5 rounded-2xl inline-flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-slate-900/10"
          >
            Essayez gratuitement
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="#fonctionnalites"
            className="text-slate-700 hover:text-slate-900 font-semibold px-5 py-3.5 inline-flex items-center gap-2 rounded-2xl ring-1 ring-slate-200 hover:ring-slate-300 bg-white/70 transition"
          >
            Voir les fonctionnalités
          </Link>
        </div>

        {/* Mockup card */}
        <div className="p-anim p-anim-4 mt-14 sm:mt-20 max-w-md mx-auto">
          <PhoneMockup />
        </div>
      </div>
    </section>
  )
}

function PhoneMockup() {
  return (
    <div className="p-float relative mx-auto" style={{ maxWidth: 320 }}>
      {/* Phone frame */}
      <div className="relative bg-[#0B1220] rounded-[44px] p-2 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]">
        <div className="bg-white rounded-[36px] overflow-hidden ring-1 ring-black/5">
          {/* Notch */}
          <div className="relative h-7 flex items-center justify-center">
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#0B1220] rounded-full" />
          </div>

          {/* Screen content */}
          <div className="px-4 pb-5 pt-2">
            {/* Screen header */}
            <div className="flex items-center justify-between mb-3">
              <span className="font-black text-[#1F5BFF] text-base tracking-tight">LTDB</span>
              <div className="w-7 h-7 rounded-full bg-slate-100 ring-1 ring-slate-200" />
            </div>

            {/* Big black button */}
            <div className="bg-[#0B1220] text-white text-xs font-semibold py-3 rounded-xl text-center mb-3">
              + Nouvelle intervention
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-3 text-[10px] font-semibold">
              <span className="bg-[#0B1220] text-white px-2.5 py-1 rounded-full">Toutes</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">À venir</span>
              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">En cours</span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              <MockInterv name="Mme Bernard" status="En cours" amount="240 €" dot="bg-amber-500" />
              <MockInterv name="M. Durand" status="Terminée" amount="1 280 €" dot="bg-emerald-500" />
              <MockInterv name="Sté Lopez" status="Planifiée" amount="—" dot="bg-blue-500" />
            </div>
          </div>

          {/* Bottom nav */}
          <div className="border-t border-slate-100 px-6 py-2.5 flex items-center justify-between text-[9px] text-slate-400 font-semibold">
            <div className="flex flex-col items-center gap-0.5 text-[#1F5BFF]">
              <CalendarIcon className="w-4 h-4" />
              <span>Planning</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <ClipboardIcon className="w-4 h-4" />
              <span>Devis</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <ReceiptIcon className="w-4 h-4" />
              <span>Factures</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockInterv({
  name,
  status,
  amount,
  dot,
}: {
  name: string
  status: string
  amount: string
  dot: string
}) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-slate-900 truncate">{name}</div>
          <div className="text-[9px] text-slate-500">{status}</div>
        </div>
      </div>
      <div className="text-[11px] font-bold text-slate-900 tabular-nums">{amount}</div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function ToolsBand() {
  const tools = [
    { Icon: CalendarIcon, label: "Planning" },
    { Icon: ClipboardIcon, label: "Devis" },
    { Icon: ReceiptIcon, label: "Factures" },
    { Icon: CameraIcon, label: "Caméra" },
    { Icon: CheckBadgeIcon, label: "Attestations" },
    { Icon: ArchiveIcon, label: "Historique" },
    { Icon: ChartBarIcon, label: "Stats" },
    { Icon: BriefcaseIcon, label: "Compta" },
  ]
  return (
    <section className="px-5 sm:px-6 pb-16 sm:pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl ring-1 ring-slate-200/70 p-6 sm:p-10 shadow-[0_8px_32px_rgba(15,23,42,0.04)]">
          <p className="text-center text-xs uppercase tracking-[0.2em] font-bold text-slate-500 mb-6">
            8 modules · une seule app
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
            {tools.map(({ Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#EFF4FF] ring-1 ring-[#DCE6FF] flex items-center justify-center text-[#1F5BFF] transition-transform group-hover:-translate-y-0.5">
                  <Icon className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-700">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function FeatureSpotlight() {
  return (
    <section className="px-5 sm:px-6 pb-20 sm:pb-32">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 text-[#1F5BFF] bg-[#EFF4FF] ring-1 ring-[#DCE6FF] rounded-full px-3 py-1 text-xs font-bold tracking-tight mb-5">
            <CameraIcon className="w-3.5 h-3.5" strokeWidth={2} />
            Sur le terrain
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05] text-[#0B1220]">
            Décrivez votre chantier
            <br />
            <span className="serif-italic text-[#1F5BFF] font-normal">à l&apos;oral</span>
          </h2>
          <p className="mt-5 text-slate-600 leading-relaxed">
            Plus besoin de taper. Décrivez simplement votre intervention à voix
            haute et LTDB génère automatiquement un rapport détaillé. Idéal sur
            le terrain, les mains occupées.
          </p>
          <ul className="mt-7 space-y-3.5">
            {[
              ["Dictée naturelle", "Parlez comme vous le feriez à un collègue."],
              ["Conversion instantanée", "Description transformée en rapport structuré en quelques secondes."],
              ["Modification facile", "Ajustez les détails d'un simple clic."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EFF4FF] ring-1 ring-[#DCE6FF] flex items-center justify-center flex-shrink-0 text-[#1F5BFF]">
                  <CheckIcon className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-bold text-[#0B1220] text-[15px]">{t}</div>
                  <div className="text-sm text-slate-600 mt-0.5">{d}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 bg-[#0B1220] hover:bg-[#1a2436] text-white font-semibold px-5 py-3 rounded-2xl transition active:scale-[0.98]"
          >
            Essayer la dictée vocale
            <span>→</span>
          </Link>
        </div>

        <div className="order-1 lg:order-2 relative">
          <div className="bg-white rounded-3xl ring-1 ring-slate-200/70 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.15)] p-6 sm:p-8">
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1F5BFF] bg-[#EFF4FF] inline-block px-2.5 py-1 rounded-md mb-5">
              Rapport généré
            </div>
            <div className="space-y-3">
              {[
                ["Débouchage canalisation cuisine", "180,00 €"],
                ["Inspection caméra 12m", "240,00 €"],
                ["Hydrocurage haute pression", "320,00 €"],
              ].map(([item, price]) => (
                <div
                  key={item}
                  className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0"
                >
                  <span className="text-[15px] text-slate-700">{item}</span>
                  <span className="text-[15px] font-semibold text-slate-900 tabular-nums">{price}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-slate-200">
                <span className="font-bold text-[#0B1220]">Total HT</span>
                <span className="font-black text-xl text-[#0B1220] tabular-nums">740,00 €</span>
              </div>
            </div>

            <div className="mt-6 bg-[#EFF4FF] rounded-2xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1F5BFF] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-black">⏺</span>
              </div>
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-[#0B1220]">Transcription en cours…</span>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                    <span
                      key={i}
                      className="block w-0.5 rounded-full bg-[#1F5BFF]/60"
                      style={{ height: 6 + ((i * 7) % 14) }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function FeaturesGrid() {
  return (
    <section id="fonctionnalites" className="px-5 sm:px-6 pb-20 sm:pb-32">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[#1F5BFF] mb-3">
            Fonctionnalités
          </p>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05] text-[#0B1220]">
            Tout ce qu&apos;il vous faut,
            <br />
            <span className="serif-italic text-[#1F5BFF] font-normal">
              rien de superflu
            </span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-6 hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-[#EFF4FF] ring-1 ring-[#DCE6FF] flex items-center justify-center text-[#1F5BFF] mb-4">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <h3 className="font-bold text-[#0B1220] text-[17px] tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function PWASection() {
  return (
    <section className="px-5 sm:px-6 pb-20 sm:pb-32">
      <div className="max-w-5xl mx-auto bg-white rounded-3xl ring-1 ring-slate-200/70 p-8 sm:p-14 shadow-[0_8px_32px_rgba(15,23,42,0.04)]">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#EFF4FF] ring-1 ring-[#DCE6FF] text-[#1F5BFF] rounded-full px-3 py-1 text-xs font-bold mb-5">
              <DocumentIcon className="w-3.5 h-3.5" strokeWidth={2} />
              Application
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05] text-[#0B1220]">
              Installez LTDB
              <br />
              <span className="serif-italic text-[#1F5BFF] font-normal">
                sur tous vos appareils
              </span>
            </h2>
            <p className="mt-5 text-slate-600 leading-relaxed">
              LTDB est une Progressive Web App. Installez-la en un clic sur
              votre téléphone, tablette ou ordinateur. Pas besoin de passer par
              l&apos;App Store ou Google Play.
            </p>

            <div className="mt-7 space-y-4">
              {[
                {
                  Icon: ArrowDownTrayIcon,
                  title: "Installation en 1 clic",
                  desc: "Ajoutez LTDB à votre écran d'accueil directement depuis votre navigateur.",
                },
                {
                  Icon: CheckBadgeIcon,
                  title: "Fonctionne hors-ligne",
                  desc: "Continuez à travailler même quand le réseau lâche sur le chantier.",
                },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#EFF4FF] ring-1 ring-[#DCE6FF] flex items-center justify-center flex-shrink-0 text-[#1F5BFF]">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="font-bold text-[#0B1220]">{title}</div>
                    <div className="text-sm text-slate-600 mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="bg-[#F5F7FA] rounded-3xl p-8 ring-1 ring-slate-200/70">
              <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-5 mb-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1F5BFF] flex items-center justify-center text-white font-black text-lg">
                    L
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#0B1220] tracking-tight">
                      LTDB
                    </div>
                    <div className="text-xs text-slate-500">
                      Les Techniciens du Débouchage
                    </div>
                  </div>
                  <div className="bg-[#0B1220] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg">
                    Installer
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Aperçu
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { Icon: CalendarIcon, tone: "bg-blue-50 text-blue-600" },
                    { Icon: ClipboardIcon, tone: "bg-amber-50 text-amber-600" },
                    { Icon: ReceiptIcon, tone: "bg-emerald-50 text-emerald-600" },
                    { Icon: CameraIcon, tone: "bg-sky-50 text-sky-600" },
                    { Icon: ChartBarIcon, tone: "bg-rose-50 text-rose-600" },
                    { Icon: BriefcaseIcon, tone: "bg-violet-50 text-violet-600" },
                  ].map(({ Icon, tone }, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-xl ${tone} flex items-center justify-center`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function FinalCTA() {
  return (
    <section className="px-5 sm:px-6 pb-20 sm:pb-32">
      <div className="max-w-4xl mx-auto text-center bg-[#0B1220] rounded-3xl p-10 sm:p-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 0%, rgba(31,91,255,0.4), transparent 50%), radial-gradient(circle at 80% 100%, rgba(31,91,255,0.25), transparent 50%)",
          }}
        />
        <div className="relative">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05] text-white">
            Prêt à passer le cap ?
            <br />
            <span className="serif-italic text-[#7DA0FF] font-normal">
              en moins d&apos;une minute.
            </span>
          </h2>
          <p className="mt-5 text-slate-300 max-w-xl mx-auto">
            Aucune carte bancaire, aucun engagement. Lancez l&apos;app et créez
            votre premier devis dès maintenant.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="bg-white hover:bg-slate-100 text-[#0B1220] font-semibold px-6 py-3.5 rounded-2xl inline-flex items-center justify-center gap-2 transition active:scale-[0.98]"
            >
              Lancer l&apos;app
              <span>→</span>
            </Link>
            <Link
              href="/login"
              className="ring-1 ring-white/20 hover:bg-white/5 text-white font-semibold px-6 py-3.5 rounded-2xl inline-flex items-center justify-center gap-2 transition"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="px-5 sm:px-6 pb-10">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#1F5BFF] flex items-center justify-center">
            <span className="text-white font-black text-[10px]">L</span>
          </div>
          <span className="font-bold text-[#0B1220]">LTDB</span>
          <span>· Les Techniciens du Débouchage</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <MapPinIcon className="w-3.5 h-3.5" />
          <span>France entière</span>
          <span className="mx-2">·</span>
          <ClockIcon className="w-3.5 h-3.5" />
          <span>24/7</span>
        </div>
      </div>
    </footer>
  )
}

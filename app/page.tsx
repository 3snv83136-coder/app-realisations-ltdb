'use client'
import { useEffect, useState } from "react"
import Link from "next/link"

type Intervention = {
  id: string
  reference: string | null
  client_nom: string | null
  client_telephone?: string | null
  ville: string | null
  code_postal: string | null
  adresse_chantier: string | null
  type_intervention: string | null
  date_prevue: string | null
  heure_prevue: string | null
  date_realisee: string | null
  statut: string
  urgence: boolean
  technicien_nom?: string | null
  agence: string | null
  publie_slug: string | null
}

type Stats = {
  ca_mois: number
  ca_annee: number
  factures_mois: number
  interventions_semaine: number
}

const TOOLS = [
  { href: '/planning',     icon: '📅', label: 'Planning',    color: 'from-blue-500 to-blue-700',     desc: 'Prendre RDV, dispatcher' },
  { href: '/nouveau',      icon: '📄', label: 'Rapport',     color: 'from-[#0e2a52] to-[#1a3a6b]',   desc: 'Rédiger sur place' },
  { href: '/devis',        icon: '📝', label: 'Devis',       color: 'from-amber-500 to-orange-600',  desc: 'Établir un devis' },
  { href: '/facture',      icon: '🧾', label: 'Facture',     color: 'from-emerald-500 to-emerald-700', desc: 'Facturer le client' },
  { href: '/attestation',  icon: '✅', label: 'Attestation', color: 'from-[#a78346] to-[#7d6233]',   desc: 'Raccordement / SPANC' },
  { href: '/historique',   icon: '📚', label: 'Historique',  color: 'from-slate-500 to-slate-700',   desc: 'Tout retrouver' },
  { href: '/comptabilite', icon: '💼', label: 'Compta',      color: 'from-purple-500 to-purple-800', desc: 'Bilan, FEC, exports' },
]

const STATUT_LABEL: Record<string, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}` : iso
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const m = /^(\d{2}):(\d{2})/.exec(t)
  return m ? `${m[1]}h${m[2]}` : t
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default function Home() {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [skipAnimation, setSkipAnimation] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_seen_intro') === '1') {
      setSkipAnimation(true)
    } else {
      sessionStorage.setItem('ltdb_seen_intro', '1')
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/interventions?limit=100').then(r => r.json()).catch(() => ({ interventions: [] })),
      fetch('/api/historique').then(r => r.json()).catch(() => ({ documents: [] })),
    ]).then(([intRes, histRes]) => {
      setInterventions(intRes.interventions || [])
      setDocuments(histRes.documents || [])
    }).finally(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'

  const aVenir = interventions
    .filter(i => i.statut === 'planifiee')
    .sort((a, b) => {
      const da = (a.date_prevue || '9999') + (a.heure_prevue || '99:99')
      const db = (b.date_prevue || '9999') + (b.heure_prevue || '99:99')
      return da.localeCompare(db)
    })
  const enCours = interventions.filter(i => i.statut === 'en_cours')
  const terminees = interventions
    .filter(i => i.statut === 'terminee')
    .sort((a, b) => (b.date_realisee || '').localeCompare(a.date_realisee || ''))

  const stats: Stats = {
    ca_mois: documents
      .filter(d => d.type === 'facture' && d.statut !== 'annule' && d.date_emission >= monthStart)
      .reduce((s, d) => s + (d.montant_ttc || 0), 0),
    ca_annee: documents
      .filter(d => d.type === 'facture' && d.statut !== 'annule' && d.date_emission >= today.slice(0, 4) + '-01-01')
      .reduce((s, d) => s + (d.montant_ttc || 0), 0),
    factures_mois: documents.filter(d => d.type === 'facture' && d.date_emission >= monthStart).length,
    interventions_semaine: interventions.filter(i => {
      const d = i.date_prevue || i.date_realisee
      if (!d) return false
      const daysAgo = Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24))
      return daysAgo >= 0 && daysAgo <= 7
    }).length,
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a1a3d] text-white">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a1a3d] via-[#0e2a52] to-[#071026]" />

      {/* Shatter cracks */}
      {!skipAnimation && (
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full opacity-0 cracks-fade-in"
          viewBox="0 0 800 1000"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <g stroke="#1a3a6b" strokeWidth="1.5" fill="none" strokeLinecap="round">
            <path d="M400 420 L200 100" />
            <path d="M400 420 L120 200" />
            <path d="M400 420 L600 80" />
            <path d="M400 420 L720 180" />
            <path d="M400 420 L50 500" />
            <path d="M400 420 L750 500" />
            <path d="M400 420 L180 900" />
            <path d="M400 420 L320 980" />
            <path d="M400 420 L500 980" />
            <path d="M400 420 L680 900" />
            <path d="M400 420 L280 300" />
            <path d="M400 420 L520 320" />
            <path d="M400 420 L250 620" />
            <path d="M400 420 L580 630" />
          </g>
        </svg>
      )}

      {!skipAnimation && (
        <div className="pointer-events-none absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-orange-400 shockwave-ring" />
      )}

      <div className={`relative z-10 ${skipAnimation ? '' : 'shake-on-impact'}`}>
        {/* Header avec logo */}
        <div className="px-4 sm:px-6 py-6 sm:py-10">
          <div className={`text-center ${skipAnimation ? '' : 'ltdb-drop'}`}>
            <h1 className="text-[14vw] sm:text-[8vw] md:text-7xl lg:text-8xl font-black leading-none tracking-tight text-white drop-shadow-[0_4px_20px_rgba(229,115,22,0.4)]">
              LTDB
            </h1>
            <div className="mt-1 text-[9px] sm:text-[11px] md:text-xs uppercase tracking-[0.35em] text-orange-300/80 font-bold">
              Les Techniciens du Débouchage · CRM
            </div>
          </div>
        </div>

        {/* Tools grid */}
        <div className={`px-4 sm:px-6 ${skipAnimation ? '' : 'buttons-reveal'}`}>
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {TOOLS.map(t => (
              <Link
                key={t.href}
                href={t.href}
                className="group relative bg-white/95 hover:bg-white text-[#0e2a52] rounded-2xl p-3 sm:p-4 text-left shadow-xl hover:shadow-2xl transition-all active:scale-[0.97] hover:-translate-y-0.5"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.color} text-white flex items-center justify-center text-xl mb-2 shadow-md`}>
                  {t.icon}
                </div>
                <div className="text-sm sm:text-base font-black leading-tight">{t.label}</div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">{t.desc}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Dashboard interventions */}
        <div className={`px-4 sm:px-6 mt-8 sm:mt-12 pb-12 ${skipAnimation ? '' : 'dashboard-reveal'}`}>
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="CA mois" value={fmtEUR(stats.ca_mois)} icon="💶" />
              <StatCard label="CA année" value={fmtEUR(stats.ca_annee)} icon="📈" />
              <StatCard label="Factures mois" value={String(stats.factures_mois)} icon="🧾" />
              <StatCard label="Inter. semaine" value={String(stats.interventions_semaine)} icon="🔧" />
            </div>

            {/* Kanban interventions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Column
                title="À venir"
                count={aVenir.length}
                accent="border-blue-400 text-blue-100"
                icon="📅"
                interventions={aVenir.slice(0, 8)}
                emptyMessage="Aucune intervention planifiée."
                emptyAction={{ label: '+ Planifier', href: '/planning' }}
              />
              <Column
                title="En cours"
                count={enCours.length}
                accent="border-amber-400 text-amber-100"
                icon="⚙"
                interventions={enCours}
                emptyMessage="Aucune intervention en cours."
                pulse
              />
              <Column
                title="Terminées récentes"
                count={terminees.length}
                accent="border-emerald-400 text-emerald-100"
                icon="✅"
                interventions={terminees.slice(0, 8)}
                emptyMessage="Pas encore de réalisations."
              />
            </div>

            {loading && (
              <div className="text-center text-white/60 text-sm">Chargement…</div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        /* ===== LTDB drop animation ===== */
        @keyframes ltdbDrop {
          0%   { opacity: 0; transform: translateY(-120vh) rotate(-8deg) scale(1.5); }
          30%  { opacity: 0; transform: translateY(-120vh) rotate(-8deg) scale(1.5); }
          75%  { opacity: 1; transform: translateY(8px) rotate(2deg) scale(1.02); }
          85%  { transform: translateY(-4px) rotate(-1deg) scale(1); }
          100% { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
        }
        .ltdb-drop {
          opacity: 0;
          animation: ltdbDrop 1.4s cubic-bezier(.45,.05,.2,1) 0.2s forwards;
          will-change: transform, opacity;
        }

        @keyframes shake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-3px, 2px); }
          25% { transform: translate(3px, -2px); }
          50% { transform: translate(-2px, 1px); }
          75% { transform: translate(2px, -1px); }
        }
        .shake-on-impact {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) 1.3s;
        }

        @keyframes shockwave {
          0%   { width: 0; height: 0; opacity: 0; border-width: 8px; }
          20%  { opacity: 0; }
          25%  { opacity: 0.95; width: 20px; height: 20px; border-width: 8px; }
          100% { width: 150vw; height: 150vw; opacity: 0; border-width: 0; }
        }
        .shockwave-ring {
          width: 0;
          height: 0;
          opacity: 0;
          animation: shockwave 1.2s ease-out 1.3s forwards;
        }

        @keyframes cracksFade {
          0%, 70% { opacity: 0; }
          100%    { opacity: 0.55; }
        }
        .cracks-fade-in {
          animation: cracksFade 1s ease-out 1.3s forwards;
        }

        @keyframes buttonsUp {
          0%, 70% { opacity: 0; transform: translateY(40px); pointer-events: none; }
          100%    { opacity: 1; transform: translateY(0); pointer-events: auto; }
        }
        .buttons-reveal {
          opacity: 0;
          transform: translateY(40px);
          pointer-events: none;
          animation: buttonsUp 0.6s ease-out 1.55s forwards;
        }

        @keyframes dashboardUp {
          0%, 80% { opacity: 0; transform: translateY(20px); }
          100%    { opacity: 1; transform: translateY(0); }
        }
        .dashboard-reveal {
          opacity: 0;
          animation: dashboardUp 0.6s ease-out 1.85s forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .ltdb-drop, .shake-on-impact, .shockwave-ring, .cracks-fade-in, .buttons-reveal, .dashboard-reveal {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            pointer-events: auto !important;
          }
          .cracks-fade-in { opacity: 0.5 !important; }
        }
      `}</style>
    </main>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4">
      <div className="flex items-center justify-between text-white/70 text-[11px] uppercase tracking-wider font-bold">
        <span>{label}</span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="mt-1 text-xl sm:text-2xl font-black text-white">{value}</div>
    </div>
  )
}

function Column({ title, count, accent, icon, interventions, emptyMessage, emptyAction, pulse }: {
  title: string
  count: number
  accent: string
  icon: string
  interventions: Intervention[]
  emptyMessage: string
  emptyAction?: { label: string; href: string }
  pulse?: boolean
}) {
  return (
    <div className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-2xl p-4 min-h-[200px]">
      <div className={`flex items-center justify-between pb-3 mb-3 border-b ${accent}`}>
        <h3 className="font-black text-white flex items-center gap-2">
          <span className={pulse ? 'inline-block animate-pulse' : ''}>{icon}</span>
          <span>{title}</span>
        </h3>
        <span className="bg-white/15 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">
          {count}
        </span>
      </div>
      {interventions.length === 0 ? (
        <div className="text-center text-white/50 text-sm py-8 space-y-3">
          <div>{emptyMessage}</div>
          {emptyAction && (
            <Link
              href={emptyAction.href}
              className="inline-block bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg text-xs font-bold transition"
            >
              {emptyAction.label}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {interventions.map(i => (
            <InterventionCard key={i.id} i={i} />
          ))}
        </div>
      )}
    </div>
  )
}

function InterventionCard({ i }: { i: Intervention }) {
  const isUrgent = i.urgence
  const dateLabel = i.statut === 'terminee'
    ? fmtDate(i.date_realisee)
    : `${fmtDate(i.date_prevue)} ${fmtTime(i.heure_prevue)}`.trim()

  const target = i.statut === 'terminee' && i.publie_slug
    ? `/intervention/${i.id}`
    : `/intervention/${i.id}`

  return (
    <Link
      href={target}
      className={`block bg-white/95 hover:bg-white text-[#0e2a52] rounded-xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-xl ${isUrgent ? 'ring-2 ring-red-400' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black truncate">
            {i.client_nom || '—'}
            {isUrgent && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black">URGENT</span>}
          </div>
          <div className="text-xs text-slate-600 truncate mt-0.5">
            {i.type_intervention || 'Intervention'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
            <span>📍 {i.ville || '—'}</span>
            <span>•</span>
            <span>🗓 {dateLabel || '—'}</span>
          </div>
          {i.technicien_nom && (
            <div className="text-[11px] text-slate-500 mt-0.5">👷 {i.technicien_nom}</div>
          )}
        </div>
      </div>
    </Link>
  )
}

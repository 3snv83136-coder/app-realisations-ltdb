'use client'
import { useEffect, useState, type ComponentType } from "react"
import Link from "next/link"
import {
  CalendarIcon, DocumentIcon, CameraIcon, ClipboardIcon, ReceiptIcon,
  CheckBadgeIcon, ArchiveIcon, ChartBarIcon, BriefcaseIcon,
  ClockIcon, MapPinIcon, ExclamationIcon,
} from "@/components/Icons"

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

type Tool = {
  href: string
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  /** classes Tailwind : fond + texte de la pastille icône (palette douce) */
  tone: string
  desc: string
}

const TOOLS: Tool[] = [
  { href: '/planning',     Icon: CalendarIcon,    label: 'Planning',     tone: 'bg-blue-50 text-blue-600',       desc: 'Prendre RDV, dispatcher' },
  { href: '/nouveau',      Icon: DocumentIcon,    label: 'Rapport',      tone: 'bg-slate-100 text-slate-700',    desc: 'Rédiger sur place' },
  { href: '/inspection',   Icon: CameraIcon,      label: 'Caméra',       tone: 'bg-sky-50 text-sky-600',         desc: 'Inspection NF EN 13508-2' },
  { href: '/devis',        Icon: ClipboardIcon,   label: 'Devis',        tone: 'bg-amber-50 text-amber-600',     desc: 'Établir un devis' },
  { href: '/facture',      Icon: ReceiptIcon,     label: 'Facturation',  tone: 'bg-emerald-50 text-emerald-600', desc: 'Suivi, paiements & relances' },
  { href: '/attestation',  Icon: CheckBadgeIcon,  label: 'Attestation',  tone: 'bg-[#f5efe2] text-[#8a6d3b]',    desc: 'Raccordement / SPANC' },
  { href: '/historique',   Icon: ArchiveIcon,     label: 'Historique',   tone: 'bg-slate-100 text-slate-600',    desc: 'Tout retrouver' },
  { href: '/statistiques', Icon: ChartBarIcon,    label: 'Statistiques', tone: 'bg-rose-50 text-rose-600',       desc: 'Canaux d’acquisition' },
  { href: '/comptabilite', Icon: BriefcaseIcon,   label: 'Comptabilité', tone: 'bg-violet-50 text-violet-600',   desc: 'Bilan, FEC, exports' },
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

const DASHBOARD_CODE = '1004'

export default function Home() {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [skipAnimation, setSkipAnimation] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [codeChecked, setCodeChecked] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('ltdb_dashboard_unlocked') === '1') {
      setUnlocked(true)
    }
    setCodeChecked(true)
    if (sessionStorage.getItem('ltdb_seen_intro') === '1') {
      setSkipAnimation(true)
    } else {
      sessionStorage.setItem('ltdb_seen_intro', '1')
    }
  }, [])

  function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (codeInput.trim() === DASHBOARD_CODE) {
      sessionStorage.setItem('ltdb_dashboard_unlocked', '1')
      setUnlocked(true); setCodeError('')
    } else {
      setCodeError('Code incorrect.')
      setCodeInput('')
    }
  }

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

  if (codeChecked && !unlocked) {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 px-4">
        <div className="relative z-10 w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-7 shadow-sm">
          <div className="text-center mb-5">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mt-1 font-semibold">Code d&apos;accès requis</p>
          </div>
          <form onSubmit={handleCodeSubmit} className="space-y-3" autoComplete="off">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value); if (codeError) setCodeError('') }}
              placeholder="••••"
              className="w-full text-center text-2xl font-bold tracking-[0.6em] bg-slate-50 text-slate-900 rounded-xl px-4 py-4 outline-none border border-slate-200 focus:border-[#0e2a52] focus:ring-4 focus:ring-[#0e2a52]/10 placeholder:text-slate-300"
            />
            {codeError && <p className="text-red-600 text-sm text-center font-medium">{codeError}</p>}
            <button
              type="submit"
              className="w-full bg-[#0e2a52] hover:bg-[#0a1f3d] active:scale-[0.98] transition-all text-white font-semibold py-3 rounded-xl"
            >
              Déverrouiller
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-900">
      {/* Header — bleu marine sobre */}
      <header className="bg-[#0e2a52] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between gap-4">
          <div className={`flex items-baseline gap-3 ${skipAnimation ? '' : 'ltdb-drop'}`}>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">LTDB</h1>
            <div className="hidden sm:block text-[10px] uppercase tracking-[0.25em] text-white/60 font-semibold">
              Les Techniciens du Débouchage · CRM
            </div>
          </div>
          <div className="text-[11px] text-white/70">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </header>

      <div className="relative z-10">

        {/* Tools grid — style logiciel pro, cards blanches plates */}
        <div className={`px-4 sm:px-6 pt-6 sm:pt-8 ${skipAnimation ? '' : 'buttons-reveal'}`}>
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3 px-1">Modules</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {TOOLS.map(t => {
                const Icon = t.Icon
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="group bg-white rounded-2xl p-4 text-left border border-slate-200/70 hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex items-center gap-3"
                  >
                    <div className={`w-10 h-10 rounded-xl ${t.tone} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}>
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 leading-tight tracking-tight">{t.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate">{t.desc}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Dashboard interventions */}
        <div className={`px-4 sm:px-6 mt-8 pb-12 ${skipAnimation ? '' : 'dashboard-reveal'}`}>
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats row */}
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3 px-1">Indicateurs</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard label="CA mois"        value={fmtEUR(stats.ca_mois)} />
                <StatCard label="CA année"       value={fmtEUR(stats.ca_annee)} />
                <StatCard label="Factures mois"  value={String(stats.factures_mois)} />
                <StatCard label="Inter. semaine" value={String(stats.interventions_semaine)} />
              </div>
            </div>

            {/* Kanban interventions */}
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3 px-1">Interventions</div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Column
                  title="À venir"
                  count={aVenir.length}
                  dotClass="bg-blue-500"
                  interventions={aVenir.slice(0, 8)}
                  emptyMessage="Aucune intervention planifiée."
                  emptyAction={{ label: 'Planifier', href: '/planning' }}
                />
                <Column
                  title="En cours"
                  count={enCours.length}
                  dotClass="bg-amber-500"
                  interventions={enCours}
                  emptyMessage="Aucune intervention en cours."
                  pulse
                />
                <Column
                  title="Terminées récentes"
                  count={terminees.length}
                  dotClass="bg-emerald-500"
                  interventions={terminees.slice(0, 8)}
                  emptyMessage="Pas encore de réalisations."
                />
              </div>
            </div>

            {loading && (
              <div className="text-center text-slate-400 text-sm">Chargement…</div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes softFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ltdb-drop      { opacity: 0; animation: softFadeUp 0.4s ease-out 0.05s forwards; }
        .buttons-reveal { opacity: 0; animation: softFadeUp 0.4s ease-out 0.15s forwards; }
        .dashboard-reveal { opacity: 0; animation: softFadeUp 0.4s ease-out 0.25s forwards; }

        @media (prefers-reduced-motion: reduce) {
          .ltdb-drop, .buttons-reveal, .dashboard-reveal {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200/70 rounded-2xl p-4 hover:border-slate-300 transition-colors">
      <div className="text-slate-500 text-[10px] uppercase tracking-[0.18em] font-semibold">{label}</div>
      <div className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{value}</div>
    </div>
  )
}

function Column({ title, count, dotClass, interventions, emptyMessage, emptyAction, pulse }: {
  title: string
  count: number
  dotClass: string
  interventions: Intervention[]
  emptyMessage: string
  emptyAction?: { label: string; href: string }
  pulse?: boolean
}) {
  return (
    <div className="bg-white border border-slate-200/70 rounded-2xl p-4 min-h-[220px]">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 tracking-tight text-sm">
          <span className={`inline-block w-2 h-2 rounded-full ${dotClass} ${pulse ? 'animate-pulse' : ''}`} aria-hidden />
          <span>{title}</span>
        </h3>
        <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
      </div>
      {interventions.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-10 space-y-3">
          <div>{emptyMessage}</div>
          {emptyAction && (
            <Link
              href={emptyAction.href}
              className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border border-slate-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
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

  return (
    <Link
      href={`/intervention/${i.id}`}
      className={`block bg-slate-50/60 hover:bg-white text-slate-900 rounded-xl p-3 transition-all border ${
        isUrgent ? 'border-red-200 bg-red-50/30 hover:bg-red-50/50' : 'border-slate-200/60 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate flex items-center gap-2">
            <span className="truncate">{i.client_nom || '—'}</span>
            {isUrgent && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                <ExclamationIcon className="w-3 h-3" strokeWidth={2.5} />
                URGENT
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600 truncate mt-0.5">
            {i.type_intervention || 'Intervention'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="w-3 h-3" />
              {i.ville || '—'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {dateLabel || '—'}
            </span>
          </div>
          {i.technicien_nom && (
            <div className="text-[11px] text-slate-500 mt-1">{i.technicien_nom}</div>
          )}
        </div>
      </div>
    </Link>
  )
}

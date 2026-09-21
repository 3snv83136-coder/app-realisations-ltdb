'use client'
import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import AppTabs from "@/components/AppTabs"
import { fmtDateFR } from "@/lib/format"
import { errorMessage } from "@/lib/error-message"
import LtdbLogoLink from "@/components/LtdbLogoLink"

const ResendEmailButton = dynamic(() => import("@/components/ResendEmailButton"), { ssr: false })

type Document = {
  id: string
  type: 'facture' | 'devis' | 'attestation' | 'rapport'
  numero: string | null
  agence: string | null
  date_emission: string
  statut: string
  montant_ht: number | null
  montant_ttc: number | null
  envoye_email: string | null
  envoye_at: string | null
  intervention_id: string | null
  client_id: string | null
  client_nom: string | null
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
  pdf_url: string | null
  created_at: string
}

type AvisGoogleItem = {
  id: string
  channel: 'email' | 'sms'
  status: 'pending' | 'sent' | 'canceled' | 'missing'
  label: string
  clientNom: string | null
  destinataire: string | null
  ville: string | null
  sendAt: string | null
  updatedAt: string | null
  interventionId: string | null
  href: string | null
  day: number | null
  manual: boolean
}

type AvisStats = {
  total: number
  sentMail: number
  sentSms: number
  pending: number
  canceled: number
  missing?: number
}

type SeptSummary = {
  dossiersMailEnvoye: number
  avecRelancesResend: number
  sansRelances: number
  idsResendStockes: number
  avisRecu: number
  brevoSmsRequests: number | null
  brevoSmsDelivered: number | null
  brevoSmsSoftBounces: number | null
  avisSmsPlanColumn: boolean
  registryCount: number
}

const DOC_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'devis', label: 'Devis' },
  { key: 'facture', label: 'Factures' },
  { key: 'rapport', label: 'Rapports' },
  { key: 'attestation', label: 'Attestations' },
] as const

const AVIS_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'email', label: 'Mails' },
  { key: 'sms', label: 'SMS' },
  { key: 'sent', label: 'Envoyés' },
  { key: 'pending', label: 'Planifiés' },
  { key: 'missing', label: 'Manquants' },
] as const

const TYPE_BADGE: Record<string, string> = {
  devis: 'bg-amber-100 text-amber-700',
  facture: 'bg-emerald-100 text-emerald-700',
  rapport: 'bg-slate-200 text-slate-700',
  attestation: 'bg-[#a18249]/15 text-[#6e5530]',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

export default function MailPage() {
  const [mainTab, setMainTab] = useState<'documents' | 'google'>('documents')
  const [documents, setDocuments] = useState<Document[]>([])
  const [avisItems, setAvisItems] = useState<AvisGoogleItem[]>([])
  const [avisStats, setAvisStats] = useState<AvisStats>({
    total: 0, sentMail: 0, sentSms: 0, pending: 0, canceled: 0, missing: 0,
  })
  const [september, setSeptember] = useState<SeptSummary | null>(null)
  const [diagHint, setDiagHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [docFilter, setDocFilter] = useState<string>('all')
  const [avisFilter, setAvisFilter] = useState<string>('all')

  const loadDocuments = useCallback(async () => {
    const res = await fetch('/api/historique', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    setDocuments(data.documents || [])
  }, [])

  const loadAvis = useCallback(async () => {
    const res = await fetch('/api/mail/avis-google', { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    setAvisItems(data.items || [])
    if (data.stats) setAvisStats(data.stats)
    setSeptember(data.september || null)
    setDiagHint(data.diagnostics?.hint || null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (mainTab === 'documents') await loadDocuments()
      else await loadAvis()
    } catch (e) {
      setError(errorMessage(e) || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [mainTab, loadDocuments, loadAvis])

  useEffect(() => { load() }, [load])

  const filteredDocs = useMemo(() => {
    if (docFilter === 'all') return documents
    return documents.filter(d => d.type === docFilter)
  }, [documents, docFilter])

  const docStats = useMemo(() => {
    const envoyes = documents.filter(d => d.envoye_at)
    return {
      total: documents.length,
      envoyes: envoyes.length,
      nonEnvoyes: documents.length - envoyes.length,
    }
  }, [documents])

  const filteredAvis = useMemo(() => {
    return avisItems.filter(item => {
      if (avisFilter === 'email') return item.channel === 'email'
      if (avisFilter === 'sms') return item.channel === 'sms'
      if (avisFilter === 'sent') return item.status === 'sent'
      if (avisFilter === 'pending') return item.status === 'pending'
      if (avisFilter === 'missing') return item.status === 'missing'
      return true
    })
  }, [avisItems, avisFilter])

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <LtdbLogoLink variant="nav" />
          <div className="text-[11px] opacity-70">Emails & SMS envoyés</div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-3">
        <AppTabs />
      </div>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Onglets Documents / Google */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          <button
            type="button"
            onClick={() => setMainTab('documents')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition ${
              mainTab === 'documents'
                ? 'border-[#0e2a52] text-[#0e2a52]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Documents
          </button>
          <button
            type="button"
            onClick={() => setMainTab('google')}
            className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition inline-flex items-center gap-1.5 ${
              mainTab === 'google'
                ? 'border-[#4285F4] text-[#1a73e8]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <GoogleMark />
            Avis Google
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-lg">Chargement…</div>
        ) : mainTab === 'documents' ? (
          <DocumentsPanel
            filter={docFilter}
            setFilter={setDocFilter}
            onRefresh={load}
            stats={docStats}
            error={error}
            filtered={filteredDocs}
          />
        ) : (
          <AvisGooglePanel
            filter={avisFilter}
            setFilter={setAvisFilter}
            onRefresh={load}
            stats={avisStats}
            september={september}
            diagHint={diagHint}
            error={error}
            filtered={filteredAvis}
          />
        )}
      </main>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function DocumentsPanel({
  filter, setFilter, onRefresh, stats, error, filtered,
}: {
  filter: string
  setFilter: (k: string) => void
  onRefresh: () => void
  stats: { total: number; envoyes: number; nonEnvoyes: number }
  error: string
  filtered: Document[]
}) {
  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          {DOC_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                filter === f.key
                  ? 'bg-[#0e2a52] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button onClick={onRefresh} className="ml-auto px-4 py-2 rounded-full text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
            ↻ Rafraîchir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Total docs" value={stats.total} color="text-slate-600" />
        <StatCard label="Envoyés" value={stats.envoyes} color="text-emerald-600" />
        <StatCard label="Non envoyés" value={stats.nonEnvoyes} color="text-amber-500" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">N°</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut envoi</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Destinataire</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Aucun document trouvé
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${TYPE_BADGE[d.type] || 'bg-slate-100 text-slate-600'}`}>
                        {d.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      {d.numero || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-medium">{d.client_nom || '—'}</div>
                      {d.client_ville && (
                        <div className="text-xs text-slate-400">{d.client_ville}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell whitespace-nowrap">
                      {d.date_emission ? fmtDateFR(d.date_emission.slice(0, 10)) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {d.envoye_at ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          ✓ Envoyé le {fmtDateFR(d.envoye_at.slice(0, 10))}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Non envoyé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell max-w-[180px] truncate">
                      {d.envoye_email || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        {(d.type === 'facture' || d.type === 'devis' || d.type === 'attestation') && (
                          <ResendEmailButton doc={d} />
                        )}
                        {d.type === 'rapport' && d.intervention_id && (
                          <a
                            href={`/intervention/${d.intervention_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition"
                          >
                            📧 Envoyer rapport
                          </a>
                        )}
                        {d.type === 'rapport' && !d.intervention_id && (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function AvisGooglePanel({
  filter, setFilter, onRefresh, stats, september, diagHint, error, filtered,
}: {
  filter: string
  setFilter: (k: string) => void
  onRefresh: () => void
  stats: AvisStats
  september: SeptSummary | null
  diagHint: string | null
  error: string
  filtered: AvisGoogleItem[]
}) {
  return (
    <>
      {september && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-2">
          <h3 className="text-sm font-black text-[#0e2a52]">Bilan septembre 2026 — avis Google</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div><span className="text-slate-500">Dossiers mailés</span><div className="text-xl font-black">{september.dossiersMailEnvoye}</div></div>
            <div><span className="text-slate-500">Avec relances mail</span><div className="text-xl font-black text-emerald-600">{september.avecRelancesResend}</div></div>
            <div><span className="text-slate-500">Sans relance</span><div className="text-xl font-black text-red-600">{september.sansRelances}</div></div>
            <div><span className="text-slate-500">SMS Brevo livrés</span><div className="text-xl font-black">{september.brevoSmsDelivered ?? '—'}</div></div>
          </div>
          <p className="text-xs text-slate-600">
            {september.idsResendStockes} mail(s) Resend planifiés · {september.brevoSmsRequests ?? 0} SMS demandés · {september.brevoSmsSoftBounces ?? 0} soft bounce
            {!september.avisSmsPlanColumn && (
              <span className="block mt-1 text-red-700 font-semibold">
                Colonne avis_sms_plan absente en base → les SMS auto J+2 n’ont pas pu être stockés. À corriger dans Supabase (migration 021).
              </span>
            )}
          </p>
        </div>
      )}

      {diagHint && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-sm font-medium">
          ⚠ {diagHint}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <p className="text-sm text-slate-600 mb-3">
          Historique des relances avis Google : mails Resend et SMS Brevo (planifiés, envoyés, annulés, manquants).
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {AVIS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                filter === f.key
                  ? 'bg-[#1a73e8] text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button onClick={onRefresh} className="ml-auto px-4 py-2 rounded-full text-sm font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
            ↻ Rafraîchir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        <StatCard label="Mails envoyés" value={stats.sentMail} color="text-[#1a73e8]" />
        <StatCard label="SMS envoyés" value={stats.sentSms} color="text-emerald-600" />
        <StatCard label="Planifiés" value={stats.pending} color="text-amber-500" />
        <StatCard label="Manquants" value={stats.missing || 0} color="text-red-600" />
        <StatCard label="Annulés" value={stats.canceled} color="text-slate-500" />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Canal</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Échéance</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Destinataire</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Aucun envoi avis Google enregistré
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.status === 'missing'
                          ? 'bg-red-100 text-red-800'
                          : item.channel === 'sms'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.status === 'missing' ? 'Manquant' : item.channel === 'sms' ? 'SMS' : 'Mail'}
                        {item.day != null && item.day > 0 ? ` J+${item.day}` : item.manual ? ' manuel' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-medium">{item.clientNom || '—'}</div>
                      {item.ville && <div className="text-xs text-slate-400">{item.ville}</div>}
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.label}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell whitespace-nowrap text-xs">
                      {fmtDateTime(item.sendAt)}
                    </td>
                    <td className="px-4 py-3">
                      <AvisStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell max-w-[180px] truncate">
                      {item.destinataire || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.href ? (
                        <a
                          href={item.href}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                        >
                          Voir
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function AvisStatusBadge({ status }: { status: AvisGoogleItem['status'] }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        ✓ Envoyé
      </span>
    )
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        Annulé
      </span>
    )
  }
  if (status === 'missing') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        Pas planifié
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
      Planifié
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-black mt-1 ${color}`}>{value}</div>
    </div>
  )
}

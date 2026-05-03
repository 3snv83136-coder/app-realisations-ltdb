'use client'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import AppTabs from "@/components/AppTabs"

const InterventionMap = dynamic(() => import('@/components/InterventionMap'), { ssr: false })
const InterventionRapportDownloadButton = dynamic(
  () => import('@/components/InterventionRapportDownloadButton'),
  { ssr: false },
)

type Statut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee'

type InterventionDetail = {
  id: string
  reference: string | null
  client_id: string | null
  technicien_id: string | null
  agence: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_prevue: string | null
  heure_prevue: string | null
  duree_estimee_min: number | null
  date_realisee: string | null
  urgence: boolean
  statut: Statut
  prix_prevu: number | null
  notes_internes: string | null
  publie_slug: string | null
  rapport_json: any
  photos_urls: string[] | null
  created_at: string
  updated_at: string
}

type ClientDetail = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

type TechnicienDetail = {
  id: string
  nom: string
  email: string | null
  telephone: string | null
  agence: string | null
}

const STATUT_LABEL: Record<Statut, string> = {
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

const STATUT_BADGE: Record<Statut, string> = {
  planifiee: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-amber-100 text-amber-700',
  terminee: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-slate-200 text-slate-600',
}

function fmtDateFR(iso: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtEUR(n: number | null): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function InterventionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [intervention, setIntervention] = useState<InterventionDetail | null>(null)
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [technicien, setTechnicien] = useState<TechnicienDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionInProgress, setActionInProgress] = useState(false)
  const [actionMsg, setActionMsg] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/interventions/${params.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setIntervention(data.intervention)
      setClient(data.client)
      setTechnicien(data.technicien)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params.id])

  async function updateStatut(statut: Statut) {
    if (!intervention) return
    setActionInProgress(true); setError(''); setActionMsg('')
    try {
      const res = await fetch(`/api/interventions/${intervention.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setIntervention(data.intervention)
      setActionMsg(`Statut mis à jour : ${STATUT_LABEL[statut]}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionInProgress(false)
    }
  }

  async function hardDelete() {
    if (!intervention) return
    const confirm1 = confirm('Supprimer DÉFINITIVEMENT cette intervention ? Cette action est irréversible.')
    if (!confirm1) return
    const confirm2 = prompt('Tape SUPPRIMER pour confirmer la suppression définitive.')
    if (confirm2 !== 'SUPPRIMER') return
    setActionInProgress(true); setError('')
    try {
      const res = await fetch(`/api/interventions/${intervention.id}?hard=1`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      router.push('/planning')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setActionInProgress(false)
    }
  }

  function goToRapport() {
    if (!intervention) return
    const prefill = {
      intervention_id: intervention.id,
      clientNom: client?.nom || '',
      clientEmail: client?.email || '',
      adresse: intervention.adresse_chantier || client?.adresse || '',
      ville: intervention.ville || client?.ville || '',
      codePostal: intervention.code_postal || client?.code_postal || '',
      dateIntervention: intervention.date_prevue || new Date().toISOString().slice(0, 10),
      typeIntervention: intervention.type_intervention || '',
      technicienNom: technicien?.nom || '',
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ltdb_intervention_prefill', JSON.stringify(prefill))
    }
    router.push('/nouveau')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 py-2">
          <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-10 text-center text-slate-500">Chargement…</div>
      </div>
    )
  }

  if (error || !intervention) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 py-2">
          <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
        </div>
        <div className="max-w-4xl mx-auto px-4 py-10">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
            {error || 'Intervention introuvable'}
          </div>
          <Link href="/planning" className="inline-block mt-4 text-blue-600 hover:underline font-semibold">← Retour au planning</Link>
        </div>
      </div>
    )
  }

  const adresseComplete = [
    intervention.adresse_chantier,
    [intervention.code_postal, intervention.ville].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b border-slate-200 py-2">
        <div className="max-w-4xl mx-auto px-4"><AppTabs /></div>
      </div>

      <nav className="bg-[#0e2a52] text-white px-4 py-3 sm:px-6 sm:py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-base sm:text-lg leading-tight">{intervention.type_intervention || 'Intervention'}</span>
              {intervention.urgence && <span className="text-[10px] font-bold bg-red-500 px-2 py-0.5 rounded-full">🚨 URG</span>}
            </div>
            <div className="text-[11px] opacity-70 truncate">
              {intervention.reference || intervention.id.slice(0, 8)}
              {intervention.agence ? ` · ${intervention.agence}` : ''}
            </div>
          </div>
          <Link href="/planning" className="text-sm font-semibold bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition">
            ← Planning
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {actionMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm">{actionMsg}</div>
        )}

        {/* Statut & actions */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Statut</div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${STATUT_BADGE[intervention.statut]}`}>
                {STATUT_LABEL[intervention.statut]}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {intervention.statut === 'planifiee' && (
                <button
                  onClick={() => updateStatut('en_cours')}
                  disabled={actionInProgress}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                >
                  ▶ Démarrer
                </button>
              )}
              {(intervention.statut === 'planifiee' || intervention.statut === 'en_cours') && (
                <>
                  <button
                    onClick={goToRapport}
                    className="bg-[#0e2a52] hover:bg-[#0a2047] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition"
                  >
                    📄 Aller au rapport
                  </button>
                  <button
                    onClick={() => updateStatut('terminee')}
                    disabled={actionInProgress}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                  >
                    ✓ Terminer
                  </button>
                </>
              )}
              {intervention.statut !== 'annulee' && intervention.statut !== 'terminee' && (
                <button
                  onClick={() => {
                    if (confirm('Annuler cette intervention ? (statut → annulée, conservée dans l\'historique)')) updateStatut('annulee')
                  }}
                  disabled={actionInProgress}
                  className="bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                >
                  ✕ Annuler
                </button>
              )}
              <button
                onClick={hardDelete}
                disabled={actionInProgress}
                className="bg-white border-2 border-red-300 text-red-700 hover:bg-red-50 px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition"
                title="Supprime définitivement de la base de données — irréversible"
              >
                🗑 Supprimer
              </button>
            </div>
          </div>
          {intervention.rapport_json && Object.keys(intervention.rapport_json || {}).length > 0 && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-0.5">Rapport d&apos;intervention</div>
                <div className="text-sm text-slate-700">PDF disponible — visualiser ou télécharger.</div>
              </div>
              <InterventionRapportDownloadButton
                intervention={{
                  id: intervention.id,
                  reference: intervention.reference,
                  type_intervention: intervention.type_intervention,
                  adresse_chantier: intervention.adresse_chantier,
                  ville: intervention.ville,
                  code_postal: intervention.code_postal,
                  date_realisee: intervention.date_realisee,
                  date_prevue: intervention.date_prevue,
                  rapport_json: intervention.rapport_json,
                  photos_urls: intervention.photos_urls,
                  client_nom: client?.nom || null,
                  client_adresse: client?.adresse || null,
                  client_code_postal: client?.code_postal || null,
                  client_ville: client?.ville || null,
                  technicien_nom: technicien?.nom || null,
                }}
              />
            </div>
          )}
        </section>

        {/* Date / heure / type */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InfoCell label="Date prévue" value={fmtDateFR(intervention.date_prevue)} />
          <InfoCell label="Heure" value={intervention.heure_prevue ? intervention.heure_prevue.slice(0, 5) : '—'} />
          <InfoCell label="Durée estimée" value={intervention.duree_estimee_min ? `${intervention.duree_estimee_min} min` : '—'} />
          <InfoCell label="Type" value={intervention.type_intervention || '—'} />
          <InfoCell label="Urgence" value={intervention.urgence ? '🚨 Oui' : 'Non'} />
          <InfoCell label="Prix prévu" value={fmtEUR(intervention.prix_prevu)} />
        </section>

        {/* Client */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Client</h2>
          {client ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoCell label="Nom" value={client.nom} />
              <InfoCell label="Téléphone" value={client.telephone ? <a href={`tel:${client.telephone}`} className="text-blue-600 hover:underline font-bold">{client.telephone}</a> : '—'} />
              <InfoCell label="Email" value={client.email ? <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">{client.email}</a> : '—'} />
              <InfoCell label="Ville" value={[client.code_postal, client.ville].filter(Boolean).join(' ') || '—'} />
              <div className="sm:col-span-2">
                <InfoCell label="Adresse client" value={client.adresse || '—'} />
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Aucun client lié</p>
          )}
        </section>

        {/* Chantier + map */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Chantier</h2>
            {adresseComplete && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseComplete)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-blue-700 hover:text-blue-900"
              >
                🗺 Itinéraire Maps →
              </a>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCell label="Adresse" value={intervention.adresse_chantier || '—'} />
            <InfoCell label="Ville" value={[intervention.code_postal, intervention.ville].filter(Boolean).join(' ') || '—'} />
          </div>
          <InterventionMap
            adresse={intervention.adresse_chantier ?? undefined}
            ville={intervention.ville ?? undefined}
            codePostal={intervention.code_postal ?? undefined}
            showCadastre
            className="h-80 rounded-xl overflow-hidden"
          />
        </section>

        {/* Technicien */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Technicien assigné</h2>
          {technicien ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoCell label="Nom" value={technicien.nom} />
              <InfoCell label="Agence" value={technicien.agence || '—'} />
              <InfoCell label="Téléphone" value={technicien.telephone ? <a href={`tel:${technicien.telephone}`} className="text-blue-600 hover:underline font-bold">{technicien.telephone}</a> : '—'} />
              <InfoCell label="Email" value={technicien.email || '—'} />
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">Aucun technicien assigné</p>
          )}
        </section>

        {/* Notes */}
        {intervention.notes_internes && (
          <section className="bg-amber-50 rounded-2xl border border-amber-200 p-5 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800">Notes internes</h2>
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{intervention.notes_internes}</p>
          </section>
        )}
      </main>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">{label}</div>
      <div className="text-sm text-slate-700 font-semibold">{value}</div>
    </div>
  )
}

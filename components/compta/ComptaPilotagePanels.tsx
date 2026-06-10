'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import { moisPrecedent, periodeLabel } from "@/lib/compta-kpis"

export { RapprochementTab } from "@/components/compta/RapprochementTab"

// =====================================================================
// Types
// =====================================================================

type Releve = {
  id: string
  periode_annee: number
  periode_mois: number
  pdf_url: string | null
  fichier_nom: string | null
  nb_operations: number
  solde_fin_mois: number | null
  uploaded_at: string
}

type PreBilanSnapshot = {
  periode_label?: string
  kpis?: {
    ca_ht: number
    dep_ht: number
    resultat_brut_ht: number
    tva_collectee: number
    tva_deductible: number
  }
  taux_rapprochement?: number
  alertes?: string[]
  releve_present?: boolean
}

type PreBilanRow = {
  id: string
  periode_annee?: number
  periode_mois?: number
  statut: string
  snapshot: PreBilanSnapshot
  comptable_email: string | null
  envoye_at: string | null
  valide_at: string | null
}

function anneesDisponibles(): number[] {
  const y = new Date().getFullYear()
  const out: number[] = []
  for (let a = y + 1; a >= 2020; a--) out.push(a)
  return out
}

const STATUT_PRE_BILAN: Record<string, string> = {
  brouillon: "bg-slate-200 text-slate-700",
  envoye: "bg-blue-100 text-blue-800",
  valide: "bg-emerald-100 text-emerald-800",
}

// =====================================================================
// Relevés bancaires
// =====================================================================

export function RelevesBancairesTab() {
  const def = moisPrecedent()
  const [annee, setAnnee] = useState(def.annee)
  const [mois, setMois] = useState(def.mois)
  const [solde, setSolde] = useState("")
  const [pdf, setPdf] = useState<File | null>(null)
  const [csv, setCsv] = useState<File | null>(null)
  const [releves, setReleves] = useState<Releve[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const res = await fetch("/api/comptabilite/releves", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setReleves(data.releves || [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!pdf) { setErr("PDF du relevé requis"); return }
    setUploading(true)
    setErr("")
    setMsg("")
    try {
      const fd = new FormData()
      fd.set("periode_annee", String(annee))
      fd.set("periode_mois", String(mois))
      fd.set("pdf", pdf)
      if (csv) fd.set("csv", csv)
      if (solde.trim()) fd.set("solde_fin_mois", solde.trim())

      const res = await fetch("/api/comptabilite/releves/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      setMsg(
        data.info
          || `Relevé ${periodeLabel(annee, mois)} enregistré${data.nb_operations ? ` — ${data.nb_operations} opération(s) importée(s)` : ""}.`,
      )
      setPdf(null)
      setCsv(null)
      setSolde("")
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload échoué")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(r: Releve) {
    const label = periodeLabel(r.periode_annee, r.periode_mois)
    const detail = r.nb_operations > 0
      ? `\n\nLes ${r.nb_operations} opération(s) importée(s) avec ce relevé seront aussi supprimées.`
      : ""
    if (!window.confirm(`Effacer le relevé de ${label} ?${detail}`)) return

    setDeletingId(r.id)
    setErr("")
    setMsg("")
    try {
      const res = await fetch(`/api/comptabilite/releves/${r.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg(
        `Relevé ${label} effacé${data.operations_deleted ? ` (${data.operations_deleted} opération(s) supprimée(s))` : ""}.`,
      )
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Suppression échouée")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-[#0e2a52] mb-1">📎 Déposer un relevé bancaire</h3>
        <p className="text-sm text-slate-500 mb-4">
          Uploadez le PDF mensuel. Optionnel : CSV export banque (Qonto, etc.) pour importer les lignes et faire le rapprochement.
        </p>

        <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Mois</span>
            <div className="flex gap-2">
              <select
                value={mois}
                onChange={e => setMois(Number(e.target.value))}
                className="border-2 border-slate-200 rounded-xl px-3 py-2 bg-white flex-1"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" })}</option>
                ))}
              </select>
              <input
                type="number"
                value={annee}
                onChange={e => setAnnee(Number(e.target.value))}
                className="border-2 border-slate-200 rounded-xl px-3 py-2 w-24"
                min={2020}
                max={2100}
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Solde fin de mois (€)</span>
            <input
              type="text"
              inputMode="decimal"
              value={solde}
              onChange={e => setSolde(e.target.value)}
              placeholder="Optionnel"
              className="border-2 border-slate-200 rounded-xl px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-bold uppercase text-slate-500">PDF relevé *</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setPdf(e.target.files?.[0] || null)}
              className="text-sm"
              required
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] font-bold uppercase text-slate-500">CSV opérations (optionnel)</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={e => setCsv(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <span className="text-[11px] text-slate-400">
              Qonto : export simplifié (Date, Contrepartie, Montant) ou avec colonnes Débit/Crédit. Séparateur ; recommandé.
            </span>
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={uploading}
              className="bg-[#0e2a52] text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {uploading ? "Envoi…" : "📤 Uploader le relevé"}
            </button>
          </div>
        </form>

        {msg && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-sm">{msg}</div>}
        {err && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{err}</div>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-[#0e2a52] mb-3">Historique des relevés</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : releves.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun relevé déposé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Période</th>
                  <th className="py-2 pr-3">Opérations</th>
                  <th className="py-2 pr-3">Solde fin</th>
                  <th className="py-2 pr-3">Déposé le</th>
                  <th className="py-2 pr-3">PDF</th>
                  <th className="py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {releves.map(r => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">{periodeLabel(r.periode_annee, r.periode_mois)}</td>
                    <td className="py-2 pr-3">{r.nb_operations}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.solde_fin_mois != null ? fmtEUR(r.solde_fin_mois) : "—"}</td>
                    <td className="py-2 pr-3">{fmtDateFR(r.uploaded_at.slice(0, 10))}</td>
                    <td className="py-2 pr-3">
                      {r.pdf_url ? (
                        <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Voir</a>
                      ) : "—"}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                        className="text-xs font-bold px-2 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === r.id ? "…" : "Effacer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
        <strong>Rappel :</strong> alerte email automatique le <strong>5 de chaque mois</strong> si le relevé du mois précédent n&apos;est pas déposé.
        Configurez <code className="text-xs bg-amber-100 px-1 rounded">COMPTA_ALERT_EMAIL</code> dans Supabase → parametres.
      </div>
    </div>
  )
}

// =====================================================================
// Pré-bilan
// =====================================================================

export function PreBilanTab() {
  const def = moisPrecedent()
  const [annee, setAnnee] = useState(def.annee)
  const [mois, setMois] = useState(def.mois)
  const [preBilan, setPreBilan] = useState<PreBilanRow | null>(null)
  const [preBilansAnnee, setPreBilansAnnee] = useState<PreBilanRow[]>([])
  const [emailComptable, setEmailComptable] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingAnnee, setLoadingAnnee] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")

  const loadAnnee = useCallback(async () => {
    setLoadingAnnee(true)
    try {
      const res = await fetch(`/api/comptabilite/pre-bilan?annee=${annee}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPreBilansAnnee((data.pre_bilans || []) as PreBilanRow[])
    } catch {
      setPreBilansAnnee([])
    } finally {
      setLoadingAnnee(false)
    }
  }, [annee])

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const [resMois, _] = await Promise.all([
        fetch(`/api/comptabilite/pre-bilan?annee=${annee}&mois=${mois}`, { cache: "no-store" }),
        loadAnnee(),
      ])
      const data = await resMois.json()
      if (!resMois.ok) throw new Error(data.error || `HTTP ${resMois.status}`)
      setPreBilan(data.pre_bilan || null)
      if (data.pre_bilan?.comptable_email) setEmailComptable(data.pre_bilan.comptable_email)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [annee, mois, loadAnnee])

  useEffect(() => { load() }, [load])

  const preBilanParMois = useMemo(() => {
    const map: Record<number, PreBilanRow> = {}
    for (const p of preBilansAnnee) {
      if (p.periode_mois) map[p.periode_mois] = p
    }
    return map
  }, [preBilansAnnee])

  async function generate() {
    setGenerating(true)
    setMsg("")
    setErr("")
    try {
      const res = await fetch("/api/comptabilite/pre-bilan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annee, mois }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg("Pré-bilan généré / actualisé.")
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setGenerating(false)
    }
  }

  async function sendToComptable() {
    setSending(true)
    setMsg("")
    setErr("")
    try {
      const res = await fetch("/api/comptabilite/pre-bilan/envoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annee, mois, email: emailComptable || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg("Pré-bilan envoyé au comptable par email.")
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur envoi")
    } finally {
      setSending(false)
    }
  }

  async function valider() {
    if (!preBilan?.id) return
    setErr("")
    try {
      const res = await fetch(`/api/comptabilite/pre-bilan/${preBilan.id}/valider`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valide_par: "Direction LTDB" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg("Pré-bilan marqué comme validé.")
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    }
  }

  const snap = preBilan?.snapshot
  const k = snap?.kpis

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-[#0e2a52] mb-3">📋 Pré-bilan comptable</h3>
        <p className="text-sm text-slate-500 mb-4">
          Synthèse mensuelle pour pilotage interne et validation par l&apos;expert-comptable (FEC exportable depuis l&apos;onglet Export).
        </p>

        <div className="flex flex-wrap gap-3 items-end mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Année</span>
            <select
              value={annee}
              onChange={e => setAnnee(Number(e.target.value))}
              className="border-2 border-slate-200 rounded-xl px-3 py-2 bg-white font-bold text-[#0e2a52] min-w-[100px]"
            >
              {anneesDisponibles().map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">Mois</span>
            <select
              value={mois}
              onChange={e => setMois(Number(e.target.value))}
              className="border-2 border-slate-200 rounded-xl px-3 py-2 bg-white min-w-[140px]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>
                  {new Date(annee, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" })}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={generate} disabled={generating} className="bg-[#0e2a52] text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">
            {generating ? "…" : "🔄 Générer"}
          </button>
        </div>

        <div className="mb-5">
          <div className="text-[11px] font-bold uppercase text-slate-500 mb-2">
            Vue annuelle {annee}
            {loadingAnnee ? " · chargement…" : ` · ${preBilansAnnee.length} mois généré(s)`}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const row = preBilanParMois[m]
              const actif = m === mois
              const res = row?.snapshot?.kpis?.resultat_brut_ht
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMois(m)}
                  className={`text-left rounded-xl border p-2 transition ${
                    actif
                      ? "border-[#0e2a52] bg-blue-50 ring-2 ring-[#0e2a52]/20"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    {new Date(annee, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}
                  </div>
                  {row ? (
                    <>
                      <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUT_PRE_BILAN[row.statut] || STATUT_PRE_BILAN.brouillon}`}>
                        {row.statut}
                      </span>
                      {typeof res === "number" && (
                        <div className={`text-xs font-bold tabular-nums mt-1 ${res >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {fmtEUR(res)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-400 mt-1">—</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <h4 className="font-bold text-[#0e2a52] text-sm mb-2">
          Détail — {periodeLabel(annee, mois)}
        </h4>

        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : !preBilan ? (
          <p className="text-sm text-slate-500">Aucun pré-bilan pour cette période — cliquez sur Générer.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUT_PRE_BILAN[preBilan.statut] || STATUT_PRE_BILAN.brouillon}`}>
                {preBilan.statut}
              </span>
              {snap?.releve_present === false && (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Relevé manquant</span>
              )}
              {typeof snap?.taux_rapprochement === "number" && (
                <span className="text-xs text-slate-500">Rapprochement : {snap.taux_rapprochement} %</span>
              )}
            </div>

            {k && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <KpiCard label="CA HT" value={fmtEUR(k.ca_ht)} />
                <KpiCard label="Dépenses HT" value={fmtEUR(k.dep_ht)} />
                <KpiCard label="Résultat brut HT" value={fmtEUR(k.resultat_brut_ht)} highlight />
                <KpiCard label="TVA collectée" value={fmtEUR(k.tva_collectee)} />
                <KpiCard label="TVA déductible" value={fmtEUR(k.tva_deductible)} />
              </div>
            )}

            {snap?.alertes && snap.alertes.length > 0 && (
              <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 list-disc pl-5">
                {snap.alertes.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </div>
        )}

        {msg && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-sm">{msg}</div>}
        {err && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{err}</div>}
      </div>

      {preBilan && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
          <h4 className="font-bold text-[#0e2a52]">Envoi au comptable</h4>
          <input
            type="email"
            value={emailComptable}
            onChange={e => setEmailComptable(e.target.value)}
            placeholder="email@expert-comptable.fr"
            className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={sendToComptable}
              disabled={sending}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
            >
              {sending ? "Envoi…" : "📧 Envoyer au comptable"}
            </button>
            {preBilan.statut !== "valide" && (
              <button type="button" onClick={valider} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm">
                ✓ Marquer validé
              </button>
            )}
          </div>
          {preBilan.envoye_at && (
            <p className="text-xs text-slate-500">Envoyé le {fmtDateFR(preBilan.envoye_at.slice(0, 10))}</p>
          )}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? "border-[#0e2a52] bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="text-[10px] font-bold uppercase text-slate-500">{label}</div>
      <div className={`text-lg font-black tabular-nums ${highlight ? "text-[#0e2a52]" : "text-slate-800"}`}>{value}</div>
    </div>
  )
}

/** Sélecteur mois pour rapprochement (lié à la période globale). */
export function RapprochementPeriodPicker({
  annee, mois, setAnnee, setMois,
}: {
  annee: number; mois: number
  setAnnee: (n: number) => void; setMois: (n: number) => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase text-slate-500">Période rapprochement</span>
        <div className="flex gap-2">
          <select value={mois} onChange={e => setMois(Number(e.target.value))} className="border-2 border-slate-200 rounded-xl px-3 py-2 bg-white">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" })}</option>
            ))}
          </select>
          <input type="number" value={annee} onChange={e => setAnnee(Number(e.target.value))} className="border-2 border-slate-200 rounded-xl px-3 py-2 w-24" />
        </div>
      </label>
    </div>
  )
}

export function monthFromDateRange(from: string): { annee: number; mois: number } {
  const m = /^(\d{4})-(\d{2})/.exec(from)
  if (m) return { annee: Number(m[1]), mois: Number(m[2]) }
  const d = moisPrecedent()
  return d
}

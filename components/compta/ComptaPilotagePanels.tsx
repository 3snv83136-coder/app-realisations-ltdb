'use client'

import { useCallback, useEffect, useState } from "react"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import { moisPrecedent, periodeLabel } from "@/lib/compta-kpis"

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

type Operation = {
  id: string
  date_operation: string
  libelle: string
  debit: number
  credit: number
  lettre: boolean
  document_id: string | null
  facture_fournisseur_id: string | null
}

type PreBilanRow = {
  id: string
  statut: string
  snapshot: {
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
  comptable_email: string | null
  envoye_at: string | null
  valide_at: string | null
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
            <span className="text-[11px] text-slate-400">Colonnes : Date ; Libellé ; Débit ; Crédit</span>
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
                  <th className="py-2">PDF</th>
                </tr>
              </thead>
              <tbody>
                {releves.map(r => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">{periodeLabel(r.periode_annee, r.periode_mois)}</td>
                    <td className="py-2 pr-3">{r.nb_operations}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.solde_fin_mois != null ? fmtEUR(r.solde_fin_mois) : "—"}</td>
                    <td className="py-2 pr-3">{fmtDateFR(r.uploaded_at.slice(0, 10))}</td>
                    <td className="py-2">
                      {r.pdf_url ? (
                        <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Voir</a>
                      ) : "—"}
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
// Rapprochement
// =====================================================================

export function RapprochementTab({ annee, mois }: { annee: number; mois: number }) {
  const [operations, setOperations] = useState<Operation[]>([])
  const [stats, setStats] = useState({ total: 0, lettrees: 0, non_lettrees: 0, taux_rapprochement: 0 })
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const res = await fetch(`/api/comptabilite/operations?annee=${annee}&mois=${mois}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setOperations(data.operations || [])
      setStats(data.stats || { total: 0, lettrees: 0, non_lettrees: 0, taux_rapprochement: 0 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [annee, mois])

  useEffect(() => { load() }, [load])

  async function autoMatch() {
    setMatching(true)
    setMsg("")
    setErr("")
    try {
      const res = await fetch("/api/comptabilite/operations/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annee, mois }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg(`${data.matched} rapprochement(s) automatique(s) effectué(s).`)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setMatching(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-[#0e2a52]">🏦 Rapprochement — {periodeLabel(annee, mois)}</h3>
            <p className="text-sm text-slate-500">
              {stats.lettrees}/{stats.total} lettrées · {stats.taux_rapprochement} %
            </p>
          </div>
          <button
            type="button"
            onClick={autoMatch}
            disabled={matching || stats.non_lettrees === 0}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {matching ? "…" : "⚡ Rapprochement auto"}
          </button>
        </div>

        {msg && <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-sm">{msg}</div>}
        {err && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{err}</div>}

        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : operations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune opération — uploadez un relevé avec CSV ou importez des lignes.</p>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Libellé</th>
                  <th className="py-2 pr-2 text-right">Débit</th>
                  <th className="py-2 pr-2 text-right">Crédit</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {operations.map(op => (
                  <tr key={op.id} className={`border-b border-slate-100 ${op.lettre ? "bg-emerald-50/50" : ""}`}>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDateFR(op.date_operation)}</td>
                    <td className="py-2 pr-2 max-w-[200px] truncate" title={op.libelle}>{op.libelle}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-red-700">{op.debit > 0 ? fmtEUR(op.debit) : ""}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-emerald-700">{op.credit > 0 ? fmtEUR(op.credit) : ""}</td>
                    <td className="py-2">
                      {op.lettre ? (
                        <span className="text-xs font-bold text-emerald-700">✓ Lettré</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-700">En attente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  const [emailComptable, setEmailComptable] = useState("")
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const res = await fetch(`/api/comptabilite/pre-bilan?annee=${annee}&mois=${mois}`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setPreBilan(data.pre_bilan || null)
      if (data.pre_bilan?.comptable_email) setEmailComptable(data.pre_bilan.comptable_email)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [annee, mois])

  useEffect(() => { load() }, [load])

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
            <span className="text-[11px] font-bold uppercase text-slate-500">Période</span>
            <div className="flex gap-2">
              <select value={mois} onChange={e => setMois(Number(e.target.value))} className="border-2 border-slate-200 rounded-xl px-3 py-2 bg-white">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString("fr-FR", { month: "long" })}</option>
                ))}
              </select>
              <input type="number" value={annee} onChange={e => setAnnee(Number(e.target.value))} className="border-2 border-slate-200 rounded-xl px-3 py-2 w-24" />
            </div>
          </label>
          <button type="button" onClick={generate} disabled={generating} className="bg-[#0e2a52] text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">
            {generating ? "…" : "🔄 Générer le pré-bilan"}
          </button>
        </div>

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

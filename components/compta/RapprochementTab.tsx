'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { fmtDateFR, fmtEUR } from "@/lib/format"
import { periodeLabel } from "@/lib/compta-kpis"
import type { CompteComptable } from "@/lib/compta-plan"
import { GROUPE_LABELS } from "@/lib/compta-plan"

type Operation = {
  id: string
  date_operation: string
  libelle: string
  debit: number
  credit: number
  lettre: boolean
  document_id: string | null
  facture_fournisseur_id: string | null
  compte_num: string | null
  compte_lib: string | null
  categorie: string | null
}

type Recette = {
  id: string
  numero: string | null
  date_emission: string
  montant_ttc: number | null
  statut: string
  client_nom: string | null
}

type Depense = {
  id: string
  fournisseur: string
  numero: string | null
  date_facture: string
  montant_ttc: number
  categorie: string | null
}

type Suggestion = {
  operation_id: string
  type: "recette" | "depense"
  cible_id: string
  label: string
  montant: number
  score: number
}

export function RapprochementTab({ annee, mois }: { annee: number; mois: number }) {
  const [operations, setOperations] = useState<Operation[]>([])
  const [recettes, setRecettes] = useState<Recette[]>([])
  const [depenses, setDepenses] = useState<Depense[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [comptes, setComptes] = useState<CompteComptable[]>([])
  const [stats, setStats] = useState({ total: 0, lettrees: 0, non_lettrees: 0, taux_rapprochement: 0 })
  const [loading, setLoading] = useState(false)
  const [matching, setMatching] = useState(false)
  const [msg, setMsg] = useState("")
  const [err, setErr] = useState("")
  const [affectOp, setAffectOp] = useState<Operation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr("")
    try {
      const res = await fetch(
        `/api/comptabilite/operations?annee=${annee}&mois=${mois}&pour_affectation=1`,
        { cache: "no-store" },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setOperations((data.operations || []).map(normalizeOp))
      setRecettes(data.recettes || [])
      setDepenses(data.depenses || [])
      setSuggestions(data.suggestions || [])
      setStats(data.stats || { total: 0, lettrees: 0, non_lettrees: 0, taux_rapprochement: 0 })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [annee, mois])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch("/api/comptabilite/plan-comptable", { cache: "no-store" })
      .then(r => r.json())
      .then(d => setComptes(d.comptes || []))
      .catch(() => {})
  }, [])

  const recById = useMemo(() => Object.fromEntries(recettes.map(r => [r.id, r])), [recettes])
  const depById = useMemo(() => Object.fromEntries(depenses.map(d => [d.id, d])), [depenses])
  const sugByOp = useMemo(() => Object.fromEntries(suggestions.map(s => [s.operation_id, s])), [suggestions])

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
      let text = `${data.matched} rapprochement(s) auto.`
      if (data.skipped_no_compte > 0) {
        text += ` ${data.skipped_no_compte} nécessitent un compte manuel (bouton Affecter).`
      }
      setMsg(text)
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setMatching(false)
    }
  }

  async function applySuggestion(s: Suggestion) {
    const body: Record<string, unknown> = {
      lettre: true,
      document_id: s.type === "recette" ? s.cible_id : null,
      facture_fournisseur_id: s.type === "depense" ? s.cible_id : null,
    }
    if (s.type === "depense") {
      const dep = depById[s.cible_id]
      if (dep?.categorie) body.categorie = dep.categorie
      else {
        setAffectOp(operations.find(o => o.id === s.operation_id) || null)
        setErr("Facture fournisseur sans catégorie — choisissez le compte comptable.")
        return
      }
    }
    try {
      const res = await fetch(`/api/comptabilite/operations/${s.operation_id}/lettrer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needs_compte) setAffectOp(operations.find(o => o.id === s.operation_id) || null)
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      setMsg("Affectation enregistrée.")
      load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur")
    }
  }

  function labelAffectation(op: Operation): string {
    if (!op.lettre) return ""
    if (op.document_id) {
      const r = recById[op.document_id]
      return r ? `Facture ${r.numero || "—"}${r.client_nom ? ` (${r.client_nom})` : ""}` : "Facture client"
    }
    if (op.facture_fournisseur_id) {
      const d = depById[op.facture_fournisseur_id]
      return d ? `${d.fournisseur}` : "Facture fournisseur"
    }
    if (op.compte_num) return `${op.compte_num} — ${op.compte_lib || ""}`
    return "Lettré (compte manquant)"
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

        <p className="text-xs text-slate-500 mb-3">
          Affectez chaque ligne à une <strong>facture</strong> ou à un <strong>compte comptable</strong> (PCG).
          Si le système n&apos;est pas sûr, il vous demandera de choisir le compte.
        </p>

        {msg && <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-sm">{msg}</div>}
        {err && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{err}</div>}

        {loading ? (
          <p className="text-sm text-slate-500">Chargement…</p>
        ) : operations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune opération — uploadez un relevé avec CSV.</p>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Libellé</th>
                  <th className="py-2 pr-2 text-right">Montant</th>
                  <th className="py-2 pr-2">Affectation</th>
                  <th className="py-2 pr-2">Compte</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {operations.map(op => {
                  const sug = sugByOp[op.id]
                  const montant = op.credit > 0 ? op.credit : op.debit
                  const sens = op.credit > 0 ? "encaissement" : "décaissement"
                  return (
                    <tr key={op.id} className={`border-b border-slate-100 ${op.lettre ? "bg-emerald-50/40" : ""}`}>
                      <td className="py-2 pr-2 whitespace-nowrap">{fmtDateFR(op.date_operation)}</td>
                      <td className="py-2 pr-2 max-w-[160px]">
                        <div className="truncate font-medium" title={op.libelle}>{op.libelle}</div>
                        <div className="text-[10px] text-slate-400">{sens}</div>
                      </td>
                      <td className={`py-2 pr-2 text-right tabular-nums font-bold ${op.credit > 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {fmtEUR(montant)}
                      </td>
                      <td className="py-2 pr-2 text-xs max-w-[140px]">
                        {op.lettre ? (
                          <span className="text-emerald-800">{labelAffectation(op)}</span>
                        ) : sug ? (
                          <span className="text-blue-700" title={`Score ${sug.score}`}>💡 {sug.label}</span>
                        ) : (
                          <span className="text-amber-700">Non affecté</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs font-mono text-slate-600">
                        {op.compte_num ? `${op.compte_num}` : op.lettre ? <span className="text-red-600">?</span> : "—"}
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {!op.lettre && sug && (
                            <button
                              type="button"
                              onClick={() => applySuggestion(sug)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200"
                            >
                              Accepter
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setErr(""); setAffectOp(op) }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#0e2a52] text-white hover:opacity-90"
                          >
                            {op.lettre ? "Modifier" : "Affecter"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {affectOp && (
        <AffectationModal
          operation={affectOp}
          recettes={recettes}
          depenses={depenses}
          comptes={comptes}
          onClose={() => setAffectOp(null)}
          onSaved={() => { setAffectOp(null); setMsg("Affectation enregistrée."); load() }}
          onError={setErr}
        />
      )}
    </div>
  )
}

function normalizeOp(o: Record<string, unknown>): Operation {
  return {
    id: o.id as string,
    date_operation: o.date_operation as string,
    libelle: (o.libelle as string) || "",
    debit: Number(o.debit) || 0,
    credit: Number(o.credit) || 0,
    lettre: !!o.lettre,
    document_id: (o.document_id as string | null) ?? null,
    facture_fournisseur_id: (o.facture_fournisseur_id as string | null) ?? null,
    compte_num: (o.compte_num as string | null) ?? null,
    compte_lib: (o.compte_lib as string | null) ?? null,
    categorie: (o.categorie as string | null) ?? null,
  }
}

// =====================================================================
// Modal affectation manuelle
// =====================================================================

function AffectationModal({
  operation: op,
  recettes,
  depenses,
  comptes,
  onClose,
  onSaved,
  onError,
}: {
  operation: Operation
  recettes: Recette[]
  depenses: Depense[]
  comptes: CompteComptable[]
  onClose: () => void
  onSaved: () => void
  onError: (m: string) => void
}) {
  const isCredit = op.credit > 0
  const montant = isCredit ? op.credit : op.debit

  const [mode, setMode] = useState<"facture" | "compte">(
    op.document_id || op.facture_fournisseur_id ? "facture" : "facture",
  )
  const [factureClientId, setFactureClientId] = useState(op.document_id || "")
  const [factureFournisseurId, setFactureFournisseurId] = useState(op.facture_fournisseur_id || "")
  const [compteNum, setCompteNum] = useState(op.compte_num || "")
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState("")

  const recettesOuvertes = recettes.filter(r => r.statut === "envoye" || r.statut === "brouillon")
  const selectedDep = depenses.find(d => d.id === factureFournisseurId)
  const needsCompteForDep = mode === "facture" && !isCredit && factureFournisseurId && !selectedDep?.categorie
  const showComptePicker = mode === "compte" || needsCompteForDep

  const comptesParGroupe = useMemo(() => {
    const map: Record<string, CompteComptable[]> = {}
    for (const c of comptes) {
      if (!map[c.groupe]) map[c.groupe] = []
      map[c.groupe].push(c)
    }
    return map
  }, [comptes])

  const selectedCompte = comptes.find(c => c.num === compteNum)

  async function save() {
    setLocalErr("")
    setSaving(true)
    try {
      const body: Record<string, unknown> = { lettre: true }

      if (mode === "facture") {
        if (isCredit) {
          if (!factureClientId) {
            setLocalErr("Sélectionnez une facture client ou passez en « Compte seul ».")
            return
          }
          body.document_id = factureClientId
          body.facture_fournisseur_id = null
        } else {
          if (!factureFournisseurId) {
            setLocalErr("Sélectionnez une facture fournisseur ou passez en « Compte seul ».")
            return
          }
          body.facture_fournisseur_id = factureFournisseurId
          body.document_id = null
          if (selectedDep?.categorie) body.categorie = selectedDep.categorie
          if (needsCompteForDep && compteNum) {
            body.compte_num = compteNum
            body.compte_lib = selectedCompte?.lib
          }
        }
      } else {
        body.document_id = null
        body.facture_fournisseur_id = null
        if (!compteNum) {
          setLocalErr("Choisissez le compte comptable de contrepartie.")
          return
        }
        body.compte_num = compteNum
        body.compte_lib = selectedCompte?.lib
      }

      const res = await fetch(`/api/comptabilite/operations/${op.id}/lettrer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onSaved()
    } catch (e) {
      const m = e instanceof Error ? e.message : "Erreur"
      setLocalErr(m)
      onError(m)
    } finally {
      setSaving(false)
    }
  }

  async function unletter() {
    setSaving(true)
    try {
      const res = await fetch(`/api/comptabilite/operations/${op.id}/lettrer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lettre: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onSaved()
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-[#0e2a52] text-lg">Affecter l&apos;opération</h3>
          <p className="text-sm text-slate-600 mt-1">{op.libelle}</p>
          <p className="text-sm font-bold mt-1">
            {fmtDateFR(op.date_operation)} · {isCredit ? "Encaissement" : "Décaissement"}{" "}
            <span className={isCredit ? "text-emerald-700" : "text-red-700"}>{fmtEUR(montant)}</span>
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("facture")}
              className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === "facture" ? "bg-[#0e2a52] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              📄 Lier une facture
            </button>
            <button
              type="button"
              onClick={() => setMode("compte")}
              className={`flex-1 py-2 rounded-xl text-sm font-bold ${mode === "compte" ? "bg-[#0e2a52] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              📒 Compte seul
            </button>
          </div>

          {mode === "facture" && isCredit && (
            <label className="block">
              <span className="text-[11px] font-bold uppercase text-slate-500">Facture client</span>
              <select
                value={factureClientId}
                onChange={e => setFactureClientId(e.target.value)}
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 bg-white text-sm"
              >
                <option value="">— Choisir —</option>
                {recettesOuvertes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.numero || r.id.slice(0, 8)} — {fmtEUR(r.montant_ttc || 0)} — {r.client_nom || "Client"}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Compte automatique : 411 Clients</p>
            </label>
          )}

          {mode === "facture" && !isCredit && (
            <label className="block">
              <span className="text-[11px] font-bold uppercase text-slate-500">Facture fournisseur</span>
              <select
                value={factureFournisseurId}
                onChange={e => setFactureFournisseurId(e.target.value)}
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 bg-white text-sm"
              >
                <option value="">— Choisir —</option>
                {depenses.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.fournisseur} — {fmtEUR(d.montant_ttc)} — {fmtDateFR(d.date_facture)}
                    {d.categorie ? ` (${d.categorie})` : ""}
                  </option>
                ))}
              </select>
              {selectedDep?.categorie ? (
                <p className="text-[10px] text-emerald-700 mt-1">Compte charge déduit de la catégorie « {selectedDep.categorie} »</p>
              ) : factureFournisseurId ? (
                <p className="text-[10px] text-amber-700 mt-1 font-bold">Pas de catégorie sur cette facture — choisissez le compte ci-dessous.</p>
              ) : null}
            </label>
          )}

          {showComptePicker && (
            <label className="block">
              <span className="text-[11px] font-bold uppercase text-slate-500">
                {needsCompteForDep ? "Compte de charge *" : "Compte comptable *"}
              </span>
              <select
                value={compteNum}
                onChange={e => setCompteNum(e.target.value)}
                className="mt-1 w-full border-2 border-slate-200 rounded-xl px-3 py-2 bg-white text-sm"
                required
              >
                <option value="">— Dans quel compte ? —</option>
                {(Object.keys(comptesParGroupe) as Array<keyof typeof GROUPE_LABELS>).map(g => (
                  <optgroup key={g} label={GROUPE_LABELS[g]}>
                    {comptesParGroupe[g]?.map(c => (
                      <option key={c.num} value={c.num}>{c.num} — {c.lib}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}

          {compteNum && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700">
              {isCredit
                ? `D 512000 Banque ${fmtEUR(montant)} / C ${compteNum} ${selectedCompte?.lib || ""}`
                : `D ${compteNum} ${selectedCompte?.lib || ""} / C 512000 Banque ${fmtEUR(montant)}`}
            </div>
          )}

          {localErr && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{localErr}</div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl font-bold bg-slate-100 text-slate-700">
              Annuler
            </button>
            {op.lettre && (
              <button type="button" onClick={unletter} disabled={saving} className="px-4 py-2 rounded-xl font-bold text-red-700 bg-red-50">
                Délettrer
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-xl font-bold bg-[#0e2a52] text-white disabled:opacity-50"
          >
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  )
}

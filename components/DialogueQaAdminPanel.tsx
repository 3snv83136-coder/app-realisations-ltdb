'use client'

import { useCallback, useEffect, useState } from "react"
import type { DialogueQa, DialogueQaItem } from "@/lib/types-documents"

type Props = {
  interventionId: string
  hasRapport: boolean
}

export default function DialogueQaAdminPanel({ interventionId, hasRapport }: Props) {
  const [dialogue, setDialogue] = useState<DialogueQa | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DialogueQaItem[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/interventions/${interventionId}/dialogue-qa`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDialogue(data.dialogue_qa || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [interventionId])

  useEffect(() => {
    void load()
  }, [load])

  async function regenerate() {
    if (!hasRapport) {
      setError("Génère le rapport d'abord.")
      return
    }
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch(`/api/interventions/${interventionId}/dialogue-qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDialogue(data.dialogue_qa || null)
      setEditing(false)
      setStatus("Dialogue régénéré.")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function startEdit() {
    setDraft(dialogue?.items?.map((it) => ({ ...it })) || [
      { role: "client", texte: "" },
      { role: "technicien", texte: "" },
    ])
    setEditing(true)
    setStatus(null)
  }

  function updateDraft(i: number, patch: Partial<DialogueQaItem>) {
    setDraft((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function addPair() {
    setDraft((prev) => [
      ...prev,
      { role: "client", texte: "" },
      { role: "technicien", texte: "" },
    ])
  }

  function removeAt(i: number) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function saveEdit() {
    setBusy(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch(`/api/interventions/${interventionId}/dialogue-qa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogue_qa: { items: draft } }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDialogue(data.dialogue_qa || null)
      setEditing(false)
      setStatus("Dialogue enregistré.")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-[#0e2a52]">Dialogue Q&amp;A (podcast écrit)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Section SEO sur la page réalisation — bulles client / technicien.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={startEdit}
                disabled={!dialogue || busy}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Éditer
              </button>
              <button
                type="button"
                onClick={() => void regenerate()}
                disabled={!hasRapport || busy}
                className="px-3 py-1.5 rounded-lg bg-[#0e2a52] text-white text-sm font-semibold hover:bg-[#0a2047] disabled:opacity-50"
              >
                {busy ? "…" : dialogue ? "Régénérer" : "Générer"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "…" : "Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : editing ? (
        <div className="space-y-3">
          {draft.map((it, i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <select
                  value={it.role}
                  onChange={(e) => updateDraft(i, { role: e.target.value as DialogueQaItem["role"] })}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold"
                >
                  <option value="client">Client</option>
                  <option value="technicien">Technicien</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-red-500 text-sm font-semibold"
                  aria-label="Supprimer"
                >
                  ×
                </button>
              </div>
              <textarea
                value={it.texte}
                onChange={(e) => updateDraft(i, { texte: e.target.value })}
                rows={2}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addPair}
            className="text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            + Ajouter une paire client / technicien
          </button>
        </div>
      ) : dialogue?.items?.length ? (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {dialogue.items.map((it, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-2 text-sm ${
                it.role === "client"
                  ? "bg-slate-50 border border-slate-200 mr-6"
                  : "bg-[#0e2a52] text-white ml-6"
              }`}
            >
              <div className={`text-[10px] uppercase font-bold tracking-wide mb-1 ${
                it.role === "client" ? "text-slate-500" : "text-red-200"
              }`}>
                {it.role === "client" ? "Client" : "Technicien"}
              </div>
              {it.texte}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          Aucun dialogue. Clique sur « Générer » (après le rapport) — il sera aussi créé à la publication.
        </p>
      )}

      {status && <p className="text-sm text-emerald-700">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}

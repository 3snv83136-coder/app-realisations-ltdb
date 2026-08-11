'use client'

import { useState } from "react"
import type { FactureLineData } from "@/components/FacturePDF"
import { buildRemiseLine, sousTotalFacturePositif } from "@/lib/facture-remise"

type Props = {
  lignes: FactureLineData[]
  onAdd: (line: FactureLineData) => void
  /** Compact pour le mode terrain. */
  compact?: boolean
}

export default function FactureRemiseButton({ lignes, onAdd, compact }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"montant" | "pourcent">("pourcent")
  const [value, setValue] = useState("")
  const [label, setLabel] = useState("Remise commerciale")
  const [error, setError] = useState("")

  const base = sousTotalFacturePositif(lignes)

  function apply() {
    setError("")
    const raw = Number(value)
    if (!Number.isFinite(raw) || raw <= 0) {
      setError("Indique un montant ou un pourcentage positif.")
      return
    }

    let montantHt = 0
    let description: string | undefined
    if (mode === "pourcent") {
      if (raw > 100) {
        setError("Le pourcentage ne peut pas dépasser 100 %.")
        return
      }
      if (base <= 0) {
        setError("Ajoute d’abord des prestations pour calculer un %.")
        return
      }
      montantHt = Math.round(base * (raw / 100) * 100) / 100
      description = `Remise ${raw} %`
    } else {
      montantHt = Math.round(raw * 100) / 100
      if (montantHt > base && base > 0) {
        setError(`La remise (${montantHt} €) dépasse le sous-total (${base.toFixed(2)} €).`)
        return
      }
    }

    onAdd(buildRemiseLine({
      montantHt,
      designation: label.trim() || "Remise commerciale",
      description,
    }))
    setOpen(false)
    setValue("")
    setError("")
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "text-xs font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 rounded-lg px-3 py-1.5 transition"
            : "text-sm font-semibold text-amber-800 hover:text-amber-950"
        }
      >
        − Remise
      </button>
    )
  }

  return (
    <div className={`rounded-xl border-2 border-amber-200 bg-amber-50 p-3 space-y-2 ${compact ? "" : "mt-2"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Remise sur facture</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setError("") }}
          className="text-xs text-amber-800 hover:underline"
        >
          Annuler
        </button>
      </div>

      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Libellé"
        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("pourcent")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === "pourcent" ? "bg-amber-600 text-white" : "bg-white text-amber-900 border border-amber-200"}`}
        >
          Pourcentage %
        </button>
        <button
          type="button"
          onClick={() => setMode("montant")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === "montant" ? "bg-amber-600 text-white" : "bg-white text-amber-900 border border-amber-200"}`}
        >
          Montant € HT
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step={mode === "pourcent" ? "1" : "0.01"}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={mode === "pourcent" ? "Ex. 10" : "Ex. 25.00"}
          className="flex-1 border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white"
        />
        <button
          type="button"
          onClick={apply}
          className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm rounded-lg px-4 py-2"
        >
          Appliquer
        </button>
      </div>

      {mode === "pourcent" && base > 0 && Number(value) > 0 && (
        <p className="text-[11px] text-amber-800">
          ≈ −{(base * (Number(value) / 100)).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
          sur {base.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
        </p>
      )}
      {error && <p className="text-xs text-red-700 font-semibold">{error}</p>}
    </div>
  )
}

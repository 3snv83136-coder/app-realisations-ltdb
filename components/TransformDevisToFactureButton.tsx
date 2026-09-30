'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { buildFactureFromDevis } from "@/lib/devisToFacture"
import type { DevisData } from "@/components/DevisPDF"
import { errorMessage } from "@/lib/error-message"

type Props = {
  devisId: string
  numero?: string | null
  className?: string
}

/**
 * Liste des devis → charge le payload, préremplit /facture/nouvelle.
 */
export default function TransformDevisToFactureButton({ devisId, numero, className }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/historique/${devisId}`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      const doc = json.document
      if (!doc || doc.type !== "devis") throw new Error("Devis introuvable")

      const payloadDevis = (doc.payload || {}) as Partial<DevisData>
      const prefill = buildFactureFromDevis({
        devis: payloadDevis,
        numero: doc.numero || numero || payloadDevis.numero,
        client_nom: doc.client_nom,
        client_email: doc.client_email,
        client_adresse: doc.client_adresse,
        client_code_postal: doc.client_code_postal,
        client_ville: doc.client_ville,
        adresse_chantier: doc.adresse_chantier,
        tva_taux: doc.tva_taux,
      })
      sessionStorage.setItem("ltdb_devis_to_facture", JSON.stringify(prefill))
      router.push("/facture/nouvelle")
    } catch (e) {
      alert(`Impossible de transformer en facture : ${errorMessage(e) || String(e)}`)
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className={
        className ||
        "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold transition"
      }
      title="Crée une facture pré-remplie depuis ce devis"
    >
      {busy ? "…" : "💶"} Facture
    </button>
  )
}

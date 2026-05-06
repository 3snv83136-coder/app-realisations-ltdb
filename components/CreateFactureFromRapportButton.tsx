'use client'
import React from "react"
import { useRouter } from "next/navigation"
import type { RapportData } from "./RealisationPDF"
import { buildFactureFromRapport } from "@/lib/rapportToFacture"

export interface CreateFactureFromRapportSource {
  rapport: RapportData
  client_nom?: string | null
  client_email?: string | null
  client_adresse?: string | null
  client_code_postal?: string | null
  client_ville?: string | null
  adresse_chantier?: string | null
  type_intervention?: string | null
  date_intervention?: string | null
  reference?: string | null
}

export default function CreateFactureFromRapportButton({
  source,
  className,
  label,
  size = 'md',
}: {
  source: CreateFactureFromRapportSource
  className?: string
  label?: string
  size?: 'sm' | 'md'
}) {
  const router = useRouter()

  const baseClass = className || (size === 'sm'
    ? 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition'
    : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition')

  function handleClick() {
    if (typeof window === 'undefined') return
    const payload = buildFactureFromRapport(source)
    sessionStorage.setItem('ltdb_devis_to_facture', JSON.stringify(payload))
    router.push('/facture/nouvelle')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={baseClass}
      title="Créer une facture pré-remplie à partir de ce rapport"
    >
      💶 {label || 'Facturer le rapport'}
    </button>
  )
}

'use client'

import { useRouter } from "next/navigation"
import { useState } from "react"

type Props = {
  devisId: string
  numero?: string | null
  statut?: string | null
  /** Si déjà lié à une intervention (pas de création). */
  interventionId?: string | null
  onAccepted?: () => void
  className?: string
}

/**
 * Marque un devis comme accepté, stoppe les relances et crée l'intervention au planning.
 */
export default function AccepterDevisButton({
  devisId,
  numero,
  statut,
  interventionId,
  onAccepted,
  className = '',
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (statut === 'accepte') {
    if (interventionId) {
      return (
        <button
          type="button"
          onClick={() => router.push(`/intervention/${interventionId}`)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-100 text-green-800 border border-green-300 text-[11px] font-bold hover:bg-green-200 transition ${className}`}
          title="Ouvrir l'intervention liée"
        >
          📅 Voir planning
        </button>
      )
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg bg-green-600 text-white text-[11px] font-bold ${className}`}>
        ✓ Accepté
      </span>
    )
  }

  async function handleClick() {
    const ref = numero || devisId.slice(0, 8)
    if (!confirm(
      `Accepter le devis ${ref} et le mettre au planning ?\n\n`
      + `• Les relances automatiques seront arrêtées.\n`
      + `${interventionId ? '• L\'intervention liée sera mise à jour.' : '• Une intervention sera créée dans le planning.'}`,
    )) return

    setBusy(true)
    try {
      const res = await fetch(`/api/devis/${devisId}/accepter`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      onAccepted?.()

      if (data.warning) {
        alert(data.warning)
      } else if (data.interventionId) {
        const msg = data.created
          ? 'Intervention créée dans le planning.\n\nOuvrir la fiche pour fixer la date et le technicien ?'
          : 'Devis accepté.\n\nOuvrir la fiche de l\'intervention ?'
        if (confirm(msg)) router.push(`/intervention/${data.interventionId}`)
      } else {
        alert('Devis marqué comme accepté.')
      }
    } catch (e) {
      alert(`Erreur : ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[11px] font-bold transition disabled:opacity-50 disabled:cursor-wait shadow-sm ${className}`}
      title="Client a accepté : crée l'intervention dans le planning et arrête les relances"
    >
      {busy ? '…' : '📅 Accepter → Planning'}
    </button>
  )
}

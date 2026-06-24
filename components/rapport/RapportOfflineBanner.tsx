'use client'
import { useCallback, useEffect, useState } from "react"
import { countPendingRapportItems } from "@/lib/rapport/offline-store"
import { syncPendingRapports } from "@/lib/rapport/sync"

type Props = {
  interventionId?: string
  isOnline: boolean
  onSynced?: (result: { transcribed: number; generated: number }) => void
}

export default function RapportOfflineBanner({ interventionId, isOnline, onSynced }: Props) {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const refreshCount = useCallback(async () => {
    try {
      setPending(await countPendingRapportItems(interventionId))
    } catch {
      setPending(0)
    }
  }, [interventionId])

  const runSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await refreshCount()
      return
    }
    setSyncing(true)
    try {
      const r = await syncPendingRapports()
      setPending(interventionId
        ? await countPendingRapportItems(interventionId)
        : r.remaining)
      if (r.transcribed > 0 || r.generated > 0) {
        const parts: string[] = []
        if (r.transcribed > 0) parts.push(`${r.transcribed} dictée${r.transcribed > 1 ? 's' : ''} transcrite${r.transcribed > 1 ? 's' : ''}`)
        if (r.generated > 0) parts.push(`${r.generated} rapport${r.generated > 1 ? 's' : ''} généré${r.generated > 1 ? 's' : ''}`)
        setFlash(parts.join(' · '))
        onSynced?.({ transcribed: r.transcribed, generated: r.generated })
        setTimeout(() => setFlash(null), 5000)
      }
    } finally {
      setSyncing(false)
    }
  }, [interventionId, onSynced, refreshCount])

  useEffect(() => {
    void refreshCount()
  }, [refreshCount])

  useEffect(() => {
    if (!isOnline) return
    void runSync()
  }, [isOnline, runSync])

  useEffect(() => {
    function onOnline() { void runSync() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [runSync])

  const showOfflineHint = !isOnline
  if (!showOfflineHint && pending === 0 && !flash) return null

  return (
    <div className={`rounded-2xl border-2 p-3 space-y-2 ${
      showOfflineHint ? 'bg-slate-100 border-slate-300' : 'bg-amber-50 border-amber-200'
    }`}>
      {showOfflineHint && (
        <p className="text-sm font-semibold text-slate-700">
          📴 Mode hors connexion — ton texte et tes dictées audio sont sauvegardés sur le téléphone.
          La transcription et la génération IA se feront au retour du réseau.
        </p>
      )}
      {flash && (
        <p className="text-sm font-bold text-emerald-700">✓ {flash}</p>
      )}
      {pending > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-amber-900">
            <span className="font-bold">{pending}</span> élément{pending > 1 ? 's' : ''} en attente de synchronisation
          </p>
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={syncing || !isOnline}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0 transition"
          >
            {syncing ? 'Synchro…' : 'Synchroniser'}
          </button>
        </div>
      )}
    </div>
  )
}

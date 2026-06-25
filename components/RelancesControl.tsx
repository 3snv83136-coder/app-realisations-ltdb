'use client'

import { useState } from "react"

type Props = {
  interventionId: string
  avisRelanceCount: number
  devisRelanceCount: number
  avisRecu: boolean
  devisAccepteAt: string | null
  /** Un mail rapport+facture a été envoyé (relances avis programmées). */
  mailEnvoye?: boolean
  /** Un devis existe pour cette intervention (relances devis possibles). */
  hasDevis?: boolean
}

export default function RelancesControl({
  interventionId,
  avisRelanceCount,
  devisRelanceCount,
  avisRecu,
  devisAccepteAt,
  mailEnvoye = false,
  hasDevis = false,
}: Props) {
  const [avisCount, setAvisCount] = useState(avisRelanceCount)
  const [devisCount, setDevisCount] = useState(devisRelanceCount)
  const [avisDone, setAvisDone] = useState(avisRecu)
  const [devisDone, setDevisDone] = useState(!!devisAccepteAt)
  const [busy, setBusy] = useState<'avis' | 'devis' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // Affiche le bloc dès qu'il y a une activité liée aux relances : relances en
  // cours, déjà stoppées, ou simplement un mail/devis envoyé (même sans IDs
  // stockés — cas des envois antérieurs à la fonctionnalité).
  const hasAnything =
    avisCount > 0 || devisCount > 0 || avisDone || devisDone || mailEnvoye || hasDevis
  if (!hasAnything) return null

  async function stop(type: 'avis' | 'devis') {
    setBusy(type)
    setMsg(null)
    try {
      const res = await fetch(`/api/interventions/${interventionId}/stop-relances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const j = await res.json()
      if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`)
      if (type === 'avis') { setAvisCount(0); setAvisDone(true) }
      else { setDevisCount(0); setDevisDone(true) }
      setMsg(`Relances ${type} arrêtées (${j.canceled}/${j.total} annulées).`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
      <h3 className="font-bold text-base">🔔 Relances automatiques</h3>
      <p className="text-xs text-slate-500">
        Si le client a répondu, arrête les relances pour ne plus rien lui envoyer.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Devis */}
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="font-bold text-sm text-slate-700">Devis</div>
          {devisDone ? (
            <p className="text-xs text-emerald-700 mt-1 font-semibold">✓ Devis accepté — relances stoppées</p>
          ) : devisCount > 0 ? (
            <>
              <p className="text-xs text-slate-500 mt-1">{devisCount} relance{devisCount > 1 ? 's' : ''} programmée{devisCount > 1 ? 's' : ''}.</p>
              <button
                type="button"
                onClick={() => stop('devis')}
                disabled={busy === 'devis'}
                className="mt-2 w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg py-2"
              >
                {busy === 'devis' ? 'Arrêt…' : '✓ Devis accepté → stopper les relances'}
              </button>
            </>
          ) : hasDevis ? (
            <p className="text-xs text-slate-400 mt-1">Aucune relance à arrêter ici (devis envoyé avant cette fonction, ou relances terminées). Le client peut se désinscrire via le lien dans son email.</p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Aucun devis envoyé.</p>
          )}
        </div>

        {/* Avis Google */}
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="font-bold text-sm text-slate-700">Avis Google</div>
          {avisDone ? (
            <p className="text-xs text-emerald-700 mt-1 font-semibold">✓ Avis reçu — relances stoppées</p>
          ) : avisCount > 0 ? (
            <>
              <p className="text-xs text-slate-500 mt-1">{avisCount} relance{avisCount > 1 ? 's' : ''} programmée{avisCount > 1 ? 's' : ''}.</p>
              <button
                type="button"
                onClick={() => stop('avis')}
                disabled={busy === 'avis'}
                className="mt-2 w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg py-2"
              >
                {busy === 'avis' ? 'Arrêt…' : '✓ Avis reçu → stopper les relances'}
              </button>
            </>
          ) : mailEnvoye ? (
            <p className="text-xs text-slate-400 mt-1">Aucune relance à arrêter ici (mail envoyé avant cette fonction, ou relances terminées). Le client peut se désinscrire via le lien dans son email.</p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Rapport + facture pas encore envoyés.</p>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </section>
  )
}

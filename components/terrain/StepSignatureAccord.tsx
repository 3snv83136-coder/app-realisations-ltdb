'use client'

import { useEffect, useState } from 'react'
import SignatureCanvas from '@/components/accord/SignatureCanvas'
import { AccordDocument } from '@/components/accord/AccordPDF'
import { pdfElementToBlob } from '@/lib/pdfToBase64'
import { getLtdbSignatureUrl } from '@/lib/rapport-signatures'
import { LTDB_EMETTEUR } from '@/lib/emetteur'
import { TEL_PRINCIPAL_FALLBACK } from '@/lib/parametres'
import type { AccordIntervention, LigneDevis } from '@/lib/supabase'

type ClientInfo = {
  id?: string | null
  nom: string | null
  email: string | null
  telephone: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
} | null

type InterventionLite = {
  id: string
  agence?: string | null
}

type FacturePayload = {
  lignes?: Array<{
    designation?: string
    qte?: number
    unite?: string
    pu_ht?: number
    inclus?: boolean
  }>
  tva_taux?: number
  frais_deplacement?: number
}

type Props = {
  interv: InterventionLite
  client: ClientInfo
  technicienNom?: string
  onDone: () => void | Promise<void>
  onError: (msg: string) => void
}

export default function StepSignatureAccord({ interv, client, technicienNom, onDone, onError }: Props) {
  const [loading, setLoading] = useState(true)
  const [factureTTC, setFactureTTC] = useState<number | null>(null)
  const [factureNumero, setFactureNumero] = useState('')
  const [lignesFacture, setLignesFacture] = useState<FacturePayload['lignes']>([])
  const [tvaTaux, setTvaTaux] = useState(10)
  const [accordExistant, setAccordExistant] = useState<AccordIntervention | null>(null)

  const [signature, setSignature] = useState<string | null>(null)
  const [demandeExpresse, setDemandeExpresse] = useState(false)
  const [renonciation, setRenonciation] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      onError('')
      try {
        const [factRes, accordRes] = await Promise.all([
          fetch(`/api/interventions/${interv.id}/facture`),
          fetch(`/api/interventions/${interv.id}/accord`),
        ])
        const factData = await factRes.json()
        const accordData = await accordRes.json()
        if (!factRes.ok) throw new Error(factData.error || 'Facture introuvable')
        if (!accordRes.ok) throw new Error(accordData.error || 'Erreur chargement accord')

        if (cancelled) return

        if (accordData.accord?.statut === 'VALIDE') {
          setAccordExistant(accordData.accord as AccordIntervention)
        }

        const f = factData.facture
        if (!f) throw new Error('Aucune facture enregistrée. Reviens à l\'étape facture.')

        setFactureNumero(f.numero || '')
        setFactureTTC(typeof f.montant_ttc === 'number' ? f.montant_ttc : null)
        setTvaTaux(typeof f.tva_taux === 'number' ? f.tva_taux : (f.payload?.tva_taux ?? 10))
        const lignes = Array.isArray(f.payload?.lignes) ? f.payload.lignes : []
        setLignesFacture(lignes)
      } catch (e) {
        if (!cancelled) onError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [interv.id, onError])

  const peutValider = !!signature && demandeExpresse && renonciation && !busy && !accordExistant

  async function genererPdfSigne(accord: AccordIntervention, lignes: LigneDevis[], signatureDataUrl: string, valideAt: string) {
    const accordSigne: AccordIntervention = {
      ...accord,
      statut: 'VALIDE',
      valide_at: valideAt,
      canal_validation: 'SIGNATURE',
      signature_image: signatureDataUrl,
      demande_expresse: true,
      renonciation_retractation: true,
    }
    const blob = await pdfElementToBlob(
      <AccordDocument
        accord={accordSigne}
        lignes={lignes}
        emetteur={{
          raisonSociale: LTDB_EMETTEUR.raisonSociale,
          adresseLignes: LTDB_EMETTEUR.adresseLignes,
          email: LTDB_EMETTEUR.email,
        }}
        telephone={TEL_PRINCIPAL_FALLBACK}
        signatureLtdbUrl={getLtdbSignatureUrl()}
        technicienNom={technicienNom}
      />,
    )
    const fd = new FormData()
    fd.append('pdf', new File([blob], `accord-${accord.reference || accord.id}.pdf`, { type: 'application/pdf' }))
    await fetch(`/api/accords/${accord.id}/pdf`, { method: 'POST', body: fd })
  }

  async function handleValider() {
    if (!signature || !lignesFacture?.length) return
    setBusy(true)
    onError('')
    try {
      const lignesInput = lignesFacture
        .filter(l => !l.inclus && (l.designation || '').trim())
        .map(l => ({
          label: (l.designation || '').trim(),
          prix_unitaire: Number(l.pu_ht) || 0,
          quantite: Number(l.qte) || 1,
          unite: l.unite || 'forfait',
          urgent: true,
          tarif_type: null,
        }))

      if (lignesInput.length === 0) {
        throw new Error('La facture ne contient aucune ligne facturable.')
      }

      const res = await fetch('/api/accords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intervention_id: interv.id,
          client_id: client?.id || null,
          client_nom: client?.nom || 'Client',
          client_adresse: client?.adresse || null,
          client_code_postal: client?.code_postal || null,
          client_ville: client?.ville || null,
          client_telephone: client?.telephone || null,
          client_email: client?.email || null,
          taux_tva: tvaTaux,
          frais_deplacement: 0,
          intervention_urgente: true,
          lignes: lignesInput,
          signature,
          demande_expresse: true,
          renonciation_retractation: true,
          valide_at: new Date().toISOString(),
          canal_validation: 'SIGNATURE',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          await fetch(`/api/interventions/${interv.id}/terrain-step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set', step: 7 }),
          })
          await onDone()
          return
        }
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const accordRes = await fetch(`/api/interventions/${interv.id}/accord`)
      const accordData = await accordRes.json()
      const accord = accordData.accord as AccordIntervention
      const lignes = (accordData.lignes || []) as LigneDevis[]

      try {
        await genererPdfSigne(accord, lignes, signature, accord.valide_at || new Date().toISOString())
      } catch (e) {
        console.error('[StepSignatureAccord] PDF', e)
      }

      await fetch(`/api/interventions/${interv.id}/terrain-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', step: 7 }),
      })

      await onDone()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleContinueSansNouveau() {
    setBusy(true)
    try {
      await fetch(`/api/interventions/${interv.id}/terrain-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', step: 7 }),
      })
      await onDone()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <section className="text-center py-16 space-y-3">
        <div className="animate-spin h-10 w-10 border-3 border-blue-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-slate-500">Chargement de la facture…</p>
      </section>
    )
  }

  if (accordExistant) {
    return (
      <section className="space-y-5">
        <header className="text-center">
          <div className="text-5xl mb-2">✅</div>
          <h1 className="text-2xl font-black text-slate-800">Accord déjà signé</h1>
          <p className="text-sm text-slate-600 mt-2">
            Réf. {accordExistant.reference} — validé le{' '}
            {accordExistant.valide_at
              ? new Date(accordExistant.valide_at).toLocaleString('fr-FR')
              : '—'}
          </p>
        </header>
        <button
          type="button"
          onClick={handleContinueSansNouveau}
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl py-5 font-black text-lg shadow-lg transition"
        >
          Continuer →
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">✍️</div>
        <h1 className="text-2xl font-black text-slate-800">Signature client</h1>
        <p className="text-sm text-slate-600 mt-2">
          Accord d&apos;intervention sur la base de la facture
          {factureNumero ? ` ${factureNumero}` : ''}
          {factureTTC != null ? ` — ${factureTTC.toFixed(2)} € TTC` : ''}.
        </p>
      </header>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-sm space-y-1">
        <div className="font-bold text-blue-900">Client : {client?.nom || '—'}</div>
        {(lignesFacture || []).filter(l => !l.inclus).map((l, i) => (
          <div key={i} className="flex justify-between gap-2 text-slate-700">
            <span className="truncate">{l.designation}</span>
            <span className="font-semibold tabular-nums shrink-0">
              {((Number(l.qte) || 0) * (Number(l.pu_ht) || 0)).toFixed(2)} € HT
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <p className="text-xs text-slate-600 leading-relaxed">
          Le client reconnaît avoir demandé expressément l&apos;exécution immédiate des travaux
          et renonce à son droit de rétractation (art. L221-28 du Code de la consommation).
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={demandeExpresse}
            onChange={e => setDemandeExpresse(e.target.checked)}
            className="mt-1 w-5 h-5 accent-blue-600"
          />
          <span className="text-sm font-semibold text-slate-800">
            Demande expresse d&apos;exécution immédiate des travaux
          </span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={renonciation}
            onChange={e => setRenonciation(e.target.checked)}
            className="mt-1 w-5 h-5 accent-blue-600"
          />
          <span className="text-sm font-semibold text-slate-800">
            Renonciation au droit de rétractation
          </span>
        </label>
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Signature du client</div>
        <SignatureCanvas onChange={setSignature} />
      </div>

      <button
        type="button"
        onClick={handleValider}
        disabled={!peutValider}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl py-5 font-black text-lg shadow-lg transition"
      >
        {busy ? '⚙ Enregistrement…' : '✓ Valider la signature'}
      </button>
    </section>
  )
}

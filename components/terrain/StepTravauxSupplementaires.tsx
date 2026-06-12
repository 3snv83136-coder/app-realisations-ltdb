'use client'
import { useMemo, useState } from 'react'
import SignatureCanvas from '@/components/accord/SignatureCanvas'
import { TravauxSupplementairesDocument } from '@/components/terrain/TravauxSupplementairesPDF'
import { pdfDocumentToBase64 } from '@/lib/pdfToBase64'
import { buildSmsUri, isMobileForSms, openNativeSms } from '@/lib/sms'
import {
  PRESTATIONS_TRAVAUX_SUPP,
  calculTotauxTravauxSupp,
  type TravauxSupplementairesRecord,
} from '@/lib/travaux-supplementaires'

type ClientInfo = {
  nom: string | null
  email: string | null
  telephone: string | null
} | null

type InterventionLite = {
  id: string
  reference: string | null
  adresse_chantier: string | null
  ville: string | null
  rapport_json: unknown
}

type Props = {
  interv: InterventionLite
  client: ClientInfo
  onSaved: () => void | Promise<void>
  onClose: () => void | Promise<void>
  onError: (msg: string) => void
  /** Ouvert en panneau depuis l'étape « intervention en cours » */
  overlay?: boolean
}

type SelectedLine = {
  id: string
  label: string
  prix_ht: number
  quantite: number
}

export default function StepTravauxSupplementaires({ interv, client, onSaved, onClose, onError, overlay = false }: Props) {
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [manuelle, setManuelle] = useState('')
  const [manuellePrix, setManuellePrix] = useState(0)
  const [tva, setTva] = useState<0 | 10 | 20>(10)
  const [signature, setSignature] = useState<string | null>(null)
  const [demandeExpresse, setDemandeExpresse] = useState(false)
  const [renonciation, setRenonciation] = useState(false)
  const [clientNom, setClientNom] = useState(client?.nom || '')
  const [clientEmail, setClientEmail] = useState(client?.email || '')
  const [clientTel, setClientTel] = useState(client?.telephone || '')
  const [busy, setBusy] = useState(false)

  const lignes: SelectedLine[] = useMemo(() => {
    const out: SelectedLine[] = []
    for (const p of PRESTATIONS_TRAVAUX_SUPP) {
      if (selected[p.id]) {
        out.push({
          id: p.id,
          label: p.label,
          prix_ht: prices[p.id] ?? 0,
          quantite: 1,
        })
      }
    }
    if (manuelle.trim()) {
      out.push({
        id: 'manuelle',
        label: manuelle.trim(),
        prix_ht: manuellePrix,
        quantite: 1,
      })
    }
    return out
  }, [selected, prices, manuelle, manuellePrix])

  const { total_ht, total_ttc } = calculTotauxTravauxSupp(
    lignes.map(l => ({ label: l.label, prix_ht: l.prix_ht, quantite: l.quantite, unite: 'forfait' })),
    tva,
  )

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())
  const telValide = clientTel.trim().replace(/\D/g, '').length >= 10

  const peutValider =
    lignes.length > 0 &&
    !!signature &&
    demandeExpresse &&
    renonciation &&
    clientNom.trim() &&
    (emailValide || telValide) &&
    !busy

  function togglePrestation(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  async function envoyerAccordSigne(record: TravauxSupplementairesRecord) {
    const email = clientEmail.trim()
    const phone = clientTel.trim()
    let mailOk = false
    let smsOk = false
    let uri: string | null = null
    const warnings: string[] = []

    if (emailValide) {
      try {
        const pdfBase64 = await buildPdfBase64(record)
        const res = await fetch(`/api/interventions/${interv.id}/notify-travaux-supplementaires`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordId: record.id,
            clientEmail: email,
            pdfBase64,
            pdfFilename: `accord-travaux-suppl-${record.id}.pdf`,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        mailOk = true
      } catch (e) {
        warnings.push(`Mail : ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    if (telValide) {
      if (!isMobileForSms()) {
        if (!emailValide) {
          warnings.push('SMS : ouvrez l\'app depuis un smartphone pour envoyer le message.')
        }
      } else {
        try {
          const res = await fetch(`/api/interventions/${interv.id}/notify-travaux-supplementaires-sms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordId: record.id, clientPhone: phone }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
          uri = buildSmsUri(phone, data.body)
          openNativeSms(phone, data.body)
          smsOk = true
        } catch (e) {
          warnings.push(`SMS : ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    if (warnings.length > 0 && !mailOk && !smsOk) {
      onError(warnings.join(' · '))
    } else if (warnings.length > 0) {
      onError(`Accord enregistré. ${warnings.join(' · ')}`)
    }
  }

  async function handleValidate() {
    if (!peutValider || !signature) return
    setBusy(true)
    onError('')
    try {
      const res = await fetch(`/api/interventions/${interv.id}/travaux-supplementaires`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_nom: clientNom.trim(),
          client_email: clientEmail.trim() || undefined,
          client_telephone: clientTel.trim() || undefined,
          lignes: lignes.map(l => ({
            label: l.label,
            prix_ht: l.prix_ht,
            quantite: l.quantite,
            unite: 'forfait',
            prestation_id: l.id !== 'manuelle' ? l.id : null,
          })),
          prestation_manuelle: manuelle.trim() || undefined,
          signature,
          taux_tva: tva,
          demande_expresse: true,
          renonciation_retractation: true,
          valide_at: new Date().toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await envoyerAccordSigne(data.record as TravauxSupplementairesRecord)
      await onSaved()
      await onClose()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function buildPdfBase64(record: TravauxSupplementairesRecord) {
    return pdfDocumentToBase64(
      <TravauxSupplementairesDocument
        record={record}
        interventionRef={interv.reference}
        adresse={interv.adresse_chantier}
        ville={interv.ville}
      />,
    )
  }

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">🤝</div>
        <h1 className="text-2xl font-black text-slate-800">Travaux supplémentaires avec accord</h1>
        <p className="text-sm text-slate-600 mt-2">
          Ajoute un curage, un passage caméra ou autre prestation. L&apos;accord part automatiquement à la signature.
        </p>
      </header>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-slate-500 font-bold">Prestations</h2>
        {PRESTATIONS_TRAVAUX_SUPP.map(p => (
          <div key={p.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!selected[p.id]}
                onChange={() => togglePrestation(p.id)}
                className="w-5 h-5 mt-0.5 accent-blue-600"
              />
              <span className="text-sm font-semibold text-slate-800 flex-1">{p.label}</span>
            </label>
            {selected[p.id] && (
              <div className="pl-8">
                <label className="text-[11px] font-bold text-slate-500">Prix HT (€)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={prices[p.id] ?? 0}
                  onChange={e => setPrices(prev => ({ ...prev, [p.id]: Number(e.target.value) || 0 }))}
                  className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
            )}
          </div>
        ))}

        <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Autre prestation (manuel)</label>
          <input
            value={manuelle}
            onChange={e => setManuelle(e.target.value)}
            placeholder="Décrire la prestation…"
            className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
          />
          {manuelle.trim() && (
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={manuellePrix}
              onChange={e => setManuellePrix(Number(e.target.value) || 0)}
              placeholder="Prix HT"
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2 text-sm"
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-2">
        <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">TVA</label>
        <div className="flex gap-2">
          {([0, 10, 20] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTva(t)}
              className={`flex-1 py-2 rounded-lg font-bold text-sm ${tva === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {t}%
            </button>
          ))}
        </div>
        <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200">
          <span>Total TTC</span>
          <span className="tabular-nums">{total_ttc.toFixed(2)} €</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Nom du client</label>
        <input
          value={clientNom}
          onChange={e => setClientNom(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
        />
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Email (envoi automatique)</label>
        <input
          type="email"
          value={clientEmail}
          onChange={e => setClientEmail(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
        />
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Téléphone (SMS automatique)</label>
        <input
          type="tel"
          value={clientTel}
          onChange={e => setClientTel(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
        />
        {!emailValide && !telValide && (
          <p className="text-xs text-amber-600 font-semibold">⚠ Email ou téléphone requis pour l&apos;envoi automatique à la signature.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Signature client</h2>
        <label className="flex gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={demandeExpresse} onChange={e => setDemandeExpresse(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          <span>Le client demande expressément la réalisation de ces travaux supplémentaires.</span>
        </label>
        <label className="flex gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={renonciation} onChange={e => setRenonciation(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          <span>Le client renonce à son droit de rétractation pour ces prestations urgentes.</span>
        </label>
        <SignatureCanvas onChange={setSignature} />
      </div>

      <button
        type="button"
        onClick={handleValidate}
        disabled={!peutValider}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl py-5 font-black text-lg shadow-lg transition"
      >
        {busy ? '⚙ Signature et envoi en cours…' : '✓ Signer et envoyer l\'accord'}
      </button>

      {overlay && (
        <button
          type="button"
          onClick={() => onClose()}
          disabled={!!busy}
          className="w-full bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 rounded-2xl py-4 font-bold transition"
        >
          ← Retour à l&apos;intervention
        </button>
      )}
    </section>
  )
}

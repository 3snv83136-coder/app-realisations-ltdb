'use client'
import { useMemo, useState } from 'react'
import TerrainPhotoCapture from '@/components/terrain/TerrainPhotoCapture'
import SignatureCanvas from '@/components/accord/SignatureCanvas'
import { TravauxSupplementairesDocument } from '@/components/terrain/TravauxSupplementairesPDF'
import { pdfDocumentToBase64 } from '@/lib/pdfToBase64'
import { buildSmsUri, isMobileForSms, openNativeSms } from '@/lib/sms'
import { proxyImageUrl } from '@/lib/proxyImageUrl'
import {
  PRESTATIONS_TRAVAUX_SUPP,
  calculTotauxTravauxSupp,
  getTravauxSupplementaires,
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
  onSkip: () => void | Promise<void>
  onError: (msg: string) => void
}

type SelectedLine = {
  id: string
  label: string
  prix_ht: number
  quantite: number
}

export default function StepTravauxSupplementaires({ interv, client, onSaved, onSkip, onError }: Props) {
  const existing = useMemo(() => getTravauxSupplementaires(interv.rapport_json), [interv.rapport_json])
  const lastSigned = existing.length > 0 ? existing[existing.length - 1] : null

  const [phase, setPhase] = useState<'form' | 'sent'>(lastSigned ? 'sent' : 'form')
  const [savedRecord, setSavedRecord] = useState<TravauxSupplementairesRecord | null>(lastSigned)

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [manuelle, setManuelle] = useState('')
  const [manuellePrix, setManuellePrix] = useState(0)
  const [tva, setTva] = useState<0 | 10 | 20>(10)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [demandeExpresse, setDemandeExpresse] = useState(false)
  const [renonciation, setRenonciation] = useState(false)
  const [clientNom, setClientNom] = useState(client?.nom || '')
  const [clientEmail, setClientEmail] = useState(client?.email || '')
  const [clientTel, setClientTel] = useState(client?.telephone || '')
  const [busy, setBusy] = useState<'save' | 'mail' | 'sms' | null>(null)
  const [smsUri, setSmsUri] = useState<string | null>(null)

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

  const peutValider =
    lignes.length > 0 &&
    !!signature &&
    demandeExpresse &&
    renonciation &&
    clientNom.trim() &&
    busy === null

  function togglePrestation(id: string) {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handlePhotoFromCapture(url: string) {
    setPhotoUrl(url)
  }

  async function handleValidate() {
    if (!peutValider || !signature) return
    setBusy('save')
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
          photo_url: photoUrl || undefined,
          taux_tva: tva,
          demande_expresse: true,
          renonciation_retractation: true,
          valide_at: new Date().toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSavedRecord(data.record)
      setPhase('sent')
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
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

  async function handleSendMail() {
    if (!savedRecord) return
    if (!clientEmail.trim()) {
      onError('Saisis l\'email du client.')
      return
    }
    setBusy('mail')
    onError('')
    try {
      const pdfBase64 = await buildPdfBase64(savedRecord)
      const res = await fetch(`/api/interventions/${interv.id}/notify-travaux-supplementaires`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: savedRecord.id,
          clientEmail: clientEmail.trim(),
          pdfBase64,
          pdfFilename: `accord-travaux-suppl-${savedRecord.id}.pdf`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function handleSendSms() {
    if (!savedRecord) return
    const phone = clientTel.trim()
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      onError('Saisis un numéro de mobile valide.')
      return
    }
    if (!isMobileForSms()) {
      onError('Le SMS s\'ouvre depuis un smartphone.')
      return
    }
    setBusy('sms')
    onError('')
    setSmsUri(null)
    try {
      const res = await fetch(`/api/interventions/${interv.id}/notify-travaux-supplementaires-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: savedRecord.id, clientPhone: phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const uri = buildSmsUri(phone, data.body)
      setSmsUri(uri)
      openNativeSms(phone, data.body)
      await onSaved()
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (phase === 'sent' && savedRecord) {
    return (
      <section className="space-y-5">
        <header className="text-center bg-emerald-50 border-2 border-emerald-200 rounded-2xl py-6 px-4">
          <div className="text-4xl mb-1">✓</div>
          <h1 className="text-xl font-black text-emerald-800">Accord signé</h1>
          <p className="text-sm text-emerald-700 mt-2">
            {savedRecord.lignes.length} prestation{savedRecord.lignes.length > 1 ? 's' : ''} · {total_ttc.toFixed(2)} € TTC
          </p>
        </header>

        <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Email client</label>
            <input
              type="email"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-1">Téléphone</label>
            <input
              type="tel"
              value={clientTel}
              onChange={e => setClientTel(e.target.value)}
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
            />
          </div>
        </div>

        {smsUri && (
          <a
            href={smsUri}
            className="block w-full text-center py-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg"
          >
            📱 Ouvrir Messages (SMS)
          </a>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSendMail}
            disabled={!!busy || !clientEmail.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl py-4 font-black shadow-lg transition"
          >
            {busy === 'mail' ? '⚙ Envoi…' : savedRecord.mail_envoye_at ? '✓ Mail envoyé — renvoyer' : '✉ Envoyer par mail'}
          </button>
          <button
            type="button"
            onClick={handleSendSms}
            disabled={!!busy || !clientTel.trim()}
            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-2xl py-4 font-black shadow-lg transition"
          >
            {busy === 'sms' ? '⚙ SMS…' : savedRecord.sms_envoye_at ? '✓ SMS préparé — renvoyer' : '📱 Envoyer par SMS'}
          </button>
          <button
            type="button"
            onClick={() => onSkip()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black shadow-lg transition"
          >
            Continuer → Photo après
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <header className="text-center">
        <div className="text-5xl mb-2">🤝</div>
        <h1 className="text-2xl font-black text-slate-800">Travaux supplémentaires avec accord</h1>
        <p className="text-sm text-slate-600 mt-2">
          Ajoute un curage, un passage caméra ou autre prestation avant de continuer l&apos;intervention.
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

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-3">
        <h2 className="font-bold text-slate-800">📷 Photo après travaux supplémentaires</h2>
        <p className="text-xs text-slate-500">Capture le résultat une fois les travaux supplémentaires terminés.</p>
        {photoUrl ? (
          <div className="rounded-xl overflow-hidden border-2 border-emerald-200">
            <img src={proxyImageUrl(photoUrl)} alt="Après travaux suppl." className="w-full max-h-48 object-cover" />
            <p className="text-xs text-emerald-700 py-1 bg-emerald-50 font-bold text-center">✓ Photo enregistrée</p>
          </div>
        ) : (
          <TerrainPhotoCapture
            interventionId={interv.id}
            legendeDefaut="Travaux supplémentaires — photo après"
            titre="Photo APRÈS travaux suppl."
            onUploaded={(url) => { void handlePhotoFromCapture(url) }}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 space-y-3">
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Nom du client</label>
        <input
          value={clientNom}
          onChange={e => setClientNom(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
        />
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Email (envoi accord)</label>
        <input
          type="email"
          value={clientEmail}
          onChange={e => setClientEmail(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
        />
        <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold">Téléphone (SMS)</label>
        <input
          type="tel"
          value={clientTel}
          onChange={e => setClientTel(e.target.value)}
          className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-xl px-4 py-3 text-sm"
        />
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
        {busy === 'save' ? '⚙ Enregistrement…' : '✓ Valider et faire signer'}
      </button>

      <button
        type="button"
        onClick={() => onSkip()}
        disabled={!!busy}
        className="w-full text-center text-sm text-slate-500 hover:text-slate-700 underline py-2"
      >
        Pas de travaux supplémentaires → continuer
      </button>
    </section>
  )
}

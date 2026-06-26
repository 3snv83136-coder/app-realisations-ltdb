'use client'

import { useState } from "react"
import type { DevisData } from "@/components/DevisPDF"
import { EMAIL_RE } from "@/lib/email-regexp"

type Props = {
  devis: DevisData
  clientEmail: string
  onClientEmailChange: (v: string) => void
  clientNom: string
  clientAdresse: string
  clientCP: string
  clientVille: string
  dateDevis: string
  totalHT: number
  totalTTC: number
  tvaTaux: number
  interventionId?: string | null
  onSent?: () => void
}

type Mode = 'now' | 'scheduled'

export default function DevisEnvoiPanel({
  devis,
  clientEmail,
  onClientEmailChange,
  clientNom,
  clientAdresse,
  clientCP,
  clientVille,
  dateDevis,
  totalHT,
  totalTTC,
  tvaTaux,
  interventionId,
  onSent,
}: Props) {
  const [mode, setMode] = useState<Mode>('now')
  const [premierEnvoiDate, setPremierEnvoiDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [premierEnvoiHeure, setPremierEnvoiHeure] = useState('09:00')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [extraEmails, setExtraEmails] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')
  // Numéro séquentiel définitif (DV-2026-0001), alloué une seule fois à l'envoi.
  const [finalNumero, setFinalNumero] = useState<string | null>(null)

  function addRecipient() {
    const e = newEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(e)) {
      setError('Adresse email invalide.')
      return
    }
    const primary = clientEmail.trim().toLowerCase()
    if (e === primary) {
      setError('Cet email est déjà le destinataire principal.')
      return
    }
    if (extraEmails.includes(e)) {
      setError('Destinataire déjà ajouté.')
      return
    }
    setExtraEmails(prev => [...prev, e])
    setNewEmail('')
    setError('')
  }

  function removeRecipient(email: string) {
    setExtraEmails(prev => prev.filter(x => x !== email))
  }

  async function handleSend() {
    if (!clientEmail) {
      setError("Renseigne l'email du client.")
      return
    }
    const missing: string[] = []
    if (!clientNom.trim()) missing.push('nom')
    if (!clientAdresse.trim()) missing.push('adresse')
    if (!clientVille.trim()) missing.push('ville')
    if (missing.length) {
      setError(`Champs client incomplets : ${missing.join(', ')}.`)
      return
    }

    setSending(true)
    setError('')
    setSent(false)

    try {
      let premierEnvoiAt: string | undefined
      if (mode === 'scheduled') {
        premierEnvoiAt = new Date(`${premierEnvoiDate}T${premierEnvoiHeure}:00`).toISOString()
        if (new Date(premierEnvoiAt).getTime() <= Date.now()) {
          setError('Choisis une date et heure dans le futur, ou utilise « Envoyer maintenant ».')
          setSending(false)
          return
        }
      }

      // Numéro de devis séquentiel continu (DV-2026-0001), alloué côté serveur
      // AVANT la génération du PDF pour garantir la cohérence PDF ↔ DB.
      let numero = finalNumero || devis.numero
      if (!/^DV-\d{4}-\d{4}$/.test(numero || '')) {
        try {
          const r = await fetch('/api/numero/allocate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'devis' }),
          })
          const d = await r.json().catch(() => ({}))
          if (r.ok && d.numero) { numero = d.numero; setFinalNumero(d.numero) }
        } catch {
          // repli : on garde le numéro provisoire
        }
      }
      const devisToSend: DevisData = { ...devis, numero }

      const [{ DevisDocument }, { pdfDocumentToBase64 }, React] = await Promise.all([
        import('@/components/DevisPDF'),
        import('@/lib/pdfToBase64'),
        import('react'),
      ])
      const { LTDB_EMETTEUR } = await import('@/lib/emetteur')
      const client = {
        nom: clientNom || '—',
        adresseLignes: [clientAdresse || '', [clientCP, clientVille].filter(Boolean).join(' ')].filter(Boolean),
      }
      const pdfBase64 = await pdfDocumentToBase64(
        React.createElement(DevisDocument, {
          emetteur: LTDB_EMETTEUR,
          client,
          devis: devisToSend,
          phone: LTDB_EMETTEUR.telephone,
        }),
      )
      const filename = `devis-${devisToSend.numero || 'sans-numero'}.pdf`.replace(/\s+/g, '-')
      const technicienNom = typeof window !== 'undefined' ? localStorage.getItem('ltdb_technicien') || '' : ''

      const res = await fetch('/api/notify-devis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          additionalEmails: extraEmails,
          clientNom,
          technicienNom,
          ville: clientVille,
          dateDevis,
          numero: devisToSend.numero,
          totalTTC,
          validiteJours: devisToSend.validite_jours,
          pdfBase64,
          pdfFilename: filename,
          devis: devisToSend,
          totalHT,
          tvaTaux,
          clientAdresse,
          clientCP,
          interventionId: interventionId || undefined,
          planRelances: true,
          premierEnvoiAt,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      if (data.warning) setError(data.warning)
      else {
        setSent(true)
        onSent?.()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-amber-200 p-5 space-y-4">
      <div>
        <h2 className="font-bold text-[#0e2a52] text-lg">Envoi du devis au client</h2>
        <p className="text-xs text-slate-500 mt-1">
          3 emails sur 3 semaines : présence dans le secteur (S1–S2), puis <strong>-10 %</strong> si accord immédiat (S3).
          Les destinataires supplémentaires reçoivent uniquement le PDF initial.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode('now')}
          className={`p-3 rounded-xl border-2 text-left text-sm font-semibold transition ${
            mode === 'now' ? 'border-amber-500 bg-amber-50 text-[#0e2a52]' : 'border-slate-200 text-slate-600'
          }`}
        >
          ✉ Envoyer maintenant
          <span className="block text-xs font-normal text-slate-500 mt-0.5">PDF + relances J+7 et J+14</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('scheduled')}
          className={`p-3 rounded-xl border-2 text-left text-sm font-semibold transition ${
            mode === 'scheduled' ? 'border-amber-500 bg-amber-50 text-[#0e2a52]' : 'border-slate-200 text-slate-600'
          }`}
        >
          📅 Premier envoi différé
          <span className="block text-xs font-normal text-slate-500 mt-0.5">Puis relances chaque semaine (×3)</span>
        </button>
      </div>

      {mode === 'scheduled' && (
        <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3 border border-slate-200">
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Date</span>
            <input
              type="date"
              value={premierEnvoiDate}
              onChange={(e) => setPremierEnvoiDate(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Heure</span>
            <input
              type="time"
              value={premierEnvoiHeure}
              onChange={(e) => setPremierEnvoiHeure(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-lg px-3 py-2 mt-1"
            />
          </label>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-wide text-slate-500 font-semibold">
          Destinataire principal
        </label>
        <input
          type="email"
          value={clientEmail}
          onChange={(e) => onClientEmailChange(e.target.value)}
          placeholder="email@client.com"
          className="w-full border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2 text-sm"
          disabled={sending}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-wide text-slate-500 font-semibold">
          Autres destinataires (copie)
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient() } }}
            placeholder="syndic@exemple.fr"
            className="flex-1 border-2 border-slate-200 focus:border-[#0e2a52] outline-none rounded-lg px-3 py-2 text-sm"
            disabled={sending}
          />
          <button
            type="button"
            onClick={addRecipient}
            disabled={sending || !newEmail.trim()}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-50 whitespace-nowrap"
          >
            + Ajouter
          </button>
        </div>
        {extraEmails.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {extraEmails.map(email => (
              <li
                key={email}
                className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  className="text-red-600 hover:text-red-800 px-1"
                  aria-label={`Retirer ${email}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !clientEmail}
        className="w-full bg-[#0e2a52] text-white font-bold rounded-lg px-5 py-2.5 text-sm hover:bg-[#0a2047] disabled:opacity-50"
      >
        {sending ? 'Envoi…' : mode === 'now' ? 'Envoyer' : 'Programmer'}
      </button>

      {sent && (
        <p className="text-sm text-emerald-700">
          ✓ {mode === 'now' ? 'Devis envoyé' : 'Envoi programmé'}
          {extraEmails.length > 0 ? ` à ${1 + extraEmails.length} destinataires` : ''}
          {' '}— relances semaines 2 et 3 planifiées pour le destinataire principal.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  )
}

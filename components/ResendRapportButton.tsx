'use client'
import React, { useState } from "react"
import { pdfDocumentToBase64 } from "@/lib/pdfToBase64"
import { safeFilename } from "@/lib/filename"
import { RealisationDocument, type RapportData } from "./RealisationPDF"

export interface ResendRapportIntervention {
  id: string
  reference: string | null
  type_intervention: string | null
  adresse_chantier: string | null
  ville: string | null
  code_postal: string | null
  date_realisee: string | null
  date_prevue: string | null
  rapport_json: any
  photos_urls: string[] | null
  client_nom: string | null
  client_email: string | null
  client_adresse: string | null
  client_code_postal: string | null
  client_ville: string | null
  technicien_nom: string | null
}

async function buildRapportBase64(i: ResendRapportIntervention): Promise<{ base64: string; filename: string } | null> {
  const rapport = i.rapport_json as RapportData | null
  if (!rapport || typeof rapport !== 'object') return null

  const dateIntervention = i.date_realisee || i.date_prevue || new Date().toISOString().slice(0, 10)
  const photos = (i.photos_urls || [])
    .filter(u => typeof u === 'string' && u.trim())
    .map(url => ({ url, legende: '' }))

  const element = React.createElement(RealisationDocument, {
    clientNom: i.client_nom || '—',
    adresse: i.adresse_chantier || i.client_adresse || '',
    ville: i.ville || i.client_ville || '',
    codePostal: i.code_postal || i.client_code_postal || '',
    dateIntervention,
    typeIntervention: i.type_intervention || 'Intervention',
    technicienNom: i.technicien_nom || '',
    rapport,
    photos,
    reference: i.reference || rapport.reference || undefined,
  })

  const base64 = await pdfDocumentToBase64(element)
  return { base64, filename: safeFilename('rapport', i.reference || i.ville || i.id) }
}

export default function ResendRapportButton({ intervention }: { intervention: ResendRapportIntervention }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(intervention.client_email || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const hasRapport = !!(intervention.rapport_json && typeof intervention.rapport_json === 'object'
    && Object.keys(intervention.rapport_json).length > 0)
  if (!hasRapport) return null

  async function handleSend() {
    if (!email.trim()) { setError('Email obligatoire'); return }
    setSending(true); setError(''); setSent(false)
    try {
      const built = await buildRapportBase64(intervention)
      if (!built) throw new Error('Rapport indisponible')
      const technicienNom = typeof window !== 'undefined' ? (localStorage.getItem('ltdb_technicien') || '') : ''
      const res = await fetch('/api/notify-rapport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail: email.trim(),
          clientNom: intervention.client_nom,
          ville: intervention.ville || intervention.client_ville,
          reference: intervention.reference,
          technicienNom,
          pdfRapportBase64: built.base64,
          pdfFilename: built.filename,
          interventionId: intervention.id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSent(true)
      setTimeout(() => { setOpen(false); setSent(false) }, 1500)
    } catch (e: any) {
      setError(e?.message || 'Erreur envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(''); setSent(false); setEmail(intervention.client_email || '') }}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
        title="Renvoyer le rapport par email"
      >
        ✉ Renvoyer rapport
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !sending && setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-[#0e2a52] text-lg mb-1">Renvoyer le rapport</h3>
            <p className="text-sm text-slate-500 mb-4">
              {intervention.reference || 'Rapport'}{intervention.client_nom ? ` — ${intervention.client_nom}` : ''}
            </p>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Email du destinataire
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@client.com"
              autoFocus
              className="w-full border-2 border-slate-200 focus:border-blue-500 outline-none rounded-lg px-3 py-2.5 text-base"
              disabled={sending || sent}
            />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mt-3">
                ⚠ {error}
              </div>
            )}
            {sent && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-3 py-2 text-sm mt-3">
                ✓ Rapport envoyé à <strong>{email}</strong>
              </div>
            )}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={sending}
                className="flex-1 border-2 border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || sent || !email.trim()}
                className="flex-1 bg-blue-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? 'Envoi…' : sent ? '✓ Envoyé' : '✉ Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

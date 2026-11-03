'use client'

import {
  FACTURE_RELANCE_MODE_OPTIONS,
  type FactureRelanceMode,
} from '@/lib/facture-relance-modes'

type Props = {
  value: FactureRelanceMode
  onChange: (mode: FactureRelanceMode) => void
  disabled?: boolean
  /** Masquer si la facture est déjà réglée */
  hidden?: boolean
  className?: string
}

/** Choix du planning de relances paiement à l'envoi d'une facture. */
export default function FactureRelanceModePicker({
  value,
  onChange,
  disabled,
  hidden,
  className = '',
}: Props) {
  if (hidden) return null

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-2 ${className}`}>
      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        Relances de paiement
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {FACTURE_RELANCE_MODE_OPTIONS.map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`text-left rounded-lg border-2 px-2.5 py-2 transition disabled:opacity-50 ${
                active
                  ? 'border-[#0e2a52] bg-white shadow-sm'
                  : 'border-transparent bg-white/60 hover:border-slate-300'
              }`}
            >
              <div className={`text-sm font-bold ${active ? 'text-[#0e2a52]' : 'text-slate-700'}`}>
                {opt.label}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{opt.sub}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

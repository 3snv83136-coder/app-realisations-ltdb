export const MODES_PAIEMENT = [
  { key: 'cb', label: 'Carte bancaire (CB)' },
  { key: 'virement', label: 'Virement' },
  { key: 'especes', label: 'Espèces' },
] as const

export type ModePaiement = (typeof MODES_PAIEMENT)[number]['key']

export function isModePaiement(v: unknown): v is ModePaiement {
  return v === 'cb' || v === 'virement' || v === 'especes'
}

export function labelModePaiement(mode?: string | null): string {
  if (mode === 'cb') return 'carte bancaire (CB)'
  if (mode === 'virement') return 'virement'
  if (mode === 'especes') return 'especes'
  return ''
}

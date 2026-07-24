export const MODES_PAIEMENT = [
  { key: 'cb', label: 'CB', labelSms: 'carte bancaire (CB)' },
  { key: 'virement', label: 'Virement', labelSms: 'virement' },
  { key: 'especes', label: 'Espèces', labelSms: 'especes' },
] as const

export type ModePaiement = (typeof MODES_PAIEMENT)[number]['key']

export const MODE_PAIEMENT_KEYS = MODES_PAIEMENT.map(m => m.key) as ModePaiement[]

export function isModePaiement(v: unknown): v is ModePaiement {
  return v === 'cb' || v === 'virement' || v === 'especes'
}

/** Parse `cb`, `cb,virement` ou tableau → liste ordonnée unique. */
export function parseModesPaiement(raw: unknown): ModePaiement[] {
  const parts: string[] = []
  if (Array.isArray(raw)) {
    for (const v of raw) if (typeof v === 'string') parts.push(v)
  } else if (typeof raw === 'string' && raw.trim()) {
    parts.push(...raw.split(/[,+|]/).map(s => s.trim().toLowerCase()))
  }
  const out: ModePaiement[] = []
  for (const key of MODE_PAIEMENT_KEYS) {
    if (parts.some(p => p === key) && !out.includes(key)) out.push(key)
  }
  return out
}

/** Stockage canonique : `cb`, `cb,virement`, `cb,virement,especes`. */
export function serializeModesPaiement(modes: ModePaiement[]): string | null {
  const ordered = MODE_PAIEMENT_KEYS.filter(k => modes.includes(k))
  return ordered.length ? ordered.join(',') : null
}

/** Normalise entrée API (string | string[]) → valeur colonne ou null. */
export function normalizeModePaiementInput(v: unknown): string | null {
  return serializeModesPaiement(parseModesPaiement(v))
}

export function labelModesPaiement(raw?: string | string[] | null): string {
  const modes = parseModesPaiement(raw)
  const labels = modes.map(k => MODES_PAIEMENT.find(m => m.key === k)!.labelSms)
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} ou ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} ou ${labels[labels.length - 1]}`
}

/** @deprecated Préférer labelModesPaiement (multi-modes). */
export function labelModePaiement(mode?: string | null): string {
  return labelModesPaiement(mode)
}

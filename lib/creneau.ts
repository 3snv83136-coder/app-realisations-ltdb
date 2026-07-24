/** Créneau horaire planifié (début → fin), max 2 heures. */

export const CRENEAU_MAX_MINUTES = 120

export function parseTimeToMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null
  const m = /^(\d{2}):(\d{2})/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function minutesToTime(total: number): string {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutesToTime(hhmm: string, minutes: number): string {
  const base = parseTimeToMinutes(hhmm)
  if (base === null) return hhmm
  return minutesToTime(base + minutes)
}

export function minutesBetween(debut?: string | null, fin?: string | null): number | null {
  const a = parseTimeToMinutes(debut)
  const b = parseTimeToMinutes(fin)
  if (a === null || b === null) return null
  return b - a
}

export function fmtHeureShort(h?: string | null): string {
  if (!h) return ''
  const m = /^(\d{2}):(\d{2})/.exec(h)
  if (!m) return h
  return m[2] === '00' ? `${m[1]}h` : `${m[1]}h${m[2]}`
}

/** Affiche "14h–16h" ou juste "14h" si pas de fin. */
export function formatCreneau(debut?: string | null, fin?: string | null): string {
  const d = fmtHeureShort(debut)
  const f = fmtHeureShort(fin)
  if (d && f && d !== f) return `${d}–${f}`
  return d || f || ''
}

export function validateCreneau(
  debut?: string | null,
  fin?: string | null,
): { ok: true } | { ok: false; error: string } {
  if (!debut) return { ok: false, error: 'Heure de début requise' }
  if (!fin) return { ok: false, error: 'Heure de fin du créneau requise' }
  const diff = minutesBetween(debut, fin)
  if (diff === null) return { ok: false, error: 'Créneau horaire invalide' }
  if (diff <= 0) return { ok: false, error: 'L’heure de fin doit être après l’heure de début' }
  if (diff > CRENEAU_MAX_MINUTES) {
    return { ok: false, error: 'Le créneau ne peut pas dépasser 2 heures' }
  }
  return { ok: true }
}

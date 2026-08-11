/**
 * Meta terrain pour l'étape « Attestation de conformité »
 * (stockée dans interventions.rapport_json, hors contenu rédactionnel).
 */

export type AttestationConformiteStatus = 'skipped' | 'generated'

export type AttestationConformiteMeta = {
  status: AttestationConformiteStatus
  at: string
  document_id?: string | null
}

export function getAttestationConformiteMeta(rapportJson: unknown): AttestationConformiteMeta | null {
  if (!rapportJson || typeof rapportJson !== 'object') return null
  const raw = (rapportJson as { attestation_conformite?: unknown }).attestation_conformite
  if (!raw || typeof raw !== 'object') return null
  const status = (raw as { status?: unknown }).status
  if (status !== 'skipped' && status !== 'generated') return null
  const at = typeof (raw as { at?: unknown }).at === 'string'
    ? (raw as { at: string }).at
    : new Date().toISOString()
  const document_id = typeof (raw as { document_id?: unknown }).document_id === 'string'
    ? (raw as { document_id: string }).document_id
    : null
  return { status, at, document_id }
}

export function isAttestationConformiteResolved(
  rapportJson: unknown,
  hasAttestationDocument = false,
): boolean {
  if (hasAttestationDocument) return true
  const meta = getAttestationConformiteMeta(rapportJson)
  return meta?.status === 'skipped' || meta?.status === 'generated'
}

/** Fusionne la meta dans rapport_json sans écraser le contenu du rapport. */
export function mergeAttestationConformiteMeta(
  rapportJson: unknown,
  meta: AttestationConformiteMeta,
): Record<string, unknown> {
  const base =
    rapportJson && typeof rapportJson === 'object'
      ? { ...(rapportJson as Record<string, unknown>) }
      : {}
  return {
    ...base,
    attestation_conformite: meta,
  }
}

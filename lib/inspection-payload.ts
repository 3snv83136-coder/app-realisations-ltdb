/**
 * Allège un InspectionData pour le transport HTTP (évite HTTP 413 Vercel ~4.5 Mo).
 * Les photos / schéma data:image restent dans le PDF joint ; on ne les re-duplique pas en JSON.
 */
import type { InspectionData } from '@/components/InspectionCameraPDF'

const DATA_URL_RE = /^data:/i

function stripHeavyUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (DATA_URL_RE.test(url)) return undefined
  // URLs http(s) / storage : on garde (légères)
  return url
}

/** Copie sans data URLs lourdes (photos, schéma, carte, couverture). */
export function slimInspectionForTransport(data: InspectionData): InspectionData {
  return {
    ...data,
    mapImageUrl: stripHeavyUrl(data.mapImageUrl),
    coverPhotoUrl: stripHeavyUrl(data.coverPhotoUrl),
    schemaReseauUrl: stripHeavyUrl(data.schemaReseauUrl),
    troncons: (data.troncons || []).map(t => ({
      ...t,
      observations: (t.observations || []).map(o => ({
        ...o,
        photoUrl: stripHeavyUrl(o.photoUrl),
      })),
    })),
  }
}

/** Message clair quand Vercel / le proxy coupe la requête. */
export function inspectionPayloadTooLargeMessage(status?: number): string {
  if (status === 413) {
    return 'Fichier trop volumineux pour l’envoi automatique (limite serveur). Télécharge le PDF et envoie-le par mail, ou retire des photos puis réessaie.'
  }
  return 'Envoi impossible (payload trop lourd).'
}

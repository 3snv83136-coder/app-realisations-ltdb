import { proxyImageUrl, proxyImageUrlAbsolute } from '@/lib/proxyImageUrl'
import { getSignatureClientFromRapport } from '@/lib/sync-signature-rapport'

/** Fichier statique dans /public — signature universelle LTDB sur les rapports. */
export const LTDB_SIGNATURE_PATH = '/signature-ltdb.png'

/** URL absolue pour @react-pdf/renderer côté serveur ou client. */
export function getLtdbSignatureUrl(baseUrl?: string): string {
  const path = LTDB_SIGNATURE_PATH
  if (baseUrl) return proxyImageUrlAbsolute(path, baseUrl.replace(/\/+$/, ''))
  if (typeof window !== 'undefined') {
    return proxyImageUrlAbsolute(path, window.location.origin)
  }
  return path
}

/** URL client pour react-pdf (proxy CORS si URL externe Supabase). */
export function getClientSignatureForPdf(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  return proxyImageUrl(url.trim())
}

export type RapportSignatureProps = {
  signatureLtdbUrl?: string
  signatureClientUrl?: string | null
  signatureClientDate?: string | null
}

/** Charge la signature client (accord validé ou copie dans rapport_json). */
export async function fetchAccordSignatureForRapport(
  interventionId: string,
): Promise<{ url: string | null; date: string | null }> {
  try {
    const [accordRes, intRes] = await Promise.all([
      fetch(`/api/interventions/${interventionId}/accord`, { cache: 'no-store' }),
      fetch(`/api/interventions/${interventionId}`, { cache: 'no-store' }),
    ])
    const accordData = await accordRes.json()
    if (accordRes.ok && accordData.accord?.statut === 'VALIDE' && accordData.accord.signature_image) {
      return {
        url: accordData.accord.signature_image,
        date: accordData.accord.valide_at || null,
      }
    }
    const intData = await intRes.json()
    const fromRapport = getSignatureClientFromRapport(intData.intervention?.rapport_json)
    if (fromRapport) {
      return { url: fromRapport.image_url, date: fromRapport.valide_at || null }
    }
    return { url: null, date: null }
  } catch {
    return { url: null, date: null }
  }
}

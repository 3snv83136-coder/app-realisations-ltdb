import { proxyImageUrl, proxyImageUrlAbsolute } from '@/lib/proxyImageUrl'

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

/** Charge signature client depuis l'accord validé lié à l'intervention. */
export async function fetchAccordSignatureForRapport(
  interventionId: string,
): Promise<{ url: string | null; date: string | null }> {
  try {
    const res = await fetch(`/api/interventions/${interventionId}/accord`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok || !data.accord || data.accord.statut !== 'VALIDE') {
      return { url: null, date: null }
    }
    return {
      url: data.accord.signature_image || null,
      date: data.accord.valide_at || null,
    }
  } catch {
    return { url: null, date: null }
  }
}

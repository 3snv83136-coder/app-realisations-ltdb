import type { SupabaseClient } from '@supabase/supabase-js'

export type SignatureClientRapport = {
  image_url: string
  valide_at: string
}

/** Copie la signature client dans rapport_json et invalide le PDF rapport pour regénération. */
export async function syncClientSignatureToRapport(
  sb: SupabaseClient,
  interventionId: string,
  signatureUrl: string,
  valideAt: string,
): Promise<void> {
  const { data: interv } = await sb
    .from('interventions')
    .select('rapport_json')
    .eq('id', interventionId)
    .maybeSingle()
  if (!interv) return

  const rapportJson = {
    ...(interv.rapport_json && typeof interv.rapport_json === 'object' ? interv.rapport_json : {}),
    signature_client: {
      image_url: signatureUrl,
      valide_at: valideAt,
    } satisfies SignatureClientRapport,
  }

  await sb
    .from('interventions')
    .update({
      rapport_json: rapportJson,
      pdf_rapport_url: null,
    })
    .eq('id', interventionId)
}

export function getSignatureClientFromRapport(rapportJson: unknown): SignatureClientRapport | null {
  if (!rapportJson || typeof rapportJson !== 'object') return null
  const sc = (rapportJson as Record<string, unknown>).signature_client
  if (!sc || typeof sc !== 'object') return null
  const row = sc as Record<string, unknown>
  if (typeof row.image_url !== 'string' || !row.image_url.trim()) return null
  return {
    image_url: row.image_url.trim(),
    valide_at: typeof row.valide_at === 'string' ? row.valide_at : '',
  }
}

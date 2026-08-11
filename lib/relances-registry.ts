import { Resend } from "resend"
import { getSupabaseOrNull } from "@/lib/supabase"

export type RegisteredRelanceKind =
  | "avis"
  | "devis"
  | "facture"
  | "devis_complementaire"
  | "autre"

export type RegisterRelanceInput = {
  kind: RegisteredRelanceKind
  sourceType: string
  sourceId: string
  providerId: string
  channel?: string
  sendAt?: string | null
  clientId?: string | null
  clientNom?: string | null
  clientEmail?: string | null
  ville?: string | null
  label: string
  interventionId?: string | null
  technicienId?: string | null
  href?: string | null
  metadata?: Record<string, unknown>
}

/** Enregistre des relances sans empêcher l'envoi si la migration n'est pas encore appliquée. */
export async function registerRelances(inputs: RegisterRelanceInput[]): Promise<void> {
  if (inputs.length === 0) return
  const sb = getSupabaseOrNull()
  if (!sb) return

  const rows = inputs.map(input => ({
    kind: input.kind,
    source_type: input.sourceType,
    source_id: input.sourceId,
    provider_id: input.providerId,
    channel: input.channel || "email",
    send_at: input.sendAt || null,
    status: "pending",
    client_id: input.clientId || null,
    client_nom: input.clientNom || null,
    client_email: input.clientEmail || null,
    ville: input.ville || null,
    label: input.label,
    intervention_id: input.interventionId || null,
    technicien_id: input.technicienId || null,
    href: input.href || null,
    metadata: input.metadata || {},
    updated_at: new Date().toISOString(),
  }))

  const { error } = await sb
    .from("relances_planifiees")
    .upsert(rows, { onConflict: "provider_id", ignoreDuplicates: true })

  if (error) {
    console.error("[relances-registry] register", error.message)
  }
}

/** Annule tous les envois encore actifs d'une source et synchronise le registre. */
export async function cancelRegisteredRelances(
  sourceType: string,
  sourceId: string,
): Promise<number> {
  const sb = getSupabaseOrNull()
  if (!sb) return 0

  const { data, error } = await sb
    .from("relances_planifiees")
    .select("id, provider_id")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("status", "pending")

  if (error) {
    console.error("[relances-registry] list before cancel", error.message)
    return 0
  }

  const rows = data || []
  const resendKey = process.env.RESEND_API_KEY
  let canceled = 0

  if (resendKey) {
    const resend = new Resend(resendKey)
    for (const row of rows) {
      if (!row.provider_id) continue
      try {
        const result = await resend.emails.cancel(row.provider_id)
        if (!result.error) canceled++
      } catch {
        // Un envoi déjà parti n'est plus annulable, mais ne doit plus rester actif.
      }
    }
  }

  if (rows.length > 0) {
    const { error: updateError } = await sb
      .from("relances_planifiees")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .in("id", rows.map(row => row.id))
    if (updateError) {
      console.error("[relances-registry] mark canceled", updateError.message)
    }
  }

  return canceled
}

export async function cancelRegisteredRelancesByProviderIds(ids: string[]): Promise<void> {
  const sb = getSupabaseOrNull()
  const providerIds = ids.filter(Boolean)
  if (!sb || providerIds.length === 0) return

  const { error } = await sb
    .from("relances_planifiees")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .in("provider_id", providerIds)
    .eq("status", "pending")

  if (error) {
    console.error("[relances-registry] sync public stop", error.message)
  }
}

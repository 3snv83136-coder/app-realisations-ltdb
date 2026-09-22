import type { SupabaseClient } from "@supabase/supabase-js"
import { detectTypeIntervention, isDevisIntervention } from "@/lib/types-intervention"

/**
 * Si la fiche est encore type « Devis » mais qu'un devis accepté / travaux
 * est lié, on la convertit en intervention terrain (Travaux assainissement…).
 * Retourne le type final (éventuellement inchangé).
 */
export async function promoteDevisFicheToTravaux(
  sb: SupabaseClient,
  interventionId: string,
  currentType: string | null | undefined,
): Promise<string | null> {
  if (!isDevisIntervention(currentType)) return currentType || null

  const { data: devis } = await sb
    .from("documents")
    .select("id, statut, payload, montant_ttc")
    .eq("intervention_id", interventionId)
    .eq("type", "devis")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!devis) return currentType || null

  const payload = (devis.payload && typeof devis.payload === "object")
    ? (devis.payload as Record<string, unknown>)
    : {}
  const objet = typeof payload.objet === "string" ? payload.objet : ""
  const variant = typeof payload.variant === "string" ? payload.variant : ""
  const accepted = devis.statut === "accepte" || !!payload.accepte_at

  // Ne convertit que si devis accepté OU variante travaux (chantier prévu).
  if (!accepted && variant !== "travaux-assainissement") {
    return currentType || null
  }

  let realType = "Travaux assainissement"
  if (variant === "travaux-assainissement") {
    realType = "Travaux assainissement"
  } else {
    const detected = detectTypeIntervention(objet)
    if (detected && detected !== "Devis") realType = detected
    else if (/pompe|relevage/i.test(objet)) realType = "Pompe de relevage"
  }

  const update: Record<string, unknown> = {
    type_intervention: realType,
    terrain_step: 0,
    statut: "planifiee",
  }
  if (accepted) update.devis_accepte_at = new Date().toISOString()
  if (typeof devis.montant_ttc === "number") update.prix_prevu = devis.montant_ttc

  await sb.from("interventions").update(update).eq("id", interventionId)
  return realType
}

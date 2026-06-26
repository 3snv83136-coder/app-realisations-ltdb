import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Numérotation séquentielle continue des documents (factures, devis).
 *
 * Format : FA-2026-0001 / DV-2026-0001 — compteur remis à 0001 chaque année.
 * Exigence légale FR : suite chronologique sans rupture ni doublon.
 *
 * L'allocation est atomique côté DB via la fonction `allocate_document_number`
 * (migration 019). Si la migration n'est pas encore appliquée, on bascule sur
 * un repli `max + 1` (moins robuste en concurrence, mais évite tout blocage).
 */

export type DocSequenceType = "facture" | "devis"

const PREFIX: Record<DocSequenceType, string> = {
  facture: "FA",
  devis: "DV",
}

function format(type: DocSequenceType, year: number, value: number): string {
  return `${PREFIX[type]}-${year}-${String(value).padStart(4, "0")}`
}

/**
 * Repli sans RPC : calcule le prochain numéro à partir du max existant pour
 * (type, année) au format séquentiel. Ignore l'ancien format horaire.
 */
async function allocateFallback(
  sb: SupabaseClient,
  type: DocSequenceType,
  year: number,
): Promise<string> {
  const prefix = `${PREFIX[type]}-${year}-`
  const { data } = await sb
    .from("documents")
    .select("numero")
    .eq("type", type)
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1)

  let next = 1
  const last = data?.[0]?.numero as string | undefined
  if (last) {
    const m = /-(\d{4})$/.exec(last)
    if (m) next = parseInt(m[1], 10) + 1
  }
  return format(type, year, next)
}

/**
 * Alloue le prochain numéro séquentiel pour un type de document.
 * À appeler côté serveur juste avant de figer le numéro dans le PDF + la DB.
 */
export async function allocateNumero(
  sb: SupabaseClient,
  type: DocSequenceType,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const { data, error } = await sb.rpc("allocate_document_number", {
    p_type: type,
    p_year: year,
  })

  if (!error && typeof data === "number") {
    return format(type, year, data)
  }

  // Migration 019 non appliquée (fonction absente) → repli max + 1.
  console.warn("[allocateNumero] RPC indisponible, repli max+1 :", error?.message)
  return allocateFallback(sb, type, year)
}

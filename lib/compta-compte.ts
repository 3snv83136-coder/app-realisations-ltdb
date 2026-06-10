import type { SupabaseClient } from "@supabase/supabase-js"
import { LTDB_BANK } from "@/lib/entreprise"

/** Retourne le compte bancaire actif principal (crée Qonto/LTDB si absent). */
export async function ensureCompteBancairePrincipal(sb: SupabaseClient): Promise<string> {
  const { data: existing } = await sb
    .from("comptes_bancaires")
    .select("id")
    .eq("actif", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const iban = LTDB_BANK.iban.replace(/\s+/g, "")
  const { data: created, error } = await sb
    .from("comptes_bancaires")
    .insert({
      banque: "Qonto",
      iban,
      libelle: "Compte principal LTDB",
      solde_initial: 0,
      actif: true,
    })
    .select("id")
    .single()

  if (error || !created?.id) {
    throw new Error(error?.message || "Impossible de créer le compte bancaire")
  }
  return created.id as string
}

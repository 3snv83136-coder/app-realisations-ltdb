import type { SupabaseClient } from "@supabase/supabase-js"
import {
  bornesMois,
  computeComptaKpis,
  periodeLabel,
  type DepenseKpi,
  type RecetteKpi,
} from "@/lib/compta-kpis"

export type PreBilanSnapshot = {
  periode: string
  periode_label: string
  kpis: ReturnType<typeof computeComptaKpis>
  recettes_count: number
  depenses_count: number
  factures_impayees: Array<{ id: string; numero: string | null; montant_ttc: number | null; client_nom: string | null }>
  operations_total: number
  operations_lettrees: number
  operations_non_lettrees: number
  taux_rapprochement: number
  releve_present: boolean
  releve_id: string | null
  alertes: string[]
}

export async function buildPreBilanSnapshot(
  sb: SupabaseClient,
  annee: number,
  mois: number,
): Promise<PreBilanSnapshot> {
  const { from, to } = bornesMois(annee, mois)
  const periode = `${annee}-${String(mois).padStart(2, "0")}`

  const { data: recRows } = await sb
    .from("documents")
    .select("id, numero, date_emission, statut, montant_ht, montant_ttc, client_id")
    .eq("type", "facture")
    .gte("date_emission", from)
    .lte("date_emission", to)

  const clientIds = Array.from(new Set((recRows || []).map(r => r.client_id).filter(Boolean))) as string[]
  let clientsMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: cls } = await sb.from("clients").select("id, nom").in("id", clientIds)
    if (cls) clientsMap = Object.fromEntries(cls.map(c => [c.id as string, (c.nom as string) || ""]))
  }

  const recettes: RecetteKpi[] = (recRows || []).map(r => ({
    id: r.id as string,
    numero: (r.numero as string | null) ?? null,
    date_emission: r.date_emission as string,
    statut: (r.statut as string) || "",
    montant_ht: (r.montant_ht as number | null) ?? null,
    montant_ttc: (r.montant_ttc as number | null) ?? null,
    client_nom: r.client_id ? clientsMap[r.client_id as string] || null : null,
  }))

  const { data: depRows } = await sb
    .from("factures_fournisseurs")
    .select("id, fournisseur, date_facture, montant_ht, montant_ttc, tva, categorie")
    .gte("date_facture", from)
    .lte("date_facture", to)

  const depenses: DepenseKpi[] = (depRows || []).map(d => ({
    id: d.id as string,
    fournisseur: (d.fournisseur as string) || "",
    date_facture: d.date_facture as string,
    montant_ht: Number(d.montant_ht) || 0,
    montant_ttc: Number(d.montant_ttc) || 0,
    tva: Number(d.tva) || 0,
    categorie: (d.categorie as string | null) ?? null,
  }))

  const { data: impayees } = await sb
    .from("documents")
    .select("id, numero, montant_ttc, client_id, statut")
    .eq("type", "facture")
    .in("statut", ["envoye", "brouillon"])
    .lte("date_emission", to)

  const impClientIds = Array.from(new Set((impayees || []).map(r => r.client_id).filter(Boolean))) as string[]
  if (impClientIds.length > 0) {
    const { data: cls } = await sb.from("clients").select("id, nom").in("id", impClientIds)
    if (cls) {
      for (const c of cls) clientsMap[c.id as string] = (c.nom as string) || ""
    }
  }

  const { data: releve } = await sb
    .from("releves_bancaires")
    .select("id")
    .eq("periode_annee", annee)
    .eq("periode_mois", mois)
    .maybeSingle()

  const { data: ops } = await sb
    .from("operations_bancaires")
    .select("id, lettre")
    .gte("date_operation", from)
    .lte("date_operation", to)

  const operations_total = ops?.length || 0
  const operations_lettrees = (ops || []).filter(o => o.lettre).length
  const operations_non_lettrees = operations_total - operations_lettrees
  const taux_rapprochement = operations_total > 0
    ? Math.round((operations_lettrees / operations_total) * 1000) / 10
    : 0

  const alertes: string[] = []
  if (!releve?.id) alertes.push("Relevé bancaire manquant pour cette période")
  if (operations_non_lettrees > 0) {
    alertes.push(`${operations_non_lettrees} opération(s) bancaire(s) non rapprochée(s)`)
  }
  const sansCategorie = depenses.filter(d => !d.categorie).length
  if (sansCategorie > 0) alertes.push(`${sansCategorie} dépense(s) sans catégorie`)

  const kpis = computeComptaKpis(recettes, depenses)

  return {
    periode,
    periode_label: periodeLabel(annee, mois),
    kpis,
    recettes_count: recettes.filter(r => r.statut !== "annule").length,
    depenses_count: depenses.length,
    factures_impayees: (impayees || []).map(r => ({
      id: r.id as string,
      numero: (r.numero as string | null) ?? null,
      montant_ttc: (r.montant_ttc as number | null) ?? null,
      client_nom: r.client_id ? clientsMap[r.client_id as string] || null : null,
    })),
    operations_total,
    operations_lettrees,
    operations_non_lettrees,
    taux_rapprochement,
    releve_present: !!releve?.id,
    releve_id: (releve?.id as string) || null,
    alertes,
  }
}

export async function upsertPreBilan(
  sb: SupabaseClient,
  annee: number,
  mois: number,
): Promise<{ id: string; snapshot: PreBilanSnapshot }> {
  const snapshot = await buildPreBilanSnapshot(sb, annee, mois)

  const { data: existing } = await sb
    .from("pre_bilans")
    .select("id, statut")
    .eq("periode_annee", annee)
    .eq("periode_mois", mois)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await sb
      .from("pre_bilans")
      .update({
        snapshot,
        releve_id: snapshot.releve_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    return { id: data.id as string, snapshot }
  }

  const { data, error } = await sb
    .from("pre_bilans")
    .insert({
      periode_annee: annee,
      periode_mois: mois,
      snapshot,
      releve_id: snapshot.releve_id,
      statut: "brouillon",
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return { id: data.id as string, snapshot }
}

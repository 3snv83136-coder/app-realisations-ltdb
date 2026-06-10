export type RecetteKpi = {
  id: string
  numero: string | null
  date_emission: string
  statut: string
  montant_ht: number | null
  montant_ttc: number | null
  client_nom: string | null
}

export type DepenseKpi = {
  id: string
  fournisseur: string
  date_facture: string
  montant_ht: number
  montant_ttc: number
  tva: number
  categorie: string | null
}

export type ComptaKpis = {
  ca_ht: number
  ca_ttc: number
  tva_collectee: number
  dep_ht: number
  dep_ttc: number
  tva_deductible: number
  resultat_brut_ht: number
  marge: number
}

export function computeComptaKpis(recettes: RecetteKpi[], depenses: DepenseKpi[]): ComptaKpis {
  const recettesActives = recettes.filter(r => r.statut !== "annule")
  const ca_ht = recettesActives.reduce((s, r) => s + (r.montant_ht || 0), 0)
  const ca_ttc = recettesActives.reduce((s, r) => s + (r.montant_ttc || 0), 0)
  const tva_collectee = ca_ttc - ca_ht

  const dep_ht = depenses.reduce((s, d) => s + (d.montant_ht || 0), 0)
  const dep_ttc = depenses.reduce((s, d) => s + (d.montant_ttc || 0), 0)
  const tva_deductible = depenses.reduce((s, d) => s + (d.tva || 0), 0)

  const resultat_brut_ht = ca_ht - dep_ht
  const marge = ca_ht > 0 ? (resultat_brut_ht / ca_ht) * 100 : 0

  return { ca_ht, ca_ttc, tva_collectee, dep_ht, dep_ttc, tva_deductible, resultat_brut_ht, marge }
}

export function periodeLabel(annee: number, mois: number): string {
  const d = new Date(annee, mois - 1, 1)
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

export function moisPrecedent(ref = new Date()): { annee: number; mois: number } {
  const d = new Date(ref.getFullYear(), ref.getMonth() - 1, 1)
  return { annee: d.getFullYear(), mois: d.getMonth() + 1 }
}

export function bornesMois(annee: number, mois: number): { from: string; to: string } {
  const from = `${annee}-${String(mois).padStart(2, "0")}-01`
  const last = new Date(annee, mois, 0).getDate()
  const to = `${annee}-${String(mois).padStart(2, "0")}-${String(last).padStart(2, "0")}`
  return { from, to }
}

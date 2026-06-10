/** Plan comptable LTDB (PCG simplifié — aligné export FEC). */

export type CompteComptable = {
  num: string
  lib: string
  groupe: "tresorerie" | "tiers" | "charges" | "produits" | "tva" | "autre"
}

export const COMPTE_BANQUE: CompteComptable = { num: "512000", lib: "Banque", groupe: "tresorerie" }
export const COMPTE_CLIENTS: CompteComptable = { num: "411000", lib: "Clients", groupe: "tiers" }
export const COMPTE_FOURNISSEURS: CompteComptable = { num: "401000", lib: "Fournisseurs", groupe: "tiers" }
export const COMPTE_VENTES: CompteComptable = { num: "706000", lib: "Prestations de services", groupe: "produits" }

export const COMPTES_CHARGES: Record<string, CompteComptable> = {
  carburant:      { num: "60611", lib: "Carburants", groupe: "charges" },
  materiel:       { num: "60630", lib: "Petit matériel", groupe: "charges" },
  sous_traitance: { num: "6041",  lib: "Sous-traitance", groupe: "charges" },
  assurance:      { num: "6160",  lib: "Assurances", groupe: "charges" },
  telecom:        { num: "6260",  lib: "Télécommunications", groupe: "charges" },
  locaux:         { num: "6132",  lib: "Locations immobilières", groupe: "charges" },
  autre:          { num: "6068",  lib: "Autres charges", groupe: "charges" },
}

/** Comptes proposés pour affectation manuelle (débit sans facture ou doute). */
export const COMPTES_AFFECTABLES: CompteComptable[] = [
  COMPTE_BANQUE,
  COMPTE_CLIENTS,
  COMPTE_FOURNISSEURS,
  COMPTE_VENTES,
  ...Object.values(COMPTES_CHARGES),
  { num: "641000", lib: "Rémunérations du personnel", groupe: "charges" },
  { num: "421000", lib: "Personnel — rémunérations dues", groupe: "tiers" },
  { num: "431000", lib: "Sécurité sociale", groupe: "tiers" },
  { num: "627000", lib: "Services bancaires", groupe: "charges" },
  { num: "658000", lib: "Charges diverses", groupe: "charges" },
  { num: "758000", lib: "Produits divers", groupe: "produits" },
  { num: "445660", lib: "TVA déductible", groupe: "tva" },
  { num: "445710", lib: "TVA collectée", groupe: "tva" },
]

const BY_NUM = new Map(COMPTES_AFFECTABLES.map(c => [c.num, c]))

export function compteFromCategorie(categorie: string | null | undefined): CompteComptable | null {
  if (!categorie) return null
  return COMPTES_CHARGES[categorie] || COMPTES_CHARGES.autre
}

export function compteByNum(num: string | null | undefined): CompteComptable | null {
  if (!num) return null
  return BY_NUM.get(num) || { num, lib: num, groupe: "autre" }
}

export function compteLabel(c: CompteComptable | null): string {
  if (!c) return "—"
  return `${c.num} — ${c.lib}`
}

export const GROUPE_LABELS: Record<CompteComptable["groupe"], string> = {
  tresorerie: "Trésorerie",
  tiers: "Tiers",
  charges: "Charges",
  produits: "Produits",
  tva: "TVA",
  autre: "Autre",
}

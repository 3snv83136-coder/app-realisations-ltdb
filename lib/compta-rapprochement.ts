const MONTANT_TOLERANCE = 0.02

export type OperationBancaire = {
  id: string
  date_operation: string
  libelle: string
  debit: number
  credit: number
  lettre: boolean
}

export type FactureClient = {
  id: string
  numero: string | null
  date_emission: string
  montant_ttc: number | null
  statut: string
  client_nom?: string | null
}

export type FactureFournisseur = {
  id: string
  fournisseur: string
  date_facture: string
  montant_ttc: number
}

export type MatchSuggere = {
  operation_id: string
  type: "recette" | "depense"
  cible_id: string
  label: string
  montant: number
  score: number
}

function montantsProches(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONTANT_TOLERANCE
}

function joursEntre(d1: string, d2: string): number {
  const a = new Date(d1).getTime()
  const b = new Date(d2).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 999
  return Math.abs(Math.round((a - b) / (24 * 60 * 60 * 1000)))
}

/** Suggestions de rapprochement par montant + proximité de date (±14 j). */
export function suggererRapprochements(
  operations: OperationBancaire[],
  recettes: FactureClient[],
  depenses: FactureFournisseur[],
): MatchSuggere[] {
  const suggestions: MatchSuggere[] = []
  const ops = operations.filter(o => !o.lettre)

  for (const op of ops) {
    if (op.credit > 0) {
      for (const r of recettes) {
        const ttc = r.montant_ttc || 0
        if (!montantsProches(op.credit, ttc)) continue
        const score = 100 - joursEntre(op.date_operation, r.date_emission) * 3
        suggestions.push({
          operation_id: op.id,
          type: "recette",
          cible_id: r.id,
          label: `Facture ${r.numero || r.id.slice(0, 8)}${r.client_nom ? ` — ${r.client_nom}` : ""}`,
          montant: ttc,
          score,
        })
      }
    }
    if (op.debit > 0) {
      for (const d of depenses) {
        if (!montantsProches(op.debit, d.montant_ttc)) continue
        const score = 100 - joursEntre(op.date_operation, d.date_facture) * 3
        suggestions.push({
          operation_id: op.id,
          type: "depense",
          cible_id: d.id,
          label: `${d.fournisseur} — ${d.date_facture}`,
          montant: d.montant_ttc,
          score,
        })
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score)

  const usedOps = new Set<string>()
  const usedCibles = new Set<string>()
  const deduped: MatchSuggere[] = []

  for (const s of suggestions) {
    const cibleKey = `${s.type}:${s.cible_id}`
    if (usedOps.has(s.operation_id) || usedCibles.has(cibleKey)) continue
    if (s.score < 50) continue
    usedOps.add(s.operation_id)
    usedCibles.add(cibleKey)
    deduped.push(s)
  }

  return deduped
}

import type { FactureLineData } from "@/components/FacturePDF"

/** Sous-total HT des lignes positives (hors inclus, hors remises déjà présentes). */
export function sousTotalFacturePositif(lignes: FactureLineData[]): number {
  return lignes.reduce((sum, l) => {
    if (l.inclus) return sum
    const tot = (Number(l.pu_ht) || 0) * (Number(l.qte) || 0)
    return tot > 0 ? sum + tot : sum
  }, 0)
}

/** Construit une ligne de remise commerciale (montant HT négatif). */
export function buildRemiseLine(opts: {
  montantHt: number
  designation?: string
  description?: string
}): FactureLineData {
  const montant = Math.abs(Number(opts.montantHt) || 0)
  return {
    designation: (opts.designation || "Remise commerciale").trim() || "Remise commerciale",
    description: opts.description?.trim() || undefined,
    qte: 1,
    unite: "forfait",
    pu_ht: -Math.round(montant * 100) / 100,
    inclus: false,
  }
}

export function isRemiseLine(l: FactureLineData): boolean {
  return !l.inclus && (Number(l.pu_ht) || 0) * (Number(l.qte) || 0) < 0
}

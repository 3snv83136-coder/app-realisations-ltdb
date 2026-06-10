import {
  COMPTE_BANQUE,
  COMPTE_CLIENTS,
  compteByNum,
  compteFromCategorie,
  type CompteComptable,
} from "@/lib/compta-plan"

export type AffectationInput = {
  debit: number
  credit: number
  document_id?: string | null
  facture_fournisseur_id?: string | null
  categorie?: string | null
  compte_num?: string | null
  compte_lib?: string | null
}

export type AffectationResult = {
  compte_num: string
  compte_lib: string
  compte_contrepartie: CompteComptable
  sens: "encaissement" | "decaissement"
}

export type AffectationValidation =
  | { ok: true; affectation: AffectationResult }
  | { ok: false; error: string; needs_compte: boolean }

/**
 * Détermine le compte de contrepartie (hors banque 512) pour une opération lettrée.
 * Si ambigu → needs_compte pour forcer le choix utilisateur.
 */
export function resoudreAffectation(input: AffectationInput): AffectationValidation {
  const isEncaissement = input.credit > 0
  const isDecaissement = input.debit > 0

  if (!isEncaissement && !isDecaissement) {
    return { ok: false, error: "Montant nul", needs_compte: false }
  }

  if (input.document_id && input.facture_fournisseur_id) {
    return { ok: false, error: "Une seule facture (client ou fournisseur) à la fois", needs_compte: false }
  }

  if (input.document_id) {
    return {
      ok: true,
      affectation: {
        compte_num: COMPTE_CLIENTS.num,
        compte_lib: COMPTE_CLIENTS.lib,
        compte_contrepartie: COMPTE_CLIENTS,
        sens: "encaissement",
      },
    }
  }

  if (input.facture_fournisseur_id) {
    const charge = compteFromCategorie(input.categorie)
    if (charge) {
      return {
        ok: true,
        affectation: {
          compte_num: charge.num,
          compte_lib: charge.lib,
          compte_contrepartie: charge,
          sens: "decaissement",
        },
      }
    }
    if (input.compte_num) {
      const c = compteByNum(input.compte_num)
      if (!c) return { ok: false, error: "Compte comptable invalide", needs_compte: true }
      return {
        ok: true,
        affectation: {
          compte_num: c.num,
          compte_lib: input.compte_lib || c.lib,
          compte_contrepartie: c,
          sens: "decaissement",
        },
      }
    }
    return {
      ok: false,
      error: "Facture fournisseur sans catégorie : choisissez le compte de charge",
      needs_compte: true,
    }
  }

  if (input.compte_num) {
    const c = compteByNum(input.compte_num)
    if (!c) return { ok: false, error: "Compte comptable invalide", needs_compte: true }
    return {
      ok: true,
      affectation: {
        compte_num: c.num,
        compte_lib: input.compte_lib || c.lib,
        compte_contrepartie: c,
        sens: isEncaissement ? "encaissement" : "decaissement",
      },
    }
  }

  return {
    ok: false,
    error: isEncaissement
      ? "Sélectionnez une facture client ou un compte produit/tiers"
      : "Sélectionnez une facture fournisseur ou un compte de charge",
    needs_compte: true,
  }
}

/** Écriture simplifiée affichée en UI : Débit / Crédit sur 512 + contrepartie. */
export function libelleEcriture(a: AffectationResult, montant: number): string {
  const m = montant.toFixed(2).replace(".", ",")
  if (a.sens === "encaissement") {
    return `D ${COMPTE_BANQUE.num} ${m} € / C ${a.compte_num} ${a.compte_lib}`
  }
  return `D ${a.compte_num} ${a.compte_lib} / C ${COMPTE_BANQUE.num} ${m} €`
}

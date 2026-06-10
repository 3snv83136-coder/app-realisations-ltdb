import type { EmetteurData } from "@/components/DevisPDF"
import type { Agence } from "@/lib/agences"
import {
  LTDB_BANK,
  LTDB_FORME_JURIDIQUE,
  LTDB_RCS,
  LTDB_SIRET,
  LTDB_TVA_INTRACOM,
} from "@/lib/entreprise"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/**
 * Identité émetteur LTDB partagée par toutes les pages qui génèrent des PDFs
 * (facture, devis, attestation, historique). Source unique de vérité — modifier
 * ici met à jour tous les documents. Le téléphone reste centralisé dans
 * `lib/parametres.ts` (constante `TEL_PRINCIPAL_FALLBACK`, repli de la table
 * `parametres`).
 */
export const LTDB_EMETTEUR: EmetteurData = {
  raisonSociale: "Les Techniciens du Débouchage",
  adresseLignes: ["700 Avenue du 15ème Corps", "83200 Toulon"],
  telephone: TEL_PRINCIPAL_FALLBACK,
  email: "contact@lestechniciensdudebouchage.fr",
  rcs: LTDB_RCS,
  capital: LTDB_FORME_JURIDIQUE,
  siret: LTDB_SIRET,
  tva: LTDB_TVA_INTRACOM,
  iban: LTDB_BANK.iban,
  bic: LTDB_BANK.bic,
}

export type FactureEmetteurDataLite = EmetteurData & { agence?: Agence | string }

/**
 * Construit l'émetteur facture pour une agence donnée (ou sans agence).
 * `telephone` peut être surchargé (ex. valeur fraîche lue depuis `parametres`) ;
 * sinon on retombe sur la constante centralisée.
 */
export function ltdbFactureEmetteur(agence?: Agence | string, telephone?: string): FactureEmetteurDataLite {
  return {
    ...LTDB_EMETTEUR,
    telephone: telephone?.trim() || LTDB_EMETTEUR.telephone,
    agence: agence || undefined,
  }
}

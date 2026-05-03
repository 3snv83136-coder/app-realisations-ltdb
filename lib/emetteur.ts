import type { EmetteurData } from "@/components/DevisPDF"
import type { Agence } from "@/lib/agences"

/**
 * Identité émetteur LTDB partagée par toutes les pages qui génèrent des PDFs
 * (facture, devis, attestation, historique). Source unique de vérité — modifier
 * ici met à jour tous les documents.
 */
export const LTDB_EMETTEUR: EmetteurData = {
  raisonSociale: 'LTDB — Les Techniciens du Débouchage',
  adresseLignes: ['700 Avenue du 15ème Corps', '83000 Toulon'],
  telephone: '07 83 63 68 35',
  email: 'contact@lestechniciensdudebouchage.fr',
  rcs: '',
  capital: '',
  siret: '',
}

export type FactureEmetteurDataLite = EmetteurData & { agence?: Agence | string }

/** Construit l'émetteur facture pour une agence donnée (ou sans agence). */
export function ltdbFactureEmetteur(agence?: Agence | string): FactureEmetteurDataLite {
  return { ...LTDB_EMETTEUR, agence: agence || undefined }
}

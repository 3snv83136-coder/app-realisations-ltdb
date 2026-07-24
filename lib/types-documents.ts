/**
 * Types des JSON métier LTDB — source unique de vérité.
 *
 * Couvre les colonnes `interventions.rapport_json` / `interventions.seo_json`
 * et `documents.payload` (facture / devis / attestation), tels que produits
 * par /api/generate* et consommés par les routes save-* et notify-*, la
 * publication site et les composants PDF.
 *
 * Les payloads devis / facture / attestation sont définis dans leurs
 * composants PDF respectifs (source de vérité du rendu) et ré-exportés ici
 * pour que le code serveur n'importe qu'un seul module.
 */

/* ─── Rapport d'intervention (interventions.rapport_json) ─── */

/** Statut technique d'une phase / ligne d'analyse (badge du PDF). */
export type StatutTechnique = 'critical' | 'warn' | 'info' | 'ok' | 'neutral'

export interface RapportPhase {
  titre: string
  statut?: StatutTechnique
  contexte: string
  action: string
  resultat: string
}

export interface RapportAnalyseRow {
  probleme: string
  localisation: string
  description: string
  statut: StatutTechnique
  label: string
}

export interface RapportPrecoItem { k: string; v: string }

export interface RapportPreco {
  tag: string
  titre: string
  items: RapportPrecoItem[]
}

export interface RapportDevisLine {
  section?: string
  designation: string
  description?: string
  qte: number
  pu_ht: number
}

/** Devis embarqué dans un rapport (si le technicien a dicté des montants). */
export interface RapportDevis {
  numero?: string
  validite_jours?: number
  lignes: RapportDevisLine[]
  tva_taux?: number
  conditions?: string[]
}

export interface RapportAvisTechnique {
  titre: string
  niveau?: StatutTechnique
  intro: string
  points_majeurs: string[]
  diagnostic_final: string
  recommandation_urgente: string
}

export interface RapportGarantie {
  est_garanti: boolean
  commentaire?: string
  saisi_at?: string
}

export interface RapportData {
  diagnostic: string
  travaux_realises: string
  recommandations: string
  commentaire_technicien: string
  objet?: string
  contexte?: string
  localisation?: { zone: string; configuration: string }
  materiel_utilise?: string[]
  duree_intervention?: string
  conditions_intervention?: string
  phases?: RapportPhase[]
  avis_technique?: RapportAvisTechnique | null
  analyse_table?: RapportAnalyseRow[]
  preconisations?: RapportPreco[]
  devis?: RapportDevis | null
  reference?: string
  garantie_intervention?: RapportGarantie | null
}

/* ─── SEO de publication (interventions.seo_json) ─── */

export interface SeoFaqItem { question: string; reponse: string }

export interface SeoRelatedService { label: string; url: string }

export interface SeoTechnicien {
  nom: string
  photo_url?: string | null
  annees_experience?: number | null
  titre_metier?: string | null
}

/** Résumé structuré « réponse IA » (lieu / problème / cause / solution / durée / résultat). */
export type ResumeIntervention = {
  lieu?: string
  probleme?: string
  cause?: string
  solution?: string
  duree?: string
  resultat?: string
}

/**
 * Tous les champs sont optionnels : le SEO peut être `{}` si le parsing IA a
 * échoué (le wizard Mode Terrain n'en a pas besoin) — les consommateurs
 * doivent donc toujours prévoir l'absence d'un champ.
 */
export interface SeoData {
  meta_title?: string
  titre_h1?: string
  meta_description?: string
  resume_rich_snippet?: string
  resume_intervention?: ResumeIntervention | null
  expertise_locale?: string
  meta_keywords?: string[]
  faq?: SeoFaqItem[]
  related_services?: SeoRelatedService[]
  contenu_principal?: string
  slug?: string
  page_url?: string
  city_page_url?: string
  technicien?: SeoTechnicien
  /** Graphe JSON-LD schema.org injecté dans la page publiée. */
  jsonld?: Record<string, unknown>
}

/* ─── Payloads documents (documents.payload) ─── */

export type { FactureData, FactureLineData } from "@/components/FacturePDF"
export type {
  DevisData,
  DevisLineData,
  DevisConditions,
  DevisModalites,
  DevisConstatItem,
  EmetteurData,
  ClientData,
} from "@/components/DevisPDF"
export type {
  AttestationData,
  AttestationObservation,
  Variante as AttestationVariante,
} from "@/components/AttestationPDF"
export type {
  InspectionData,
  ObservationItem as InspectionObservation,
  TronconBloc as InspectionTronconBloc,
  ConclusionEtat as InspectionConclusionEtat,
} from "@/components/InspectionCameraPDF"

import type { FactureData } from "@/components/FacturePDF"
import type { DevisData } from "@/components/DevisPDF"
import type { AttestationData } from "@/components/AttestationPDF"
import type { InspectionData } from "@/components/InspectionCameraPDF"

/** Métadonnées LTDB fusionnées dans le payload facture (relances Resend). */
export interface FacturePayloadMeta {
  relance_ids?: string[]
  relance_planifiees?: number
}

/** Payload facture tel que stocké en base (facture + méta relances). */
export type FacturePayload = FactureData & { _ltdb_meta?: FacturePayloadMeta }

/**
 * Payload d'une ligne `documents` — la forme dépend de `documents.type`
 * ('facture' | 'devis' | 'attestation' | 'inspection'). `Partial` car les brouillons et
 * anciens enregistrements peuvent être incomplets.
 */
export type DocumentPayload =
  | Partial<FacturePayload>
  | Partial<DevisData>
  | Partial<AttestationData>
  | Partial<InspectionData>

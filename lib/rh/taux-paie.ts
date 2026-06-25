/**
 * Taux et barèmes de paie EN VIGUEUR — source unique de vérité.
 *
 * Valeurs vérifiées le 25/06/2026 :
 *  - SMIC horaire brut : 12,31 € (arrêté du 22/05/2026, en vigueur au 01/06/2026)
 *    → SMIC mensuel 35 h : 1 867,02 €
 *  - Plafond mensuel Sécurité sociale (PMSS) : 4 005 € (arrêté du 22/12/2025, 2026)
 *    → PASS annuel : 48 060 €
 *
 * Le cron mensuel `/api/cron/controle-taux-paie` compare ces valeurs aux montants
 * officiels publiés (service-public.fr / urssaf.fr) et alerte par e-mail si un
 * écart est détecté — pour mettre à jour ce fichier en cas de revalorisation.
 *
 * ⚠️ Cotisations à faire valider par votre expert-comptable (non-cadre, < 50 salariés).
 */

export const PAIE_ANNEE = 2026

// ── Bases légales ──────────────────────────────────────────────────────────
export const SMIC_HORAIRE = 12.31
export const SMIC_MENSUEL = 1867.02
export const PMSS = 4005
export const PASS = 48060
export const HEURES_MENSUELLES = 151.67

// Plafonds en multiples de SMIC pour les taux réduits employeur
export const SEUIL_MALADIE_REDUIT = 2.5 // ≤ 2,5 SMIC → maladie patronale réduite
export const SEUIL_FAMILLE_REDUIT = 3.5 // ≤ 3,5 SMIC → allocations familiales réduites

export type TauxLigne = { sal: number; pat: number }

/**
 * Taux de cotisations en % (salarial / patronal), barème 2026.
 * Sources : BOSS, URSSAF — non-cadre, entreprise de moins de 50 salariés.
 */
export const TAUX = {
  maladieReduit: { sal: 0, pat: 7.0 }, // rémunération ≤ 2,5 SMIC
  maladiePlein: { sal: 0, pat: 13.0 }, // rémunération > 2,5 SMIC
  vieillessePlafonnee: { sal: 6.9, pat: 8.55 },
  vieillesseDeplafonnee: { sal: 0.4, pat: 2.02 },
  retraiteComplementaireT1: { sal: 3.15, pat: 4.72 },
  cegT1: { sal: 0.86, pat: 1.29 }, // contribution d'équilibre général T1
  familleReduit: { sal: 0, pat: 3.45 }, // rémunération ≤ 3,5 SMIC
  famillePlein: { sal: 0, pat: 5.25 }, // rémunération > 3,5 SMIC
  chomage: { sal: 0, pat: 4.05 },
  ags: { sal: 0, pat: 0.25 },
  fnal: { sal: 0, pat: 0.1 }, // < 50 salariés
  csa: { sal: 0, pat: 0.3 }, // contribution solidarité autonomie
  csgDeductible: { sal: 6.8, pat: 0 },
  csgCrdsNonDeductible: { sal: 2.9, pat: 0 }, // 2,40 CSG + 0,50 CRDS
  atmpDefaut: { sal: 0, pat: 2.23 }, // taux notifié CARSAT — à personnaliser
} as const satisfies Record<string, TauxLigne>

// Assiette CSG/CRDS : 98,25 % du brut (abattement 1,75 % sous 4 PASS)
export const ASSIETTE_CSG = 0.9825

/**
 * Réduction générale des cotisations patronales (ex-Fillon) — paramètre T
 * maximal 2026, entreprise < 50 salariés (FNAL 0,10 %).
 */
export const REDUCTION_GENERALE_T = 0.3194

/**
 * Congés payés légaux : 2,5 jours ouvrables acquis par mois travaillé.
 */
export const CONGES_ACQUIS_PAR_MOIS = 2.5

/**
 * Signature stable du barème — toute modification des valeurs ci-dessous change
 * la signature. Permet au cron de tracer la version de barème utilisée.
 */
export function tauxPaieSignature(): string {
  const payload = {
    SMIC_HORAIRE,
    SMIC_MENSUEL,
    PMSS,
    PASS,
    TAUX,
    ASSIETTE_CSG,
    REDUCTION_GENERALE_T,
  }
  const json = JSON.stringify(payload)
  let h = 0
  for (let i = 0; i < json.length; i++) {
    h = (h * 31 + json.charCodeAt(i)) | 0
  }
  return `b${PAIE_ANNEE}-${(h >>> 0).toString(16)}`
}

/**
 * Calcul bulletin de paie — reproduit la matrice du bulletin de référence
 * (colonnes : Éléments de paie · Base · Taux · À déduire · À payer · Charges
 * patronales, regroupées par rubriques Santé / Retraite, avec récapitulatif
 * mensuel/annuel et compteur de congés).
 *
 * Barème salarié non-cadre (métropole, < 50 salariés). Taux centralisés dans
 * `lib/rh/taux-paie.ts` — vérifiés/contrôlés mensuellement par cron.
 * À faire valider par votre expert-comptable pour chaque cas particulier.
 */

import {
  ASSIETTE_CSG,
  CONGES_ACQUIS_PAR_MOIS,
  HEURES_MENSUELLES,
  PAIE_ANNEE,
  PMSS,
  REDUCTION_GENERALE_T,
  SEUIL_FAMILLE_REDUIT,
  SEUIL_MALADIE_REDUIT,
  SMIC_MENSUEL,
  TAUX,
  tauxPaieSignature,
} from "@/lib/rh/taux-paie"

// Conservé pour compatibilité avec les imports existants.
export const PAIE_PARAMS_2026 = {
  annee: PAIE_ANNEE,
  pmss: PMSS,
  assietteCsg: ASSIETTE_CSG,
  heuresMensuellesRef: HEURES_MENSUELLES,
} as const

export type FichePaieInput = {
  mois: number
  annee: number
  salaireBase?: number
  primes?: number
  primeAstreinte?: number
  prime13Mois?: number
  indemniteRepasNb?: number
  indemniteRepasMontant?: number
  acompte?: number
  heures?: number
  heuresSupp?: number
  congesPrisMois?: number
  datePaiement?: string
}

/** Une ligne de la grille principale du bulletin (6 colonnes). */
export type BulletinLigne = {
  section: string | null
  libelle: string
  base: number | null
  taux: number | null
  aDeduire: number
  aPayer: number
  chargePatronale: number
  bold?: boolean
}

export type RecapColonne = {
  heures: number
  heuresSupp: number
  brut: number
  baseSS: number
  plafondSS: number
  netImposable: number
  chargesPatronales: number
  totalVerse: number
  allegements: number
}

export type CongesLigne = { acquis: number; pris: number; solde: number }

export type BulletinPaieCalc = {
  periodeLabel: string
  mois: number
  annee: number
  salaireBase: number
  primes: number
  brut: number
  heures: number
  heuresSupp: number
  bareme: string
  lignes: BulletinLigne[]
  totalRetenuesSalariales: number
  totalChargesPatronales: number
  netImposable: number
  netAPayer: number
  acompte: number
  coutGlobalEmployeur: number
  allègementEmployeur: number
  datePaiement: string
  recapMensuel: RecapColonne
  recapAnnuel: RecapColonne
  congesN1: CongesLigne
  congesN: CongesLigne
  cumuls: {
    brut: number
    netImposable: number
    netAPayer: number
    heures: number
    chargesPatronales: number
  }
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Construit une ligne de cotisation (salariale et/ou patronale). */
function cotis(
  section: string | null,
  libelle: string,
  base: number,
  tauxSal: number,
  tauxPat: number,
): BulletinLigne {
  const aDeduire = r2(base * tauxSal / 100)
  const chargePatronale = r2(base * tauxPat / 100)
  // Taux affiché : salarial si retenue, sinon patronal (cas charges employeur).
  const taux = tauxSal > 0 ? tauxSal : (tauxPat > 0 ? tauxPat : null)
  return { section, libelle, base: r2(base), taux, aDeduire, aPayer: 0, chargePatronale }
}

export type CumulsAnterieurs = {
  brut: number
  netImposable: number
  netAPayer: number
  heures: number
  chargesPatronales: number
}

export function calculerBulletinPaie(
  input: FichePaieInput,
  salaireBrutMensuel: number,
  cumulsAnterieurs: CumulsAnterieurs = {
    brut: 0, netImposable: 0, netAPayer: 0, heures: 0, chargesPatronales: 0,
  },
): BulletinPaieCalc {
  const mois = Math.min(12, Math.max(1, input.mois))
  const annee = input.annee || PAIE_ANNEE
  const salaireBase = r2(input.salaireBase ?? salaireBrutMensuel)
  const primeAstreinte = r2(input.primeAstreinte ?? 0)
  const prime13 = r2(input.prime13Mois ?? 0)
  const primesAutres = r2(input.primes ?? 0)
  const primes = r2(primeAstreinte + prime13 + primesAutres)
  const brut = r2(salaireBase + primes)
  const heures = input.heures ?? HEURES_MENSUELLES
  const heuresSupp = input.heuresSupp ?? 0
  const tauxHoraire = heures > 0 ? r2(salaireBase / heures) : 0

  const basePlafonnee = Math.min(brut, PMSS)
  const assietteCsgMontant = r2(brut * ASSIETTE_CSG)

  // Taux employeur réduits selon le niveau de rémunération.
  const maladie = brut <= SEUIL_MALADIE_REDUIT * SMIC_MENSUEL ? TAUX.maladieReduit : TAUX.maladiePlein
  const famille = brut <= SEUIL_FAMILLE_REDUIT * SMIC_MENSUEL ? TAUX.familleReduit : TAUX.famillePlein
  const autresPat = r2(TAUX.fnal.pat + TAUX.csa.pat + TAUX.ags.pat)

  const lignes: BulletinLigne[] = []

  // ── Gains ────────────────────────────────────────────────────────────────
  lignes.push({
    section: null, libelle: 'Salaire de base',
    base: heures, taux: tauxHoraire, aDeduire: 0, aPayer: salaireBase, chargePatronale: 0,
  })
  if (primeAstreinte > 0) {
    lignes.push({ section: null, libelle: "Prime d'astreinte repos hebdomadaire", base: null, taux: null, aDeduire: 0, aPayer: primeAstreinte, chargePatronale: 0 })
  }
  if (prime13 > 0) {
    lignes.push({ section: null, libelle: 'Prime de 13e mois mensualisée', base: null, taux: null, aDeduire: 0, aPayer: prime13, chargePatronale: 0 })
  }
  if (primesAutres > 0) {
    lignes.push({ section: null, libelle: 'Primes / gratifications', base: null, taux: null, aDeduire: 0, aPayer: primesAutres, chargePatronale: 0 })
  }
  lignes.push({ section: null, libelle: 'Salaire brut', base: null, taux: null, aDeduire: 0, aPayer: brut, chargePatronale: 0, bold: true })

  // ── Santé ──────────────────────────────────────────────────────────────
  lignes.push(
    cotis('Santé', 'Sécurité Sociale - Maladie Maternité Invalidité Décès', brut, maladie.sal, maladie.pat),
    cotis('Santé', 'Accidents du travail & maladies professionnelles', brut, TAUX.atmpDefaut.sal, TAUX.atmpDefaut.pat),
  )

  // ── Retraite ─────────────────────────────────────────────────────────────
  lignes.push(
    cotis('Retraite', 'Sécurité Sociale plafonnée', basePlafonnee, TAUX.vieillessePlafonnee.sal, TAUX.vieillessePlafonnee.pat),
    cotis('Retraite', 'Sécurité Sociale déplafonnée', brut, TAUX.vieillesseDeplafonnee.sal, TAUX.vieillesseDeplafonnee.pat),
    cotis('Retraite', 'Complémentaire Tranche 1', basePlafonnee, TAUX.retraiteComplementaireT1.sal, TAUX.retraiteComplementaireT1.pat),
    cotis('Retraite', "Contribution d'équilibre général T1", basePlafonnee, TAUX.cegT1.sal, TAUX.cegT1.pat),
  )

  // ── Autres cotisations ───────────────────────────────────────────────────
  lignes.push(
    cotis(null, 'Famille', brut, famille.sal, famille.pat),
    cotis(null, 'Assurance chômage', brut, TAUX.chomage.sal, TAUX.chomage.pat),
    cotis(null, "Autres contributions dues par l'employeur", brut, 0, autresPat),
    cotis(null, "CSG déductible de l'impôt sur le revenu", assietteCsgMontant, TAUX.csgDeductible.sal, 0),
    cotis(null, "CSG/CRDS non déductible de l'impôt sur le revenu", assietteCsgMontant, TAUX.csgCrdsNonDeductible.sal, 0),
  )

  // Cotisations déductibles du net imposable (toutes sauf CSG/CRDS non déductible).
  const totalRetenuesSalariales = r2(lignes.reduce((s, l) => s + l.aDeduire, 0))
  const csgCrdsNonDed = r2(assietteCsgMontant * TAUX.csgCrdsNonDeductible.sal / 100)
  const cotisationsDeductibles = r2(totalRetenuesSalariales - csgCrdsNonDed)

  const totalChargesPatronalesBrutes = r2(lignes.reduce((s, l) => s + l.chargePatronale, 0))

  // ── Réduction générale des cotisations patronales (ex-Fillon) ─────────────
  const coefficient = brut > 0 && brut < SMIC_MENSUEL * 1.6
    ? r2((REDUCTION_GENERALE_T / 0.6) * (1.6 * SMIC_MENSUEL / brut - 1))
    : 0
  const allègementEmployeur = coefficient > 0
    ? r2(Math.min(totalChargesPatronalesBrutes, brut * coefficient))
    : 0
  if (allègementEmployeur > 0) {
    lignes.push({
      section: null, libelle: 'Exonérations de cotisations employeur (réduction générale)',
      base: null, taux: null, aDeduire: 0, aPayer: 0, chargePatronale: -allègementEmployeur,
    })
  }

  const totalChargesPatronales = r2(totalChargesPatronalesBrutes - allègementEmployeur)

  // Ligne de totaux.
  lignes.push({
    section: null, libelle: 'Total des cotisations et contributions',
    base: null, taux: null, aDeduire: totalRetenuesSalariales, aPayer: 0, chargePatronale: totalChargesPatronales, bold: true,
  })

  // ── Éléments non soumis à cotisations ────────────────────────────────────
  const repasNb = input.indemniteRepasNb ?? 0
  const repasUnit = input.indemniteRepasMontant ?? 0
  const repasTotal = r2(repasNb * repasUnit)
  if (repasTotal > 0) {
    lignes.push({
      section: 'Éléments non soumis', libelle: 'Indemnité de repas',
      base: repasNb, taux: repasUnit, aDeduire: 0, aPayer: repasTotal, chargePatronale: 0,
    })
  }

  const netImposable = r2(brut - cotisationsDeductibles)
  const acompte = r2(input.acompte ?? 0)
  const netAPayer = r2(brut - totalRetenuesSalariales + repasTotal - acompte)
  const coutGlobalEmployeur = r2(brut + totalChargesPatronales)

  lignes.push({
    section: null, libelle: 'Net payé',
    base: null, taux: null, aDeduire: 0, aPayer: netAPayer, chargePatronale: 0, bold: true,
  })

  const datePaiement = input.datePaiement
    || new Date(annee, mois, 0).toISOString().slice(0, 10)

  const cumuls = {
    brut: r2(cumulsAnterieurs.brut + brut),
    netImposable: r2(cumulsAnterieurs.netImposable + netImposable),
    netAPayer: r2(cumulsAnterieurs.netAPayer + netAPayer),
    heures: r2(cumulsAnterieurs.heures + heures),
    chargesPatronales: r2(cumulsAnterieurs.chargesPatronales + totalChargesPatronales),
  }

  const recapMensuel: RecapColonne = {
    heures: r2(heures),
    heuresSupp: r2(heuresSupp),
    brut,
    baseSS: brut,
    plafondSS: PMSS,
    netImposable,
    chargesPatronales: totalChargesPatronales,
    totalVerse: coutGlobalEmployeur,
    allegements: allègementEmployeur,
  }

  const recapAnnuel: RecapColonne = {
    heures: cumuls.heures,
    heuresSupp: r2((cumulsAnterieurs.heures > 0 ? 0 : 0) + heuresSupp),
    brut: cumuls.brut,
    baseSS: cumuls.brut,
    plafondSS: r2(PMSS * mois),
    netImposable: cumuls.netImposable,
    chargesPatronales: cumuls.chargesPatronales,
    totalVerse: r2(cumuls.brut + cumuls.chargesPatronales),
    allegements: r2(allègementEmployeur + 0),
  }

  // ── Compteur de congés payés (indicatif, 2,5 j/mois) ──────────────────────
  const congesPris = r2(input.congesPrisMois ?? 0)
  const acquisN = r2(CONGES_ACQUIS_PAR_MOIS * mois)
  const congesN: CongesLigne = { acquis: acquisN, pris: congesPris, solde: r2(acquisN - congesPris) }
  const congesN1: CongesLigne = { acquis: r2(CONGES_ACQUIS_PAR_MOIS * 12), pris: 0, solde: r2(CONGES_ACQUIS_PAR_MOIS * 12) }

  return {
    periodeLabel: `${MOIS[mois - 1]} ${annee}`,
    mois,
    annee,
    salaireBase,
    primes,
    brut,
    heures,
    heuresSupp,
    bareme: tauxPaieSignature(),
    lignes,
    totalRetenuesSalariales,
    totalChargesPatronales,
    netImposable,
    netAPayer,
    acompte,
    coutGlobalEmployeur,
    allègementEmployeur,
    datePaiement,
    recapMensuel,
    recapAnnuel,
    congesN1,
    congesN,
    cumuls,
  }
}

export function fmtMoneyPdf(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`
}

export function fmtTaux(t: number | null): string {
  if (t == null || t === 0) return ''
  return `${t.toFixed(4).replace('.', ',')}`
}

export function fmtNombre(n: number | null): string {
  if (n == null) return ''
  return n.toFixed(2).replace('.', ',')
}

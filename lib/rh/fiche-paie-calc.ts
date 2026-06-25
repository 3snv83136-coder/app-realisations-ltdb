/**
 * Calcul bulletin de paie — barèmes salarié non-cadre (métropole).
 * Taux 2026 alignés sur le barème URSSAF en vigueur (PMSS annuel / 12).
 * À faire valider par votre expert-comptable pour chaque cas particulier.
 */

export const PAIE_PARAMS_2026 = {
  annee: 2026,
  pmss: 3925, // plafond mensuel Sécurité sociale (série 2025, réviser si nouveau décret)
  plafondRetraiteCompl: 31400, // 8 × PMSS — tranche 2 retraite compl.
  assietteCsg: 0.9825,
  heuresMensuellesRef: 151.67,
} as const

export type FichePaieInput = {
  mois: number
  annee: number
  salaireBase?: number
  primes?: number
  acompte?: number
  heures?: number
  datePaiement?: string
}

export type LigneBulletin = {
  libelle: string
  base: number
  tauxSalarial: number | null
  retenueSalariale: number
  tauxPatronal: number | null
  chargePatronale: number
}

export type BulletinPaieCalc = {
  periodeLabel: string
  mois: number
  annee: number
  salaireBase: number
  primes: number
  brut: number
  heures: number
  lignes: LigneBulletin[]
  totalRetenuesSalariales: number
  totalChargesPatronales: number
  netImposable: number
  netAPayer: number
  acompte: number
  coutGlobalEmployeur: number
  allègementEmployeur: number
  datePaiement: string
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

function ligne(
  libelle: string,
  base: number,
  tauxSal: number | null,
  tauxPat: number | null,
): LigneBulletin {
  const retenueSalariale = tauxSal != null ? r2(base * tauxSal / 100) : 0
  const chargePatronale = tauxPat != null ? r2(base * tauxPat / 100) : 0
  return { libelle, base: r2(base), tauxSalarial: tauxSal, retenueSalariale, tauxPatronal: tauxPat, chargePatronale }
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
  const { pmss, assietteCsg, heuresMensuellesRef } = PAIE_PARAMS_2026
  const mois = Math.min(12, Math.max(1, input.mois))
  const annee = input.annee || PAIE_PARAMS_2026.annee
  const salaireBase = input.salaireBase ?? salaireBrutMensuel
  const primes = input.primes ?? 0
  const brut = r2(salaireBase + primes)
  const heures = input.heures ?? heuresMensuellesRef
  const basePlafonnee = Math.min(brut, pmss)
  const assietteCsgMontant = r2(brut * assietteCsg)

  const lignes: LigneBulletin[] = [
    { libelle: 'Salaire de base', base: salaireBase, tauxSalarial: null, retenueSalariale: 0, tauxPatronal: null, chargePatronale: 0 },
  ]
  if (primes > 0) {
    lignes.push({ libelle: 'Primes / gratifications', base: primes, tauxSalarial: null, retenueSalariale: 0, tauxPatronal: null, chargePatronale: 0 })
  }

  // Cotisations salariales & patronales — taux en vigueur (non-cadre, < 50 salariés)
  lignes.push(
    ligne('Maladie, maternité, invalidité, décès', brut, 0, 7),
    ligne('Vieillesse — plafonnée', basePlafonnee, 6.9, 8.55),
    ligne('Vieillesse — déplafonnée', brut, 0.4, 1.9),
    ligne('Retraite complémentaire — tranche 1', basePlafonnee, 3.15, 4.72),
    ligne('Allocations familiales', brut, 0, 3.45),
    ligne('Accident du travail — maladies professionnelles', brut, 0, 2.23),
    ligne('Assurance chômage', brut, 0, 4.05),
    ligne('CSG déductible de l\'impôt sur le revenu', assietteCsgMontant, 6.8, 0),
    ligne('CSG/CRDS non déductible', assietteCsgMontant, 2.9, 0),
    ligne('Autres contributions dues par l\'employeur (FNAL, etc.)', brut, 0, 0.5),
  )

  const cotisationsSocialesDeductibles = r2(
    lignes.slice(2).reduce((s, l) => {
      if (l.libelle.includes('CSG déductible') || l.libelle.includes('Vieillesse') || l.libelle.includes('Retraite complémentaire')) {
        return s + l.retenueSalariale
      }
      return s
    }, 0),
  )

  const totalRetenuesSalariales = r2(lignes.reduce((s, l) => s + l.retenueSalariale, 0))
  const totalChargesPatronales = r2(lignes.reduce((s, l) => s + l.chargePatronale, 0))

  // Réduction générale des cotisations patronales (ex-Fillon) — formule simplifiée T < 1,6 SMIC
  const smicMensuel = 1801.8 // SMIC horaire 11,88 € × 151,67 h (janv. 2026 — mettre à jour si décret)
  const coefficient = brut < smicMensuel * 1.6
    ? r2((1 / 0.6) * (1.6 * smicMensuel / brut - 1) * 0.3194) // taux max simplifié 2026
  : 0
  const allègementEmployeur = coefficient > 0
    ? r2(Math.min(totalChargesPatronales * 0.3194, brut * coefficient))
    : 0

  const chargesPatronalesNettes = r2(totalChargesPatronales - allègementEmployeur)
  const netImposable = r2(brut - cotisationsSocialesDeductibles)
  const acompte = input.acompte ?? 0
  const netAPayer = r2(brut - totalRetenuesSalariales - acompte)
  const coutGlobalEmployeur = r2(brut + chargesPatronalesNettes)

  const datePaiement = input.datePaiement
    || new Date(annee, mois, 0).toISOString().slice(0, 10)

  const cumuls = {
    brut: r2(cumulsAnterieurs.brut + brut),
    netImposable: r2(cumulsAnterieurs.netImposable + netImposable),
    netAPayer: r2(cumulsAnterieurs.netAPayer + netAPayer),
    heures: r2(cumulsAnterieurs.heures + heures),
    chargesPatronales: r2(cumulsAnterieurs.chargesPatronales + chargesPatronalesNettes),
  }

  return {
    periodeLabel: `${MOIS[mois - 1]} ${annee}`,
    mois,
    annee,
    salaireBase,
    primes,
    brut,
    heures,
    lignes,
    totalRetenuesSalariales,
    totalChargesPatronales: chargesPatronalesNettes,
    netImposable,
    netAPayer,
    acompte,
    coutGlobalEmployeur,
    allègementEmployeur,
    datePaiement,
    cumuls,
  }
}

export function fmtMoneyPdf(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`
}

export function fmtTaux(t: number | null): string {
  if (t == null || t === 0) return ''
  return `${t.toFixed(2).replace('.', ',')} %`
}

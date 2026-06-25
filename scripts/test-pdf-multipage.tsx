import { renderToFile } from '@react-pdf/renderer'
import { createElement } from 'react'
import { DevisDocument, type DevisPDFProps, type DevisLineData } from '../components/DevisPDF'
import { FactureDocument, type FacturePDFProps, type FactureLineData } from '../components/FacturePDF'

const longDesc =
  "Prestation détaillée incluant la préparation de la zone de travail, la protection des abords, " +
  "la mise en place du matériel adapté, l'intervention proprement dite avec contrôles intermédiaires, " +
  "le nettoyage complet et la remise en état des lieux après intervention conforme aux règles de l'art."

// 28 lignes réparties en 4 sections → force le débordement multi-pages.
const devisLignes: DevisLineData[] = Array.from({ length: 28 }, (_, i) => ({
  section: `Section ${Math.floor(i / 7) + 1}. Travaux de remise en conformité du réseau`,
  designation: `Prestation n°${i + 1} — intervention technique spécialisée`,
  description: longDesc,
  qte: (i % 5) + 1,
  unite: ['forfait', 'ml', 'u', 'h', 'm²'][i % 5],
  pu_ht: 90 + i * 17,
}))

const constats = Array.from({ length: 8 }, (_, i) => ({
  intitule: `Constat n°${i + 1} sur le réseau d'évacuation`,
  localisation: `Tronçon ${i + 1} — regard ${i + 1}`,
  description: longDesc,
}))

const devisProps: DevisPDFProps = {
  emetteur: {
    raisonSociale: 'LTDB — Les Techniciens du Débouchage',
    adresseLignes: ['700 Avenue du 15ème Corps', '83200 Toulon'],
    telephone: '07 83 63 68 35',
    email: 'contact@lestechniciensdudebouchage.fr',
    rcs: 'RCS Toulon 000 000 000',
    siret: '00000000000000',
  },
  client: {
    nom: 'M. EXEMPLE LONG DEVIS',
    adresseLignes: ['1 place du Château', '01260 Cuzieu'],
    adresseChantier: 'idem',
  },
  devis: {
    numero: 'DV-TEST-MULTI',
    date_devis: '2026-06-25',
    validite_jours: 30,
    objet: longDesc + ' ' + longDesc,
    reference_dossier: "Rapport d'intervention du 11/04/2026",
    lignes: devisLignes,
    tva_taux: 0,
    constats_conformes: constats.slice(0, 4),
    constats_critiques: constats.slice(4, 8),
    non_garantie: longDesc,
    conditions: {
      delai_execution: longDesc,
      duree_chantier: '3 à 5 jours ouvrés selon accès et météo',
      garanties: 'Garantie décennale sur ouvrages enterrés · Garantie de parfait achèvement 1 an',
      assurance: 'RC Pro et décennale LTDB en cours de validité',
      particulieres: longDesc,
    },
    modalites: { acompte_pct: 30 },
  },
}

const factureLignes: FactureLineData[] = Array.from({ length: 30 }, (_, i) => ({
  designation: `Ligne de facturation n°${i + 1} — prestation technique`,
  description: longDesc,
  qte: (i % 4) + 1,
  unite: ['forfait', 'ml', 'u', 'h'][i % 4],
  pu_ht: 75 + i * 13,
  inclus: i % 9 === 0,
}))

const factureProps: FacturePDFProps = {
  emetteur: {
    raisonSociale: 'LTDB — Les Techniciens du Débouchage',
    adresseLignes: ['700 Avenue du 15ème Corps', '83000 Toulon'],
    telephone: '07 83 63 68 35',
    email: 'contact@lestechniciensdudebouchage.fr',
    rcs: 'RCS Toulon 000 000 000',
    siret: '00000000000000',
    tva: 'FR00000000000',
    iban: 'FR76 0000 0000 0000 0000 0000 000',
    bic: 'XXXXFRPPXXX',
  },
  client: {
    nom: 'SCI EXEMPLE LONGUE FACTURE',
    adresseLignes: ['12 rue des Lilas', '83100 Toulon'],
    adresseChantier: 'idem',
  },
  phone: '07 83 63 68 35',
  facture: {
    numero: 'FA-TEST-MULTI',
    date_facture: '2026-06-25',
    echeance: 'À réception',
    objet: longDesc,
    reference_dossier: 'Rapport LTDB-TEST',
    tva_taux: 0,
    observations: longDesc + ' ' + longDesc,
    recommandation: longDesc,
    lignes: factureLignes,
  },
}

async function main() {
  console.log('[multipage] devis...')
  await renderToFile(createElement(DevisDocument, devisProps), '/tmp/multi-devis.pdf')
  console.log('  → /tmp/multi-devis.pdf')

  console.log('[multipage] facture...')
  await renderToFile(createElement(FactureDocument, factureProps), '/tmp/multi-facture.pdf')
  console.log('  → /tmp/multi-facture.pdf')
}

main().catch((err) => {
  console.error('FAIL:', err)
  process.exit(1)
})

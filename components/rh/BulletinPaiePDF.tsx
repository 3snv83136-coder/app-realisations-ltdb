import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { LTDB_EMETTEUR } from "@/lib/emetteur"
import { LTDB_FORME_JURIDIQUE, LTDB_SIRET } from "@/lib/entreprise"
import type { Salarie } from "@/lib/rh/types"
import { salarieAdresseComplete, salarieNomComplet } from "@/lib/rh/types"
import type { BulletinPaieCalc, RecapColonne } from "@/lib/rh/fiche-paie-calc"
import { fmtMoneyPdf, fmtNombre, fmtTaux } from "@/lib/rh/fiche-paie-calc"
import { PAIE_ANNEE } from "@/lib/rh/taux-paie"

const C = {
  navy: '#0e2a52',
  text: '#1a1f2e',
  muted: '#5a6270',
  border: '#444',
  head: '#e8eef5',
  section: '#dbe6f3',
}

const s = StyleSheet.create({
  page: { padding: 26, fontFamily: 'Helvetica', fontSize: 7, color: C.text },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.navy, textAlign: 'center', marginBottom: 2 },
  sub: { fontSize: 7, color: C.muted, textAlign: 'center', marginBottom: 8 },

  box: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  boxHalf: { flex: 1, borderWidth: 1, borderColor: C.border, padding: 6 },
  boxTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.navy, marginBottom: 3 },
  line: { marginBottom: 1 },

  // Grille principale
  headRow: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, backgroundColor: C.head },
  colH: { padding: 3, fontFamily: 'Helvetica-Bold', fontSize: 6.5, borderRightWidth: 1, borderColor: C.border },
  sectionRow: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border, backgroundColor: C.section },
  sectionLabel: { padding: 2.5, fontFamily: 'Helvetica-Bold', fontSize: 6.5, color: C.navy },
  row: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  rowBold: { backgroundColor: '#f1f5fb' },
  cell: { padding: 2.5, borderRightWidth: 1, borderColor: C.border, fontSize: 6.5 },
  cellR: { textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },

  // Récap
  recap: { marginTop: 8 },
  recapHead: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, backgroundColor: C.head },
  recapRow: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  recapCell: { padding: 2.5, borderRightWidth: 1, borderColor: C.border, fontSize: 6, textAlign: 'right' },
  recapCellL: { textAlign: 'left', fontFamily: 'Helvetica-Bold' },

  // Congés
  conges: { marginTop: 8, flexDirection: 'row', gap: 8 },
  congeBlock: { flex: 1, borderWidth: 1, borderColor: C.border },
  congeHead: { flexDirection: 'row', backgroundColor: C.head },
  congeRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: C.border },
  congeCell: { flex: 1, padding: 2.5, fontSize: 6, textAlign: 'right', borderRightWidth: 1, borderColor: C.border },
  congeCellL: { textAlign: 'left' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 8 },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  totalVal: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: C.navy },

  mention: { marginTop: 8, fontSize: 5.8, color: C.muted, lineHeight: 1.35 },
  disclaimer: { marginTop: 6, fontSize: 5.8, color: '#92400e', backgroundColor: '#fffbeb', padding: 4, borderWidth: 1, borderColor: '#fcd34d' },
})

// Largeurs grille principale (6 colonnes)
const W = {
  lib: '34%',
  base: '13%',
  taux: '12%',
  ded: '14%',
  pay: '13.5%',
  pat: '13.5%',
}

// Largeurs récap (1 libellé + 9 colonnes)
const RW = { lab: '10%', col: '10%' }

export type BulletinPaiePdfProps = {
  salarie: Salarie
  bulletin: BulletinPaieCalc
}

function HeaderCol({ w, label, last }: { w: string; label: string; last?: boolean }) {
  return <Text style={[s.colH, { width: w }, last ? { borderRightWidth: 0 } : {}]}>{label}</Text>
}

function GridCell({ w, children, right, bold, last }: { w: string; children?: React.ReactNode; right?: boolean; bold?: boolean; last?: boolean }) {
  return (
    <Text style={[s.cell, { width: w }, right ? s.cellR : {}, bold ? s.bold : {}, last ? { borderRightWidth: 0 } : {}]}>
      {children}
    </Text>
  )
}

function RecapRow({ label, r }: { label: string; r: RecapColonne }) {
  return (
    <View style={s.recapRow}>
      <Text style={[s.recapCell, s.recapCellL, { width: RW.lab }]}>{label}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{fmtNombre(r.heures)}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{r.heuresSupp ? fmtNombre(r.heuresSupp) : ''}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{fmtMoneyPdf(r.brut)}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{fmtMoneyPdf(r.baseSS)}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{fmtMoneyPdf(r.plafondSS)}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{fmtMoneyPdf(r.netImposable)}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{fmtMoneyPdf(r.chargesPatronales)}</Text>
      <Text style={[s.recapCell, { width: RW.col }]}>{fmtMoneyPdf(r.totalVerse)}</Text>
      <Text style={[s.recapCell, { width: RW.col, borderRightWidth: 0 }]}>{r.allegements ? fmtMoneyPdf(r.allegements) : ''}</Text>
    </View>
  )
}

function CongeBlock({ titre, ligne }: { titre: string; ligne: { acquis: number; pris: number; solde: number } }) {
  return (
    <View style={s.congeBlock}>
      <View style={s.congeHead}>
        <Text style={[s.congeCell, s.congeCellL, s.bold]}>{titre}</Text>
        <Text style={[s.congeCell, s.bold]}>Acquis</Text>
        <Text style={[s.congeCell, s.bold]}>Pris</Text>
        <Text style={[s.congeCell, s.bold, { borderRightWidth: 0 }]}>Solde</Text>
      </View>
      <View style={s.congeRow}>
        <Text style={[s.congeCell, s.congeCellL]}>Jours</Text>
        <Text style={s.congeCell}>{fmtNombre(ligne.acquis)}</Text>
        <Text style={s.congeCell}>{fmtNombre(ligne.pris)}</Text>
        <Text style={[s.congeCell, { borderRightWidth: 0 }]}>{fmtNombre(ligne.solde)}</Text>
      </View>
    </View>
  )
}

export function BulletinPaieDocument({ salarie, bulletin }: BulletinPaiePdfProps) {
  const sal = salarie
  let lastSection: string | null | undefined = undefined

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>BULLETIN DE PAIE</Text>
        <Text style={s.sub}>
          Période : {bulletin.periodeLabel} · Paiement le {new Date(bulletin.datePaiement).toLocaleDateString('fr-FR')} par virement
          {' · '}Barème {PAIE_ANNEE} ({bulletin.bareme})
        </Text>

        <View style={s.box}>
          <View style={s.boxHalf}>
            <Text style={s.boxTitle}>EMPLOYEUR</Text>
            <Text style={s.line}>{LTDB_EMETTEUR.raisonSociale}</Text>
            <Text style={s.line}>{LTDB_EMETTEUR.adresseLignes.join(', ')}</Text>
            <Text style={s.line}>SIRET : {LTDB_SIRET} · NAF : 8122Z</Text>
            <Text style={s.line}>{LTDB_FORME_JURIDIQUE}</Text>
            <Text style={s.line}>Convention collective : Assainissement et maintenance industrielle</Text>
          </View>
          <View style={s.boxHalf}>
            <Text style={s.boxTitle}>SALARIÉ</Text>
            <Text style={s.line}>{salarieNomComplet(sal)}</Text>
            <Text style={s.line}>{salarieAdresseComplete(sal)}</Text>
            <Text style={s.line}>N° SS : {sal.numero_secu || '—'}</Text>
            <Text style={s.line}>Emploi : {sal.poste || '—'}{sal.qualification ? ` · ${sal.qualification}` : ''}</Text>
            <Text style={s.line}>
              Coefficient : {sal.coefficient ?? '—'} · Entrée : {sal.date_embauche ? new Date(sal.date_embauche).toLocaleDateString('fr-FR') : '—'}
            </Text>
            <Text style={s.line}>Contrat : {sal.type_contrat || 'CDI'} · {sal.temps_travail || '151,67 h'}</Text>
          </View>
        </View>

        {/* Grille principale */}
        <View style={s.headRow}>
          <HeaderCol w={W.lib} label="Éléments de paie" />
          <HeaderCol w={W.base} label="Base" />
          <HeaderCol w={W.taux} label="Taux" />
          <HeaderCol w={W.ded} label="À déduire" />
          <HeaderCol w={W.pay} label="À payer" />
          <HeaderCol w={W.pat} label="Charges patron." last />
        </View>

        {bulletin.lignes.map((l, i) => {
          const showSection = l.section && l.section !== lastSection
          lastSection = l.section
          return (
            <React.Fragment key={i}>
              {showSection && (
                <View style={s.sectionRow}>
                  <Text style={s.sectionLabel}>{l.section}</Text>
                </View>
              )}
              <View style={[s.row, l.bold ? s.rowBold : {}]}>
                <GridCell w={W.lib} bold={l.bold}>{l.libelle}</GridCell>
                <GridCell w={W.base} right>{l.base != null && l.base !== 0 ? fmtNombre(l.base) : ''}</GridCell>
                <GridCell w={W.taux} right>{fmtTaux(l.taux)}</GridCell>
                <GridCell w={W.ded} right>{l.aDeduire > 0 ? fmtMoneyPdf(l.aDeduire) : ''}</GridCell>
                <GridCell w={W.pay} right bold={l.bold}>{l.aPayer !== 0 ? fmtMoneyPdf(l.aPayer) : ''}</GridCell>
                <GridCell w={W.pat} right last>{l.chargePatronale !== 0 ? fmtMoneyPdf(l.chargePatronale) : ''}</GridCell>
              </View>
            </React.Fragment>
          )
        })}

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Net imposable : {fmtMoneyPdf(bulletin.netImposable)}</Text>
          {bulletin.acompte > 0 && <Text style={s.totalLabel}>Acompte : - {fmtMoneyPdf(bulletin.acompte)}</Text>}
          <Text style={s.totalVal}>NET PAYÉ : {fmtMoneyPdf(bulletin.netAPayer)}</Text>
        </View>

        {/* Récapitulatif mensuel / annuel */}
        <View style={s.recap}>
          <View style={s.recapHead}>
            <Text style={[s.recapCell, s.recapCellL, { width: RW.lab }]}> </Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>Heures</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>H. suppl.</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>Brut</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>Base S.S.</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>Plafond S.S.</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>Net impos.</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>Ch. patron.</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col }]}>Total versé</Text>
            <Text style={[s.recapCell, s.bold, { width: RW.col, borderRightWidth: 0 }]}>Allègements</Text>
          </View>
          <RecapRow label="Mensuel" r={bulletin.recapMensuel} />
          <RecapRow label="Annuel" r={bulletin.recapAnnuel} />
        </View>

        {/* Congés payés */}
        <View style={s.conges}>
          <CongeBlock titre="Congés N-1" ligne={bulletin.congesN1} />
          <CongeBlock titre="Congés N" ligne={bulletin.congesN} />
        </View>

        <Text style={s.mention}>
          Dans votre intérêt, et pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.
          Informations complémentaires : www.service-public.fr — URSSAF. Bulletin établi conformément aux articles R.3243-1 et suivants du Code du travail.
        </Text>
        <Text style={s.disclaimer}>
          Calcul automatique selon le barème {PAIE_ANNEE} (non-cadre, &lt; 50 salariés) — taux de cotisations contrôlés mensuellement.
          À valider par votre expert-comptable avant remise au salarié. Ne se substitue pas à une liasse de paie certifiée.
        </Text>
      </Page>
    </Document>
  )
}

export function bulletinPaieFilename(salarie: Salarie, mois: number, annee: number): string {
  const slug = `${salarie.prenom}-${salarie.nom}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `bulletin-paie-${annee}-${String(mois).padStart(2, '0')}-${slug}.pdf`
}

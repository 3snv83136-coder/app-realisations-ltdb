import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { LTDB_EMETTEUR } from "@/lib/emetteur"
import { LTDB_FORME_JURIDIQUE, LTDB_SIRET } from "@/lib/entreprise"
import type { Salarie } from "@/lib/rh/types"
import { salarieAdresseComplete, salarieNomComplet } from "@/lib/rh/types"
import type { BulletinPaieCalc } from "@/lib/rh/fiche-paie-calc"
import { fmtMoneyPdf, fmtTaux, PAIE_PARAMS_2026 } from "@/lib/rh/fiche-paie-calc"

const C = {
  navy: '#0e2a52',
  text: '#1a1f2e',
  muted: '#5a6270',
  border: '#333',
  head: '#e8eef5',
}

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica', fontSize: 7.5, color: C.text },
  title: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 7, color: C.muted, textAlign: 'center', marginBottom: 10 },
  cols: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, backgroundColor: C.head },
  colH: { padding: 4, fontFamily: 'Helvetica-Bold', fontSize: 6.5, borderRightWidth: 1, borderColor: C.border },
  row: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  cell: { padding: 3, borderRightWidth: 1, borderColor: C.border, fontSize: 6.5 },
  cellR: { textAlign: 'right' },
  bold: { fontFamily: 'Helvetica-Bold' },
  box: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  boxHalf: { flex: 1, borderWidth: 1, borderColor: C.border, padding: 6 },
  boxTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.navy, marginBottom: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 6, marginBottom: 4 },
  totalLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  totalVal: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.navy },
  cumul: { marginTop: 8, borderWidth: 1, borderColor: C.border, padding: 6 },
  mention: { marginTop: 8, fontSize: 6, color: C.muted, lineHeight: 1.35 },
  disclaimer: { marginTop: 6, fontSize: 6, color: '#92400e', backgroundColor: '#fffbeb', padding: 4, borderWidth: 1, borderColor: '#fcd34d' },
})

const W = {
  lib: '32%',
  base: '12%',
  tauxSal: '10%',
  retSal: '12%',
  tauxPat: '10%',
  chPat: '12%',
  reste: '12%',
}

export type BulletinPaiePdfProps = {
  salarie: Salarie
  bulletin: BulletinPaieCalc
}

function HeaderCol({ w, label, last }: { w: string; label: string; last?: boolean }) {
  return (
    <Text style={[s.colH, { width: w }, last ? { borderRightWidth: 0 } : {}]}>{label}</Text>
  )
}

function Cell({ w, children, right, bold }: { w: string; children?: React.ReactNode; right?: boolean; bold?: boolean }) {
  return (
    <Text style={[s.cell, { width: w }, right ? s.cellR : {}, bold ? s.bold : {}]}>{children}</Text>
  )
}

export function BulletinPaieDocument({ salarie, bulletin }: BulletinPaiePdfProps) {
  const sal = salarie
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>BULLETIN DE PAIE</Text>
        <Text style={s.sub}>
          Période : {bulletin.periodeLabel} · Paiement le {new Date(bulletin.datePaiement).toLocaleDateString('fr-FR')}
          {' · '}Barème {PAIE_PARAMS_2026.annee}
        </Text>

        <View style={s.box}>
          <View style={s.boxHalf}>
            <Text style={s.boxTitle}>EMPLOYEUR</Text>
            <Text>{LTDB_EMETTEUR.raisonSociale}</Text>
            <Text>{LTDB_EMETTEUR.adresseLignes.join(', ')}</Text>
            <Text>SIRET : {LTDB_SIRET}</Text>
            <Text>{LTDB_FORME_JURIDIQUE}</Text>
            <Text>NAF : 8122Z — Taux URSSAF en vigueur {PAIE_PARAMS_2026.annee}</Text>
          </View>
          <View style={s.boxHalf}>
            <Text style={s.boxTitle}>SALARIÉ</Text>
            <Text>{salarieNomComplet(sal)}</Text>
            <Text>{salarieAdresseComplete(sal)}</Text>
            <Text>N° SS : {sal.numero_secu || '—'}</Text>
            <Text>Emploi : {sal.poste || '—'} · {sal.qualification || ''}</Text>
            <Text>Entrée : {sal.date_embauche ? new Date(sal.date_embauche).toLocaleDateString('fr-FR') : '—'}</Text>
            <Text>Contrat : {sal.type_contrat || 'CDI'} · {sal.temps_travail || '35h'}</Text>
          </View>
        </View>

        <View style={s.cols}>
          <HeaderCol w={W.lib} label="Libellé" />
          <HeaderCol w={W.base} label="Base" />
          <HeaderCol w={W.tauxSal} label="Taux sal." />
          <HeaderCol w={W.retSal} label="Retenue sal." />
          <HeaderCol w={W.tauxPat} label="Taux pat." />
          <HeaderCol w={W.chPat} label="Charges pat." last />
        </View>

        {bulletin.lignes.map((l, i) => (
          <View key={i} style={s.row}>
            <Cell w={W.lib}>{l.libelle}</Cell>
            <Cell w={W.base} right>{l.base > 0 ? fmtMoneyPdf(l.base) : ''}</Cell>
            <Cell w={W.tauxSal} right>{fmtTaux(l.tauxSalarial)}</Cell>
            <Cell w={W.retSal} right>{l.retenueSalariale > 0 ? fmtMoneyPdf(l.retenueSalariale) : ''}</Cell>
            <Cell w={W.tauxPat} right>{fmtTaux(l.tauxPatronal)}</Cell>
            <Cell w={W.chPat} right>{l.chargePatronale > 0 ? fmtMoneyPdf(l.chargePatronale) : ''}</Cell>
          </View>
        ))}

        {bulletin.allègementEmployeur > 0 && (
          <View style={s.row}>
            <Cell w={W.lib} bold>Réduction générale des cotisations patronales</Cell>
            <Cell w={W.base} />
            <Cell w={W.tauxSal} />
            <Cell w={W.retSal} />
            <Cell w={W.tauxPat} />
            <Cell w={W.chPat} right>- {fmtMoneyPdf(bulletin.allègementEmployeur)}</Cell>
          </View>
        )}

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total retenues salariales : {fmtMoneyPdf(bulletin.totalRetenuesSalariales)}</Text>
          <Text style={s.totalLabel}>Charges patronales nettes : {fmtMoneyPdf(bulletin.totalChargesPatronales)}</Text>
        </View>

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Brut : {fmtMoneyPdf(bulletin.brut)}</Text>
          <Text style={s.totalLabel}>Net imposable : {fmtMoneyPdf(bulletin.netImposable)}</Text>
          {bulletin.acompte > 0 && (
            <Text style={s.totalLabel}>Acompte : - {fmtMoneyPdf(bulletin.acompte)}</Text>
          )}
          <Text style={s.totalVal}>NET À PAYER : {fmtMoneyPdf(bulletin.netAPayer)}</Text>
        </View>

        <View style={s.cumul}>
          <Text style={s.bold}>Cumuls année {bulletin.annee}</Text>
          <Text>
            Heures : {bulletin.cumuls.heures.toFixed(2)} · Brut : {fmtMoneyPdf(bulletin.cumuls.brut)} ·
            Net imposable : {fmtMoneyPdf(bulletin.cumuls.netImposable)} · Net payé : {fmtMoneyPdf(bulletin.cumuls.netAPayer)}
          </Text>
        </View>

        <Text style={s.mention}>
          Bulletin établi conformément aux articles R.3243-1 et suivants du Code du travail.
          Dans votre intérêt, et pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.
          Pour toute information : service-public.fr — URSSAF.
        </Text>
        <Text style={s.disclaimer}>
          Calcul automatique selon barèmes {PAIE_PARAMS_2026.annee} (non-cadre). À valider par votre expert-comptable
          avant remise au salarié. Ne se substitue pas à une liasse de paie certifiée.
        </Text>
      </Page>
    </Document>
  )
}

export function bulletinPaieFilename(salarie: Salarie, mois: number, annee: number): string {
  const slug = `${salarie.prenom}-${salarie.nom}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `bulletin-paie-${annee}-${String(mois).padStart(2, '0')}-${slug}.pdf`
}

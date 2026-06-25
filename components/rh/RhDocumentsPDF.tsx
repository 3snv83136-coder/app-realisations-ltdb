import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { LTDB_EMETTEUR } from "@/lib/emetteur"
import { LTDB_FORME_JURIDIQUE, LTDB_SIRET } from "@/lib/entreprise"
import type { RhDocumentGenereType, Salarie } from "@/lib/rh/types"
import { salarieAdresseComplete, salarieNomComplet } from "@/lib/rh/types"

const C = {
  navy: '#0e2a52',
  text: '#1a1f2e',
  muted: '#5a6270',
  border: '#c7cfdb',
  rowAlt: '#f4f6fa',
  warn: '#92400e',
}

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: C.text, lineHeight: 1.45 },
  header: { borderBottomWidth: 2, borderBottomColor: C.navy, paddingBottom: 10, marginBottom: 16 },
  firm: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.navy },
  sub: { fontSize: 8.5, color: C.muted, marginTop: 2 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.navy, textAlign: 'center', marginVertical: 12, textTransform: 'uppercase' },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 6, textAlign: 'justify' },
  row: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, borderBottomWidth: 0 },
  rowLast: { borderBottomWidth: 1 },
  cellLabel: { width: '36%', padding: 6, fontFamily: 'Helvetica-Bold', backgroundColor: C.rowAlt, borderRightWidth: 1, borderRightColor: C.border },
  cellValue: { flex: 1, padding: 6 },
  disclaimer: { marginTop: 14, padding: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', fontSize: 8, color: C.warn },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  signBox: { width: '45%', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, fontSize: 9 },
})

export type RhPdfContext = {
  salarie: Salarie
  dateDocument?: string
  lieuSignature?: string
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '………………'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMoney(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '………………'
  return `${n.toFixed(2).replace('.', ',')} €`
}

function Header() {
  return (
    <View style={s.header}>
      <Text style={s.firm}>{LTDB_EMETTEUR.raisonSociale}</Text>
      <Text style={s.sub}>
        {LTDB_EMETTEUR.adresseLignes.join(' — ')} · SIRET {LTDB_SIRET} · {LTDB_FORME_JURIDIQUE}
      </Text>
      <Text style={s.sub}>Représenté par M. NAJI MONDOR, gérant</Text>
    </View>
  )
}

function Disclaimer() {
  return (
    <Text style={s.disclaimer}>
      Gabarit standard à valider par votre conseil juridique ou expert-comptable avant signature.
      Les Techniciens du Débouchage décline toute responsabilité en cas d&apos;usage sans relecture professionnelle.
    </Text>
  )
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last ? s.rowLast : {}]}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={s.cellValue}>{value || '………………'}</Text>
    </View>
  )
}

function SalariesBlock({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <View>
      <Text style={s.h2}>Salarié</Text>
      <InfoRow label="Nom et prénom" value={salarieNomComplet(sal)} />
      <InfoRow label="Adresse" value={salarieAdresseComplete(sal)} />
      <InfoRow label="Date de naissance" value={fmtDate(sal.date_naissance)} />
      <InfoRow label="Lieu de naissance" value={sal.lieu_naissance || ''} />
      <InfoRow label="Nationalité" value={sal.nationalite || ''} />
      <InfoRow label="N° sécurité sociale" value={sal.numero_secu || ''} last />
    </View>
  )
}

function ContratBody({ ctx, type }: { ctx: RhPdfContext; type: 'CDI' | 'CDD' }) {
  const sal = ctx.salarie
  const titre = type === 'CDI' ? 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE' : 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE'
  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Text style={s.title}>{titre}</Text>
      <Text style={s.p}>
        Entre les soussignés :{'\n'}
        <Text style={{ fontFamily: 'Helvetica-Bold' }}>{LTDB_EMETTEUR.raisonSociale}</Text>, {LTDB_FORME_JURIDIQUE},
        dont le siège est situé {LTDB_EMETTEUR.adresseLignes.join(', ')}, immatriculée au RCS sous le SIRET {LTDB_SIRET},
        représentée par M. NAJI MONDOR, d&apos;une part,{'\n'}
        Et : <Text style={{ fontFamily: 'Helvetica-Bold' }}>{salarieNomComplet(sal)}</Text>, demeurant {salarieAdresseComplete(sal)}, d&apos;autre part.
      </Text>
      <Text style={s.p}>Il a été convenu ce qui suit :</Text>
      <Text style={s.h2}>Article 1 — Engagement</Text>
      <Text style={s.p}>
        L&apos;employeur engage le salarié en qualité de {sal.poste || '………………'}
        {sal.qualification ? ` (${sal.qualification})` : ''}, à compter du {fmtDate(sal.date_embauche)}.
        {type === 'CDD' && sal.date_fin_contrat
          ? ` Le présent contrat est conclu pour une durée déterminée jusqu'au ${fmtDate(sal.date_fin_contrat)}${sal.motif_cdd ? `, motif : ${sal.motif_cdd}` : ''}.`
          : ''}
      </Text>
      <Text style={s.h2}>Article 2 — Rémunération</Text>
      <Text style={s.p}>
        Rémunération brute mensuelle : {fmtMoney(sal.salaire_brut_mensuel)} pour un temps de travail de {sal.temps_travail || '35 heures par semaine'}.
        {sal.coefficient != null ? ` Coefficient : ${sal.coefficient}.` : ''}
      </Text>
      <Text style={s.h2}>Article 3 — Période d&apos;essai</Text>
      <Text style={s.p}>
        Sous réserve des dispositions légales, une période d&apos;essai de {sal.periode_essai_mois ?? 2} mois est prévue, renouvelable dans les conditions légales.
      </Text>
      <Text style={s.h2}>Article 4 — Lieu de travail</Text>
      <Text style={s.p}>Le salarié exercera ses fonctions principalement sur le secteur d&apos;intervention Var / PACA et au siège de l&apos;entreprise.</Text>
      <Text style={s.h2}>Article 5 — Mutuelle</Text>
      <Text style={s.p}>{sal.mutuelle || 'Le salarié sera informé des garanties complémentaires santé prévues par l\'entreprise.'}</Text>
      <Text style={s.p}>Fait à {ctx.lieuSignature || 'Toulon'}, le {fmtDate(ctx.dateDocument || new Date().toISOString())}, en deux exemplaires originaux.</Text>
      <View style={s.signRow}>
        <Text style={s.signBox}>L&apos;employeur{'\n'}(signature précédée de la mention « Lu et approuvé »)</Text>
        <Text style={s.signBox}>Le salarié{'\n'}(signature précédée de la mention « Lu et approuvé »)</Text>
      </View>
      <Disclaimer />
    </Page>
  )
}

function DueDocument({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Text style={s.title}>DÉCLARATION UNIQUE D&apos;EMBAUCHE (DUE)</Text>
      <Text style={s.p}>Document pré-rempli à titre indicatif — à reporter sur le téléservice URSSAF Net-Entreprises.</Text>
      <Text style={s.h2}>Employeur</Text>
      <InfoRow label="Raison sociale" value={LTDB_EMETTEUR.raisonSociale} />
      <InfoRow label="SIRET" value={LTDB_SIRET} />
      <InfoRow label="Adresse" value={LTDB_EMETTEUR.adresseLignes.join(', ')} last />
      <Text style={s.h2}>Salarié</Text>
      <InfoRow label="Nom" value={sal.nom} />
      <InfoRow label="Prénom" value={sal.prenom} />
      <InfoRow label="Date de naissance" value={fmtDate(sal.date_naissance)} />
      <InfoRow label="Lieu de naissance" value={sal.lieu_naissance || ''} />
      <InfoRow label="N° sécurité sociale" value={sal.numero_secu || ''} />
      <InfoRow label="Adresse" value={salarieAdresseComplete(sal)} last />
      <Text style={s.h2}>Embauche</Text>
      <InfoRow label="Date d'embauche" value={fmtDate(sal.date_embauche)} />
      <InfoRow label="Nature du contrat" value={sal.type_contrat || 'CDI'} />
      <InfoRow label="Emploi" value={sal.poste || ''} />
      <InfoRow label="Temps de travail" value={sal.temps_travail || ''} />
      <InfoRow label="Rémunération brute mensuelle" value={fmtMoney(sal.salaire_brut_mensuel)} last />
      <Disclaimer />
    </Page>
  )
}

function FinContratDocument({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Text style={s.title}>ATTESTATION EMPLOYEUR — FIN DE CONTRAT</Text>
      <Text style={s.p}>
        Je soussigné, M. NAJI MONDOR, représentant légal de {LTDB_EMETTEUR.raisonSociale}, certifie que :
      </Text>
      <SalariesBlock ctx={ctx} />
      <Text style={s.p}>
        A été employé(e) du {fmtDate(sal.date_embauche)} au {fmtDate(sal.date_fin_contrat || ctx.dateDocument)} en qualité de {sal.poste || '………………'}.
      </Text>
      <Text style={s.p}>
        Le contrat de travail a pris fin à la date indiquée ci-dessus. Le salarié a restitué les éléments remis par l&apos;employeur dans le cadre de ses fonctions.
      </Text>
      <Text style={s.p}>Cette attestation est délivrée pour servir et valoir ce que de droit.</Text>
      <Text style={s.p}>Fait à {ctx.lieuSignature || 'Toulon'}, le {fmtDate(ctx.dateDocument || new Date().toISOString())}.</Text>
      <View style={s.signRow}>
        <Text style={s.signBox}>L&apos;employeur (cachet et signature)</Text>
        <Text style={s.signBox} />
      </View>
      <Disclaimer />
    </Page>
  )
}

function RuptureConventionnelleDocument({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Text style={s.title}>RUPTURE CONVENTIONNELLE</Text>
      <Text style={s.p}>
        Entre {LTDB_EMETTEUR.raisonSociale}, représentée par M. NAJI MONDOR, et {salarieNomComplet(sal)},
        il a été convenu d&apos;un commun accord de mettre fin au contrat de travail en cours.
      </Text>
      <SalariesBlock ctx={ctx} />
      <Text style={s.h2}>Conditions</Text>
      <Text style={s.p}>
        Date d&apos;embauche initiale : {fmtDate(sal.date_embauche)}.{'\n'}
        Emploi occupé : {sal.poste || '………………'}.{'\n'}
        Date envisagée de fin du contrat : {fmtDate(sal.date_fin_contrat || ctx.dateDocument)}.
      </Text>
      <Text style={s.p}>
        Les parties conviennent de saisir l&apos;administration conformément aux articles L.1237-11 et suivants du Code du travail.
        Le présent document constitue un projet à faire valider avant signature définitive et dépôt.
      </Text>
      <Text style={s.p}>Fait à {ctx.lieuSignature || 'Toulon'}, le {fmtDate(ctx.dateDocument || new Date().toISOString())}, en deux exemplaires.</Text>
      <View style={s.signRow}>
        <Text style={s.signBox}>L&apos;employeur</Text>
        <Text style={s.signBox}>Le salarié</Text>
      </View>
      <Disclaimer />
    </Page>
  )
}

export function RhDocumentPdf({ type, ctx }: { type: RhDocumentGenereType; ctx: RhPdfContext }) {
  switch (type) {
    case 'cdi':
      return <Document><ContratBody ctx={ctx} type="CDI" /></Document>
    case 'cdd':
      return <Document><ContratBody ctx={ctx} type="CDD" /></Document>
    case 'due':
      return <Document><DueDocument ctx={ctx} /></Document>
    case 'fin_contrat':
      return <Document><FinContratDocument ctx={ctx} /></Document>
    case 'rupture_conventionnelle':
      return <Document><RuptureConventionnelleDocument ctx={ctx} /></Document>
    default:
      return <Document><Page><Text>Type inconnu</Text></Page></Document>
  }
}

export function rhPdfFilename(type: RhDocumentGenereType, salarie: Salarie): string {
  const slug = `${salarie.prenom}-${salarie.nom}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `rh-${type}-${slug}.pdf`
}

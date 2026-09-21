'use client'
import React from "react"
import { Document, Page, Text, View, Image, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import { LTDB_EMETTEUR } from "@/lib/emetteur"
import { LTDB_SIGNATURE_PATH } from "@/lib/rapport-signatures"

/* ============ CHARTE OFFICIELLE ============ */
const C = {
  navy: '#0f2e5c',
  navyDark: '#0a2047',
  navyMid: '#25477f',
  red: '#8b1e1e',            // rouge profond, plus "sceau" qu'orangé
  redSoft: '#fbeeee',
  gold: '#a78346',           // filets dorés pour le côté officiel
  goldSoft: '#f6efdf',
  green: '#1f6b3a',
  greenSoft: '#e8f5ec',
  rowAlt: '#eef2f8',
  border: '#c7cfdb',
  borderDark: '#8a95a8',
  text: '#1a1f2e',
  muted: '#5a6270',
  white: '#ffffff',
}

const FIRM = {
  raison: LTDB_EMETTEUR.raisonSociale,
  adresse1: LTDB_EMETTEUR.adresseLignes[0] || '',
  adresse2: LTDB_EMETTEUR.adresseLignes[1] || '',
  tel: LTDB_EMETTEUR.telephone,
  email: LTDB_EMETTEUR.email,
  site: 'lestechniciensdudebouchage.fr',
  siret: LTDB_EMETTEUR.siret || '________________',
  rcPro: process.env.NEXT_PUBLIC_LTDB_RC_PRO || '__________',
}

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.5,
  },

  /* Header officiel : bandeau navy avec filet doré */
  header: {
    paddingHorizontal: 40, paddingTop: 18, paddingBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    backgroundColor: C.white,
    borderBottomWidth: 3, borderBottomColor: C.navy,
  },
  headerRuleGold: {
    height: 1, backgroundColor: C.gold,
  },
  firmBlock: { flexDirection: 'column' },
  firmName: {
    color: C.navy, fontSize: 13, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  firmTag: { color: C.muted, fontSize: 8, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerMeta: { color: C.muted, fontSize: 8, marginBottom: 1 },
  headerMetaBold: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },

  /* Content */
  content: { paddingHorizontal: 40, paddingTop: 14, paddingBottom: 10 },

  /* Titre solennel */
  solemnTitle: {
    marginTop: 4, marginBottom: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  solemnOverline: {
    color: C.gold, fontSize: 8.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6,
  },
  solemnMain: {
    color: C.navy, fontSize: 18, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'center',
    lineHeight: 1.15,
  },
  solemnSub: {
    color: C.navy, fontSize: 10.5, marginTop: 12,
    textAlign: 'center', fontFamily: 'Helvetica-Bold',
    lineHeight: 1.3,
    paddingHorizontal: 20,
  },
  solemnDivider: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 2,
    justifyContent: 'center', width: '60%', alignSelf: 'center',
  },
  solemnDividerLine: { flex: 1, height: 1, backgroundColor: C.gold },
  solemnDividerDot: {
    width: 4, height: 4, marginHorizontal: 4, borderRadius: 2, backgroundColor: C.gold,
  },

  /* Référence encadrée */
  refBox: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 7, paddingHorizontal: 12,
    marginBottom: 12, backgroundColor: C.rowAlt,
  },
  refLabel: { color: C.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  refValue: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginTop: 1 },

  /* Tableau identité */
  idTable: { borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  idRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  idRowLast: { borderBottomWidth: 0 },
  idRowAlt: { backgroundColor: C.rowAlt },
  idLabel: {
    width: '38%', paddingVertical: 7, paddingHorizontal: 10,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  idValue: { flex: 1, paddingVertical: 7, paddingHorizontal: 10, color: C.text, fontSize: 9.5 },

  /* Section band */
  sectionBand: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: 12, marginBottom: 8,
  },
  /* Wrapper d'une section qui ne doit pas être orphelin (bandeau seul en bas de page) */
  sectionKeep: {
    // marge pour espacement visuel entre sections quand on garde band+début ensemble
  },
  sectionNumBox: {
    width: 30, backgroundColor: C.navyDark,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionNumTxt: {
    color: C.white, fontSize: 13, fontFamily: 'Helvetica-Bold',
  },
  sectionTitleBox: {
    flex: 1, backgroundColor: C.navy,
    paddingVertical: 8, paddingHorizontal: 14, justifyContent: 'center',
  },
  sectionTitleTxt: {
    color: C.white, fontSize: 10.5, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.7,
  },

  /* Attestation principale — encadré solennel */
  attest: {
    borderWidth: 1.5, borderColor: C.navy,
    padding: 16, marginBottom: 14,
    backgroundColor: '#fbfbfd',
  },
  attestConform: { borderColor: C.green, backgroundColor: C.greenSoft, borderWidth: 2.5 },
  attestNonConform: { borderColor: C.red, backgroundColor: C.redSoft },
  attestInternal: { borderColor: C.gold, backgroundColor: '#fdfaf3' },
  attestBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 3, paddingHorizontal: 10,
    fontSize: 8, fontFamily: 'Helvetica-Bold',
    color: C.white, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10,
  },
  attestBadgeConform: { backgroundColor: C.green },
  attestBadgeNon: { backgroundColor: C.red },
  attestBadgeInternal: { backgroundColor: C.gold },
  attestText: {
    color: C.text, fontSize: 10, lineHeight: 1.6,
  },
  attestStrong: { fontFamily: 'Helvetica-Bold', color: C.navy },
  attestPara: { marginBottom: 8 },

  /* Encadré portée temporelle (réseau fonctionnel) */
  temporalBox: {
    borderWidth: 2.5,
    borderColor: C.green,
    backgroundColor: C.greenSoft,
    padding: 14,
    marginBottom: 14,
  },
  temporalTitle: {
    color: C.green,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  temporalText: {
    color: C.text,
    fontSize: 9.5,
    lineHeight: 1.55,
  },
  temporalStrong: {
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
  },

  /* Paragraphe standard */
  para: { marginBottom: 7, fontSize: 9.5, lineHeight: 1.55 },

  /* Checklist conformité */
  check: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 4, paddingHorizontal: 0,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  checkMark: {
    width: 22, fontSize: 11, textAlign: 'center',
    color: C.green, fontFamily: 'Helvetica-Bold',
  },
  checkMarkRed: { color: C.red },
  checkLabel: { flex: 1, fontSize: 9.5, color: C.text, paddingRight: 8 },
  checkValue: { color: C.muted, fontSize: 9 },

  /* Photos */
  photosGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6,
  },
  photoCell: { width: '50%', paddingHorizontal: 6, marginBottom: 12 },
  photoCard: {
    borderWidth: 1, borderColor: C.borderDark,
    padding: 6, backgroundColor: C.white,
  },
  photoImg: { width: '100%', height: 150, objectFit: 'cover' },
  photoCap: {
    marginTop: 6, color: C.text, fontSize: 8, textAlign: 'center',
  },

  /* Signature — grand cadre officiel */
  sigBlock: {
    borderWidth: 1.5, borderColor: C.navy,
    marginTop: 10, marginBottom: 8,
  },
  sigHead: {
    backgroundColor: C.navy,
    paddingVertical: 7, paddingHorizontal: 14,
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  sigBody: {
    padding: 12,
  },
  sigSworn: {
    color: C.text, fontSize: 10, lineHeight: 1.5,
    marginBottom: 10,
  },
  sigRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 10,
  },
  sigCol: { flex: 1 },
  sigLabel: { color: C.muted, fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  sigValue: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  sigArea: {
    height: 64, marginTop: 4,
    borderWidth: 0.5, borderColor: C.borderDark,
    backgroundColor: '#fafbfc',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sigImg: {
    height: 48,
    maxWidth: 160,
    objectFit: 'contain',
  },

  /* Footer */
  footer: {
    paddingHorizontal: 40, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.navy,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.white,
  },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },

  /* Mentions légales */
  legalBox: {
    borderTopWidth: 0.5, borderTopColor: C.border,
    paddingTop: 8, marginTop: 8,
    fontSize: 7.5, color: C.muted, lineHeight: 1.4,
    fontStyle: 'italic',
  },
})

/* ============ TYPES ============ */
export type Variante = 'tout-a-legout' | 'fosse-septique' | 'non-conforme' | 'reseau-fonctionnel'

export interface AttestationObservation {
  label: string
  valeur: string
  statut?: 'ok' | 'ko' | 'info'
}

export interface AttestationData {
  numero: string
  date: string
  variante: Variante

  // Bien / propriétaire
  nom: string
  prenom: string
  adresse: string
  codePostal: string
  ville: string

  // Technicien
  technicienNom: string

  // Contenu produit depuis la dictée
  objet: string
  methode: string                          // paragraphe: comment l'inspection a été menée
  observations: AttestationObservation[]   // checklist structurée
  conclusion: string                       // paragraphe de conclusion technique
  reserves?: string                        // éventuelles réserves (vide si néant)

  // Variante B (fosse septique) — caractéristiques relevées si pertinent
  fosse?: {
    volume_m3?: string
    etat?: string
    acces?: string
    derniere_vidange?: string
  }
  // Variante C (non-conforme) — anomalies + recommandations
  anomalies?: string[]
  recommandations?: string[]
}

export interface AttestationPDFProps {
  data: AttestationData
  photos: { url: string; legende?: string }[]
  /** Signature LTDB (défaut : /signature-ltdb.png). */
  signatureLtdbUrl?: string
}

/* ============ HELPERS ============ */
const fmtDateFR = (raw: string) => {
  if (!raw) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  return raw
}

const Header = () => (
  <View style={s.header} fixed>
    <View style={s.firmBlock}>
      <Text style={s.firmName}>{FIRM.raison}</Text>
      <Text style={s.firmTag}>Assainissement · Inspection caméra · Curage · Débouchage</Text>
    </View>
    <View style={s.headerRight}>
      <Text style={s.headerMeta}>Tél. {FIRM.tel}</Text>
      <Text style={s.headerMeta}>{FIRM.email}</Text>
      <Text style={s.headerMetaBold}>SIRET {FIRM.siret}</Text>
    </View>
  </View>
)

const Footer = () => (
  <View style={s.footer} fixed>
    <View>
      <Text style={s.footerL}>
        {FIRM.raison} · {FIRM.adresse1} · {FIRM.adresse2}
      </Text>
      <Text style={s.footerL}>
        SIRET {FIRM.siret} · RC Pro n° {FIRM.rcPro}
      </Text>
    </View>
    <Text style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
  </View>
)

const SectionBand = ({ num, title }: { num: number | string; title: string }) => (
  <View style={s.sectionBand} wrap={false}>
    <View style={s.sectionNumBox}><Text style={s.sectionNumTxt}>{num}</Text></View>
    <View style={s.sectionTitleBox}><Text style={s.sectionTitleTxt}>{title}</Text></View>
  </View>
)

const SolemnDivider = () => (
  <View style={s.solemnDivider}>
    <View style={s.solemnDividerLine} />
    <View style={s.solemnDividerDot} />
    <View style={s.solemnDividerDot} />
    <View style={s.solemnDividerDot} />
    <View style={s.solemnDividerLine} />
  </View>
)

/* ============ TEXTES D'ATTESTATION PAR VARIANTE ============ */
function attestationLabel(v: Variante): string {
  if (v === 'tout-a-legout') return 'Raccordement au réseau public d\'assainissement collectif'
  if (v === 'fosse-septique') return 'Raccordement à un dispositif d\'assainissement non collectif (fosse septique)'
  if (v === 'reseau-fonctionnel') return 'Bon fonctionnement du réseau d\'évacuation (inspection caméra)'
  return 'Non-conformité du réseau d\'évacuation'
}

function attestationClause(data: AttestationData): { badge: string; wrapStyle: Style; badgeStyle: Style; content: React.ReactNode } {
  const plein = `${data.prenom} ${data.nom}`.trim() || '—'
  const adresseComplete = [data.adresse, `${data.codePostal} ${data.ville}`].filter(Boolean).join(', ')
  const tech = data.technicienNom || '—'

  if (data.variante === 'reseau-fonctionnel') {
    return {
      badge: 'ATTESTATION — RÉSEAU FONCTIONNEL',
      wrapStyle: s.attestConform,
      badgeStyle: s.attestBadgeConform,
      content: (
        <>
          <Text style={[s.attestText, s.attestPara]}>
            Je soussigné <Text style={s.attestStrong}>{tech}</Text>, technicien de la société <Text style={s.attestStrong}>{FIRM.raison}</Text> (SIRET {FIRM.siret}), après inspection caméra du réseau d&apos;évacuation du site appartenant à / exploité par <Text style={s.attestStrong}>{plein}</Text>, situé <Text style={s.attestStrong}>{adresseComplete}</Text>,
          </Text>
          <Text style={[s.attestText, s.attestPara]}>
            <Text style={s.attestStrong}>atteste par la présente</Text> qu&apos;<Text style={s.attestStrong}>au jour du passage</Text> ({fmtDateFR(data.date)}), le réseau inspecté était <Text style={s.attestStrong}>fonctionnel</Text> : écoulement constaté, absence d&apos;obstruction bloquante sur les tronçons passés à la caméra, dans les limites des accès et de la longueur inspectée.
          </Text>
          <Text style={s.attestText}>
            Cette attestation est établie sur la base des constats techniques du jour, documentés par les photographies et/ou captures vidéo annexées. Elle est délivrée à l&apos;attention du client professionnel et de tout tiers qu&apos;il souhaiterait en informer, pour faire valoir ce que de droit.
          </Text>
        </>
      ),
    }
  }

  if (data.variante === 'tout-a-legout') {
    return {
      badge: 'ATTESTATION — CONFORME',
      wrapStyle: s.attestConform,
      badgeStyle: s.attestBadgeConform,
      content: (
        <>
          <Text style={[s.attestText, s.attestPara]}>
            Je soussigné <Text style={s.attestStrong}>{tech}</Text>, technicien de la société <Text style={s.attestStrong}>{FIRM.raison}</Text> (SIRET {FIRM.siret}), après inspection physique et caméra du réseau d&apos;évacuation du bien immobilier appartenant à <Text style={s.attestStrong}>{plein}</Text>, situé <Text style={s.attestStrong}>{adresseComplete}</Text>,
          </Text>
          <Text style={[s.attestText, s.attestPara]}>
            <Text style={s.attestStrong}>atteste par la présente</Text> que le réseau d&apos;évacuation des eaux usées de ce bien est <Text style={s.attestStrong}>correctement raccordé au réseau public d&apos;assainissement collectif</Text> (tout-à-l&apos;égout), sans interposition d&apos;ouvrage intermédiaire non déclaré.
          </Text>
          <Text style={[s.attestText, s.attestPara]}>
            Cette attestation est établie sur la base des constats techniques relevés le {fmtDateFR(data.date)}, documentés par les photographies annexées au présent document.
          </Text>
          <Text style={s.attestText}>
            Elle est délivrée pour faire valoir ce que de droit, notamment dans le cadre d&apos;une vente immobilière, et à l&apos;attention de toute autorité ou officier public (notaire, mairie, service d&apos;assainissement) en faisant la demande.
          </Text>
        </>
      ),
    }
  }

  if (data.variante === 'fosse-septique') {
    return {
      badge: 'ATTESTATION — ASSAINISSEMENT NON COLLECTIF',
      wrapStyle: s.attestInternal,
      badgeStyle: s.attestBadgeInternal,
      content: (
        <>
          <Text style={[s.attestText, s.attestPara]}>
            Je soussigné <Text style={s.attestStrong}>{tech}</Text>, technicien de la société <Text style={s.attestStrong}>{FIRM.raison}</Text> (SIRET {FIRM.siret}), après inspection physique et caméra du réseau d&apos;évacuation du bien immobilier appartenant à <Text style={s.attestStrong}>{plein}</Text>, situé <Text style={s.attestStrong}>{adresseComplete}</Text>,
          </Text>
          <Text style={[s.attestText, s.attestPara]}>
            <Text style={s.attestStrong}>atteste par la présente</Text> que le réseau d&apos;évacuation des eaux usées de ce bien est <Text style={s.attestStrong}>raccordé à un dispositif d&apos;assainissement non collectif</Text> de type <Text style={s.attestStrong}>fosse septique</Text>, dont les caractéristiques relevées lors de l&apos;inspection sont consignées au chapitre « Relevés techniques ».
          </Text>
          <Text style={[s.attestText, s.attestPara]}>
            Cette attestation est établie sur la base des constats techniques du {fmtDateFR(data.date)} et des photographies annexées. Le contrôle de conformité réglementaire du dispositif relève du SPANC (Service Public d&apos;Assainissement Non Collectif) compétent ; la présente attestation porte uniquement sur la configuration physique constatée le jour de l&apos;inspection.
          </Text>
          <Text style={s.attestText}>
            Elle est délivrée pour faire valoir ce que de droit, notamment dans le cadre d&apos;une vente immobilière, et à l&apos;attention de toute autorité ou officier public (notaire, mairie, SPANC) en faisant la demande.
          </Text>
        </>
      ),
    }
  }

  // non-conforme
  return {
    badge: 'ATTESTATION — NON-CONFORMITÉ',
    wrapStyle: s.attestNonConform,
    badgeStyle: s.attestBadgeNon,
    content: (
      <>
        <Text style={[s.attestText, s.attestPara]}>
          Je soussigné <Text style={s.attestStrong}>{tech}</Text>, technicien de la société <Text style={s.attestStrong}>{FIRM.raison}</Text> (SIRET {FIRM.siret}), après inspection physique et caméra du réseau d&apos;évacuation du bien immobilier appartenant à <Text style={s.attestStrong}>{plein}</Text>, situé <Text style={s.attestStrong}>{adresseComplete}</Text>,
        </Text>
        <Text style={[s.attestText, s.attestPara]}>
          <Text style={s.attestStrong}>constate et atteste</Text> que le réseau d&apos;évacuation de ce bien présente des <Text style={s.attestStrong}>non-conformités</Text> détaillées au chapitre « Anomalies constatées », et que sa configuration, telle qu&apos;observée le jour de l&apos;inspection, <Text style={s.attestStrong}>ne correspond pas aux caractéristiques d&apos;un raccordement conforme</Text> au réseau public ou à un dispositif d&apos;assainissement non collectif réglementaire.
        </Text>
        <Text style={[s.attestText, s.attestPara]}>
          Ce document est dressé à titre probatoire, sur la base des constats techniques du {fmtDateFR(data.date)} et des photographies annexées.
        </Text>
        <Text style={s.attestText}>
          Il peut être produit dans le cadre d&apos;une procédure (vice caché, recours amiable ou judiciaire) ou communiqué à toute autorité ou officier public (notaire, mairie, service d&apos;assainissement) en faisant la demande.
        </Text>
      </>
    ),
  }
}

/* ============ DOCUMENT ============ */
export function AttestationDocument({ data, photos, signatureLtdbUrl }: AttestationPDFProps) {
  const ltdbSigUrl = signatureLtdbUrl || LTDB_SIGNATURE_PATH
  const clause = attestationClause(data)
  const variantTitle = attestationLabel(data.variante)

  const idRows: Array<{ k: string; v: string }> = [
    {
      k: data.variante === 'reseau-fonctionnel' ? 'Client / exploitant' : 'Propriétaire',
      v: `${data.prenom} ${data.nom}`.trim() || '—',
    },
    {
      k: data.variante === 'reseau-fonctionnel' ? 'Adresse du site' : 'Adresse du bien',
      v: [data.adresse, `${data.codePostal} ${data.ville}`].filter(Boolean).join(' — ') || '—',
    },
    { k: 'Date de l\'inspection', v: fmtDateFR(data.date) },
    { k: 'Technicien intervenant', v: data.technicienNom || '—' },
    { k: 'Objet de l\'attestation', v: variantTitle },
    { k: 'N° de dossier', v: data.numero },
  ]

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header />

        <View style={s.content}>
          {/* Titre solennel */}
          <View style={s.solemnTitle} wrap={false}>
            <Text style={s.solemnOverline}>Document technique probatoire</Text>
            {data.variante === 'reseau-fonctionnel' ? (
              <>
                <Text style={[s.solemnMain, { fontSize: 16 }]}>Attestation de bon fonctionnement</Text>
                <Text style={[s.solemnSub, { marginTop: 8 }]}>{variantTitle}</Text>
              </>
            ) : (
              <>
                <Text style={s.solemnMain}>Attestation de conformité</Text>
                <Text style={s.solemnMain}>de raccordement</Text>
                <Text style={s.solemnSub}>{variantTitle}</Text>
              </>
            )}
            <SolemnDivider />
          </View>

          <View style={s.refBox} wrap={false}>
            <View>
              <Text style={s.refLabel}>Référence du dossier</Text>
              <Text style={s.refValue}>{data.numero}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.refLabel}>Date d&apos;établissement</Text>
              <Text style={s.refValue}>{fmtDateFR(data.date)}</Text>
            </View>
          </View>

          {/* Identité */}
          <View style={s.idTable} wrap={false}>
            {idRows.map((r, i, arr) => (
              <View key={i} style={[s.idRow, i % 2 ? s.idRowAlt : {}, i === arr.length - 1 ? s.idRowLast : {}]}>
                <Text style={s.idLabel}>{r.k}</Text>
                <Text style={s.idValue}>{r.v}</Text>
              </View>
            ))}
          </View>

          {/* Attestation centrale */}
          <View style={[s.attest, clause.wrapStyle]} wrap={false}>
            <Text style={[s.attestBadge, clause.badgeStyle]}>{clause.badge}</Text>
            {clause.content}
          </View>

          {data.variante === 'reseau-fonctionnel' ? (
            <View style={s.temporalBox} wrap={false}>
              <Text style={s.temporalTitle}>⚠ Portée de l&apos;attestation — au jour du passage uniquement</Text>
              <Text style={s.temporalText}>
                Les constats ci-dessus décrivent l&apos;état du réseau <Text style={s.temporalStrong}>uniquement au {fmtDateFR(data.date)}</Text>, jour de l&apos;intervention et de l&apos;inspection caméra.
              </Text>
              <Text style={[s.temporalText, { marginTop: 6 }]}>
                <Text style={s.temporalStrong}>Ce document ne constitue pas une garantie dans le temps</Text> : un dysfonctionnement, un bouchon, une détérioration ou une utilisation ultérieure peuvent survenir après notre passage. Toute réclamation fondée sur un état constaté plusieurs semaines ou mois plus tard ne pourra être opposée à la présente attestation, qui certifie exclusivement la situation observée le jour J.
              </Text>
            </View>
          ) : null}

          {/* Section 1 — Objet (bandeau + paragraphe solidaires) */}
          {data.objet ? (
            <View wrap={false}>
              <SectionBand num={1} title="Objet de l'intervention" />
              <Text style={s.para}>{data.objet}</Text>
            </View>
          ) : null}

          {/* Section 2 — Méthode (bandeau + paragraphe solidaires) */}
          {data.methode ? (
            <View wrap={false}>
              <SectionBand num={2} title="Méthodologie de l'inspection" />
              <Text style={s.para}>{data.methode}</Text>
            </View>
          ) : null}

          {/* Section 3 — Relevés techniques (checklist) */}
          {(data.observations?.length ?? 0) > 0 ? (() => {
            const first = data.observations[0]
            const rest = data.observations.slice(1)
            const renderCheck = (o: AttestationObservation, key: number | string) => {
              const statut = o.statut || 'info'
              const mark = statut === 'ok' ? '✓' : statut === 'ko' ? '✗' : '•'
              const markStyle = statut === 'ko' ? s.checkMarkRed : {}
              return (
                <View key={key} style={s.check} wrap={false}>
                  <Text style={[s.checkMark, markStyle]}>{mark}</Text>
                  <Text style={s.checkLabel}>{o.label}</Text>
                  <Text style={s.checkValue}>{o.valeur}</Text>
                </View>
              )
            }
            return (
              <View>
                {/* bandeau + 1ʳᵉ ligne ensemble → jamais de bandeau orphelin */}
                <View wrap={false}>
                  <SectionBand num={3} title="Relevés techniques" />
                  {renderCheck(first, 'first')}
                </View>
                {rest.map((o, i) => renderCheck(o, i))}
              </View>
            )
          })() : null}

          {/* Variante B — caractéristiques fosse si présentes */}
          {data.variante === 'fosse-septique' && data.fosse ? (
            <View wrap={false}>
              <SectionBand num={4} title="Caractéristiques du dispositif" />
              <View style={s.idTable}>
                {[
                  { k: 'Volume estimé', v: data.fosse.volume_m3 || '—' },
                  { k: 'État général', v: data.fosse.etat || '—' },
                  { k: 'Accessibilité', v: data.fosse.acces || '—' },
                  { k: 'Dernière vidange', v: data.fosse.derniere_vidange || 'Non communiquée' },
                ].map((r, i, arr) => (
                  <View key={i} style={[s.idRow, i % 2 ? s.idRowAlt : {}, i === arr.length - 1 ? s.idRowLast : {}]}>
                    <Text style={s.idLabel}>{r.k}</Text>
                    <Text style={s.idValue}>{r.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Variante C — anomalies */}
          {data.variante === 'non-conforme' && (data.anomalies?.length ?? 0) > 0 ? (
            <View>
              {/* bandeau + 1ʳᵉ anomalie ensemble */}
              <View wrap={false}>
                <SectionBand num={4} title="Anomalies constatées" />
                <View style={s.check}>
                  <Text style={[s.checkMark, s.checkMarkRed]}>✗</Text>
                  <Text style={s.checkLabel}>{data.anomalies![0]}</Text>
                </View>
              </View>
              {data.anomalies!.slice(1).map((a, i) => (
                <View key={i} style={s.check} wrap={false}>
                  <Text style={[s.checkMark, s.checkMarkRed]}>✗</Text>
                  <Text style={s.checkLabel}>{a}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Photos */}
          {(photos?.length ?? 0) > 0 ? (
            <View>
              <SectionBand num={data.variante === 'non-conforme' || (data.variante === 'fosse-septique' && data.fosse) ? 5 : 4} title="Documents photographiques" />
              <View style={s.photosGrid}>
                {photos.map((p, i) => (
                  <View key={i} style={s.photoCell} wrap={false}>
                    <View style={s.photoCard}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image src={p.url} style={s.photoImg} />
                      <Text style={s.photoCap}>Photo nº {i + 1}{p.legende ? ` — ${p.legende}` : ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Conclusion */}
          {data.conclusion ? (
            <View>
              {/* bandeau + 1ʳᵉ ligne solidaires */}
              <View wrap={false}>
                <SectionBand
                  num={
                    (photos?.length ?? 0) > 0
                      ? data.variante === 'non-conforme' || (data.variante === 'fosse-septique' && data.fosse)
                        ? 6
                        : 5
                      : data.variante === 'non-conforme' || (data.variante === 'fosse-septique' && data.fosse)
                        ? 5
                        : 4
                  }
                  title="Conclusion technique"
                />
                <Text style={s.para}>{data.conclusion}</Text>
              </View>
              {data.reserves ? (
                <View wrap={false}>
                  <Text style={[s.para, { fontFamily: 'Helvetica-Bold', marginTop: 8 }]}>Réserves éventuelles</Text>
                  <Text style={s.para}>{data.reserves}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Cadre de signature solennel + mentions (solidaires) */}
          <View wrap={false}>
            <View style={s.sigBlock}>
              <Text style={s.sigHead}>Attestation signée</Text>
              <View style={s.sigBody}>
                <Text style={s.sigSworn}>
                  Fait à <Text style={{ fontFamily: 'Helvetica-Bold' }}>{data.ville || '—'}</Text>, le <Text style={{ fontFamily: 'Helvetica-Bold' }}>{fmtDateFR(data.date)}</Text>, pour servir et valoir ce que de droit.
                </Text>
                <View style={s.sigRow}>
                  <View style={s.sigCol}>
                    <Text style={s.sigLabel}>Société</Text>
                    <Text style={s.sigValue}>{FIRM.raison}</Text>
                    <Text style={s.sigLabel}>Technicien intervenant</Text>
                    <Text style={s.sigValue}>{data.technicienNom || '—'}</Text>
                    <Text style={s.sigLabel}>Cachet & signature</Text>
                    <View style={s.sigArea}>
                      <Image style={s.sigImg} src={ltdbSigUrl} />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={s.legalBox}>
              <Text>
                {data.variante === 'reseau-fonctionnel'
                  ? "Document établi à titre probatoire sur la base des constats techniques et vidéo réalisés le jour de l'inspection caméra. Il atteste exclusivement de l'état observé à cette date et ne constitue en aucun cas une garantie de fonctionnement ultérieur du réseau. Toute réclamation fondée sur un état constaté après le jour du passage ne pourra être opposée à la présente attestation."
                  : "Document établi à titre probatoire sur la base des constats physiques et vidéo réalisés le jour de l'inspection. Il ne préjuge ni de la pérennité future du réseau ni de conformités réglementaires extérieures au périmètre d'inspection. Tout usage auprès d'un officier ministériel (notaire) ou d'une administration relève de l'appréciation du destinataire. Conservation recommandée dans le dossier de vente."}
              </Text>
            </View>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  )
}

interface DownloadButtonProps extends AttestationPDFProps {
  filename?: string
}

export default function AttestationDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `attestation-${(props.data.nom || 'bien').toLowerCase().replace(/\s+/g, '-')}-${props.data.numero}.pdf`
  return (
    <PDFDownloadLink document={<AttestationDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="bg-[#0f2e5c] text-white px-5 py-3 rounded-lg hover:bg-[#0a2047] disabled:opacity-50 font-bold"
        >
          {loading ? 'Génération PDF...' : '⬇ Télécharger l\'attestation PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}

import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"
import { LTDB_EMETTEUR } from "@/lib/emetteur"
import { getClientSignatureForPdf, LTDB_SIGNATURE_PATH } from "@/lib/rapport-signatures"
import { PdfBanner, PDF_C } from "./PdfBranding"

/* ============ CHARTE (alignée facture / devis) ============ */
const C = {
  navy: PDF_C.navy,
  navyDark: PDF_C.navyDark,
  navyMid: '#2d4f8f',
  red: PDF_C.red,
  redSoft: '#fdecea',
  orange: '#e67e22',
  orangeSoft: '#fdf0e3',
  teal: '#0f7a3b',
  tealSoft: '#e8f3ec',
  greenBorder: '#a3c9b3',
  rowAlt: '#eef4fc',
  border: '#e3e8ef',
  lineSoft: '#eef1f6',
  text: PDF_C.text,
  muted: PDF_C.muted,
  mutedLight: '#9ca3af',
  white: PDF_C.white,
  bgSoft: '#fafbfc',
  yellowDark: '#7c5e00',
  yellowSoft: '#fff8dc',
  yellowBorder: '#e8d384',
}

/** Réserve verticale bandeau fixe (sans sous-titre) + vague rouge */
const PAGE_HEADER_RESERVE = 108
/** Réserve pied de page fixe */
const PAGE_FOOTER_RESERVE = 48

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 0,
    paddingTop: PAGE_HEADER_RESERVE,
    paddingBottom: PAGE_FOOTER_RESERVE,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.45,
  },
  content: { paddingHorizontal: 40, paddingTop: 8, paddingBottom: 8 },

  /* Bloc client + métadonnées (comme facture) */
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  billTo: { flex: 1, paddingRight: 20 },
  sectionLabel: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5,
  },
  clientName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 3 },
  clientLine: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },
  clientLabel: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 5 },

  metaBox: { width: '42%', borderWidth: 1, borderColor: C.border, borderRadius: 8 },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 12,
    borderBottomWidth: 0.75, borderBottomColor: C.lineSoft,
  },
  metaRowLast: { borderBottomWidth: 0 },
  metaK: { color: C.muted, fontSize: 9 },
  metaV: { color: C.text, fontSize: 9, fontFamily: 'Helvetica-Bold', maxWidth: '58%', textAlign: 'right' },
  metaTechRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', maxWidth: '58%' },
  techPhoto: { width: 22, height: 22, borderRadius: 11, marginRight: 6, objectFit: 'cover' },

  objet: { fontSize: 9.5, marginBottom: 12, lineHeight: 1.5 },
  objetLabel: { fontFamily: 'Helvetica-Bold', color: C.navy },

  /* Sections contenu */
  sectionBlock: { marginBottom: 12 },
  card: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    padding: 12,
  },
  cardHeader: {
    borderWidth: 1, borderColor: C.border,
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
    borderBottomWidth: 0,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  cardBody: {
    borderWidth: 1, borderColor: C.border, borderTopWidth: 0,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
    padding: 12,
  },
  cardAccentBlue: { borderLeftWidth: 4, borderLeftColor: C.navy },
  cardAccentOrange: { borderLeftWidth: 4, borderLeftColor: C.orange },
  cardAccentTeal: { borderLeftWidth: 4, borderLeftColor: C.teal },
  cardAccentRed: { borderLeftWidth: 4, borderLeftColor: C.red },
  cardAccentGreen: { borderLeftWidth: 4, borderLeftColor: C.teal },
  cardTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 0,
  },
  cardText: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },

  /* Legacy id table — conservé pour compatibilité interne */
  idTable: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    marginBottom: 14, overflow: 'hidden',
  },
  idRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  idRowLast: { borderBottomWidth: 0 },
  idRowAlt: { backgroundColor: C.rowAlt },
  idLabel: {
    width: '35%', paddingVertical: 8, paddingHorizontal: 10,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  idValue: {
    flex: 1, paddingVertical: 8, paddingHorizontal: 10,
    color: C.text, fontSize: 9.5,
  },

  /* Section band */
  sectionBand: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: 22, marginBottom: 10,
  },
  sectionNumBox: {
    width: 34, backgroundColor: C.navy,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionNumTxt: {
    color: C.white, fontSize: 14, fontFamily: 'Helvetica-Bold',
  },
  sectionTitleBox: {
    flex: 1, backgroundColor: C.navyMid,
    paddingVertical: 9, paddingHorizontal: 14, justifyContent: 'center',
  },
  sectionTitleTxt: {
    color: C.white, fontSize: 11, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  /* Section band variants */
  bandRed: { backgroundColor: C.red },
  bandOrange: { backgroundColor: C.orange },
  bandTeal: { backgroundColor: C.teal },
  numBoxNavyDark: { backgroundColor: C.navyDark },

  /* Paragraph */
  para: { marginBottom: 6, color: C.text, fontSize: 9.5, lineHeight: 1.5 },

  /* Declarative red-bordered callout (ÉLÉMENT ESSENTIEL) */
  callout: {
    borderWidth: 1, borderColor: C.red, borderRadius: 2,
    marginTop: 4, marginBottom: 8,
  },
  calloutHead: {
    backgroundColor: C.red, paddingVertical: 6, paddingHorizontal: 12,
  },
  calloutHeadTxt: {
    color: C.white, fontSize: 9, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  calloutBody: {
    backgroundColor: C.redSoft, paddingVertical: 12, paddingHorizontal: 14,
  },
  calloutText: {
    color: C.text, fontSize: 9.5, lineHeight: 1.5, marginBottom: 6,
  },

  /* Methodology numbered list */
  methStep: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 6,
  },
  methNum: {
    width: 22, height: 22, backgroundColor: C.navyMid,
    color: C.white, textAlign: 'center', paddingTop: 5,
    fontSize: 10, fontFamily: 'Helvetica-Bold', marginRight: 10,
  },
  methText: { flex: 1, paddingTop: 4, color: C.text, fontSize: 9.5 },

  /* Anomaly card */
  anomaly: {
    flexDirection: 'row', marginBottom: 10,
  },
  anomalyBar: { width: 4 },
  anomalyBody: {
    flex: 1, borderWidth: 1, borderColor: C.border, borderLeftWidth: 0,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  anomalyHead: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 6,
  },
  anomalyTag: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 10,
    marginRight: 8,
  },
  anomalyTitle: {
    flex: 1, color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 10,
  },
  anomalyBadge: {
    paddingVertical: 2, paddingHorizontal: 8,
    fontSize: 7.5, fontFamily: 'Helvetica-Bold',
    color: C.white, letterSpacing: 0.5,
  },
  anomalyDesc: { color: C.text, fontSize: 9, lineHeight: 1.45 },

  /* Photos */
  photosWrap: { marginTop: 6 },
  photosIntro: { color: C.text, fontSize: 9.5, marginBottom: 10 },
  photosGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6,
  },
  photoCell: {
    width: '50%', paddingHorizontal: 6, marginBottom: 12,
  },
  photoCard: {
    borderWidth: 1, borderColor: C.border,
    padding: 6, backgroundColor: C.white,
  },
  photoImg: { width: '100%', height: 130, objectFit: 'cover' },
  photoCap: {
    marginTop: 6, color: C.text, fontSize: 8,
    textAlign: 'center', paddingHorizontal: 2,
  },

  /* Prescriptions sub-band */
  subBand: {
    paddingVertical: 6, paddingHorizontal: 12,
    marginTop: 12, marginBottom: 6,
  },
  subBandRed: { backgroundColor: C.red },
  subBandBlue: { backgroundColor: C.navyMid },
  subBandTeal: { backgroundColor: C.teal },
  subBandTxt: {
    color: C.white, fontSize: 9.5, fontFamily: 'Helvetica-Bold',
  },
  precoItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 5, paddingLeft: 2,
  },
  precoSquare: {
    width: 8, height: 8, marginTop: 4, marginRight: 9,
  },
  sqRed: { backgroundColor: C.red },
  sqBlue: { backgroundColor: C.navyMid },
  sqTeal: { backgroundColor: C.teal },
  precoTxt: { flex: 1, color: C.text, fontSize: 9.5, lineHeight: 1.45 },

  /* Conclusion filled navy block */
  conclusionBlock: {
    backgroundColor: C.navy,
    paddingVertical: 16, paddingHorizontal: 18,
    marginTop: 4, marginBottom: 14,
  },
  conclusionP: {
    color: C.white, fontSize: 9.5, lineHeight: 1.55, marginBottom: 8,
  },

  /* Signature 2-col table */
  sigTable: {
    flexDirection: 'row',
    borderWidth: 1, borderColor: C.border,
    marginTop: 10,
  },
  sigCol: {
    flex: 1, padding: 0,
  },
  sigColSep: { borderRightWidth: 1, borderRightColor: C.border },
  sigHead: {
    backgroundColor: C.rowAlt,
    paddingVertical: 7, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
  },
  sigBody: {
    paddingVertical: 14, paddingHorizontal: 10, minHeight: 80,
  },
  sigLine: {
    color: C.muted, fontSize: 8.5, marginBottom: 10,
  },
  sigImg: { height: 52, marginTop: 4, marginBottom: 4, objectFit: 'contain' },
  sigPlaceholder: {
    fontSize: 8, color: C.muted, fontFamily: 'Helvetica-Oblique', marginTop: 8,
  },

  /* Footer (aligné facture) */
  footer: {
    paddingHorizontal: 40, paddingTop: 8, paddingBottom: 14,
    borderTopWidth: 2, borderTopColor: C.red,
    backgroundColor: C.white,
  },
  footerBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },

  /* Devis intégré — style facture */
  itemsHead: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.2, borderColor: C.navy, borderRadius: 22,
    paddingVertical: 7, paddingHorizontal: 8, marginBottom: 0,
  },
  itemsHeadCell: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 6,
  },
  itemsRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: 0.75, borderBottomColor: C.lineSoft,
  },
  cDesig: { width: '52%', paddingHorizontal: 6 },
  cDesigName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  cDesigDesc: { color: C.muted, fontSize: 8.5, marginTop: 1, lineHeight: 1.4 },
  cQte: { width: '12%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'right' },
  cPu: { width: '18%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'right' },
  cTot: { width: '18%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

  totalsMini: { alignSelf: 'flex-end', width: '46%', marginTop: 10 },
  totalsMiniRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4, paddingHorizontal: 8,
  },
  totalsMiniLbl: { color: C.muted, fontSize: 10 },
  totalsMiniVal: { color: C.text, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.red, borderRadius: 8,
    paddingVertical: 11, paddingHorizontal: 18,
    marginTop: 8, marginBottom: 12,
  },
  totalBarLbl: { color: C.white, fontSize: 12.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  totalBarVal: { color: C.white, fontSize: 15, fontFamily: 'Helvetica-Bold' },

  conditions: {
    borderLeftWidth: 4, borderLeftColor: C.orange,
    backgroundColor: C.orangeSoft,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 10, borderRadius: 6,
  },
  conditionsTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6,
  },
  conditionsItem: { color: C.text, fontSize: 9, marginBottom: 3, lineHeight: 1.45 },

  garantieBlock: {
    borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4,
  },
  garantieTitle: {
    fontFamily: 'Helvetica-Bold', fontSize: 9.5, textTransform: 'uppercase',
    letterSpacing: 0.3, marginBottom: 5,
  },
  garantieText: { fontSize: 9.5, lineHeight: 1.5 },

  /* Legacy devis — conservé */
  devisHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.navy, padding: 16, marginTop: 2, marginBottom: 14,
  },
  devisHeaderTitle: { color: C.white, fontSize: 16, fontFamily: 'Helvetica-Bold' },
  devisHeaderSub: { color: '#c8d4e8', fontSize: 9, marginTop: 3 },
  devisHeaderRight: { alignItems: 'flex-end' },
  devisHeaderLbl: { color: '#c8d4e8', fontSize: 7, letterSpacing: 0.5 },
  devisHeaderV: { color: C.white, fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  devisMetaRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  devisMetaCell: {
    width: '50%', padding: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  devisMetaK: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8, letterSpacing: 0.3 },
  devisMetaV: { color: C.text, fontSize: 9.5, marginTop: 3 },
  devisTable: {
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  devisHead: { flexDirection: 'row', backgroundColor: C.navy },
  devisHeadCell: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8,
    padding: 8, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  devisSectionRow: {
    backgroundColor: C.rowAlt, paddingVertical: 5, paddingHorizontal: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  devisSectionTxt: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  devisLine: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border,
    padding: 8,
  },
  devisDesignation: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  devisDescription: { color: C.muted, fontSize: 8, marginTop: 2 },
  devisCell: { padding: 8, fontSize: 9 },

  totaux: { marginLeft: 'auto', width: '55%', marginBottom: 14 },
  totauxRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  totauxRowTtc: { backgroundColor: C.navy, borderBottomWidth: 0 },
  totauxLbl: { color: C.muted, fontSize: 9 },
  totauxV: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  totauxLblTtc: { color: '#c8d4e8', fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totauxVTtc: { color: C.white, fontSize: 11, fontFamily: 'Helvetica-Bold' },

})

/* ============ TYPES ============ */
type Statut = 'critical' | 'warn' | 'info' | 'ok' | 'neutral'

interface Phase { titre: string; statut?: Statut; contexte: string; action: string; resultat: string }
interface AnalyseRow { probleme: string; localisation: string; description: string; statut: Statut; label: string }
interface PrecoItem { k: string; v: string }
interface Preco { tag: string; titre: string; items: PrecoItem[] }
interface DevisLine { section?: string; designation: string; description?: string; qte: number; pu_ht: number }
interface Devis {
  numero?: string
  validite_jours?: number
  lignes: DevisLine[]
  tva_taux?: number
  conditions?: string[]
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
  phases?: Phase[]
  avis_technique?: {
    titre: string; niveau?: Statut; intro: string;
    points_majeurs: string[]; diagnostic_final: string; recommandation_urgente: string
  } | null
  analyse_table?: AnalyseRow[]
  preconisations?: Preco[]
  devis?: Devis | null
  reference?: string
  garantie_intervention?: {
    est_garanti: boolean
    commentaire?: string
    saisi_at?: string
  } | null
}

export interface PDFProps {
  clientNom: string
  adresse: string
  ville: string
  codePostal: string
  dateIntervention: string
  typeIntervention: string
  technicienNom: string
  technicienPhotoUrl?: string | null
  rapport: RapportData
  phone?: string
  reference?: string
  photos?: { url: string; legende?: string }[]
  /** Signature universelle LTDB (défaut : /signature-ltdb.png) */
  signatureLtdbUrl?: string
  /** Signature client (accord validé) */
  signatureClientUrl?: string | null
  signatureClientDate?: string | null
}

/* ============ HELPERS ============ */
const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, ' ') + ' €'

const fmtDateFR = (iso: string) => {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]} / ${m[2]} / ${m[1]}`
  return iso
}

const fmtDateHeureFR = (iso: string | null | undefined) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fmtDateFR(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace(/\s/g, ' ')
}

function RapportSignatures({
  technicienNom,
  clientNom,
  dateIntervention,
  signatureLtdbUrl,
  signatureClientUrl,
  signatureClientDate,
  clientHead = 'Client — Lu et approuvé',
}: {
  technicienNom: string
  clientNom: string
  dateIntervention: string
  signatureLtdbUrl: string
  signatureClientUrl?: string | null
  signatureClientDate?: string | null
  clientHead?: string
}) {
  const clientSig = getClientSignatureForPdf(signatureClientUrl)
  const clientDateLabel = signatureClientDate
    ? fmtDateHeureFR(signatureClientDate)
    : fmtDateFR(dateIntervention)

  return (
    <View style={s.sigTable} wrap={false}>
      <View style={[s.sigCol, s.sigColSep]}>
        <Text style={s.sigHead}>Les Techniciens du Débouchage</Text>
        <View style={s.sigBody}>
          <Text style={s.sigLine}>Technicien : {technicienNom || '—'}</Text>
          <Text style={s.sigLine}>Date : {fmtDateFR(dateIntervention)}</Text>
          <Image style={s.sigImg} src={signatureLtdbUrl} />
        </View>
      </View>
      <View style={s.sigCol}>
        <Text style={s.sigHead}>{clientHead}</Text>
        <View style={s.sigBody}>
          <Text style={s.sigLine}>{clientNom || '—'}</Text>
          <Text style={s.sigLine}>Date : {clientDateLabel}</Text>
          {clientSig ? (
            <Image style={s.sigImg} src={clientSig} />
          ) : (
            <Text style={s.sigPlaceholder}>Signature :</Text>
          )}
        </View>
      </View>
    </View>
  )
}

const statutLabel = (statut: Statut): { text: string; bg: string; barColor: string } => {
  switch (statut) {
    case 'critical': return { text: 'CRITIQUE', bg: C.red, barColor: C.red }
    case 'warn':     return { text: 'ÉLEVÉE', bg: C.orange, barColor: C.orange }
    case 'info':     return { text: 'À PRÉVOIR', bg: C.navyMid, barColor: C.navyMid }
    case 'ok':       return { text: 'CONFORME', bg: C.teal, barColor: C.teal }
    default:         return { text: 'N/A', bg: C.mutedLight, barColor: C.mutedLight }
  }
}

const Header = ({
  title = 'RAPPORT',
  refNum,
  phone,
}: {
  title?: string
  refNum: string
  phone?: string
}) => (
  <View fixed>
    <PdfBanner
      title={title}
      numero={refNum}
      phone={phone || TEL_PRINCIPAL_FALLBACK}
      email={LTDB_EMETTEUR.email}
    />
  </View>
)

const Footer = ({ phone }: { phone?: string }) => (
  <View style={s.footer} fixed>
    <View style={s.footerBottomRow}>
      <View>
        <Text style={s.footerL}>
          {[LTDB_EMETTEUR.raisonSociale, ...LTDB_EMETTEUR.adresseLignes].join(' · ')}
        </Text>
        <Text style={s.footerL}>
          Tél. {phone || TEL_PRINCIPAL_FALLBACK} · {LTDB_EMETTEUR.email} · lestechniciensdudebouchage.fr
        </Text>
      </View>
      <Text
        style={s.footerR}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  </View>
)

const SectionCard = ({
  num, title, accent, children,
}: {
  num: string
  title: string
  accent?: 'blue' | 'orange' | 'teal' | 'red' | 'green'
  children: React.ReactNode
}) => {
  const accentStyle =
    accent === 'orange' ? s.cardAccentOrange :
    accent === 'teal' ? s.cardAccentTeal :
    accent === 'red' ? s.cardAccentRed :
    accent === 'green' ? s.cardAccentGreen :
    s.cardAccentBlue
  return (
    <View style={s.sectionBlock} wrap>
      <View style={[s.cardHeader, accentStyle]} wrap={false} minPresenceAhead={24}>
        <Text style={s.cardTitle}>{num} — {title}</Text>
      </View>
      <View style={[s.cardBody, accentStyle]} wrap minPresenceAhead={40}>
        {children}
      </View>
    </View>
  )
}

/* ============ DOCUMENT ============ */
export function RealisationDocument({
  clientNom, adresse, ville, codePostal, dateIntervention, typeIntervention,
  technicienNom, technicienPhotoUrl, rapport, reference, photos, phone,
  signatureLtdbUrl,
  signatureClientUrl,
  signatureClientDate,
}: PDFProps) {
  const ref = reference || rapport.reference || `LTDB-${dateIntervention.replace(/-/g, '')}`
  const hasPhotos = (photos?.length ?? 0) > 0
  const ltdbSigUrl = signatureLtdbUrl || LTDB_SIGNATURE_PATH
  const chantierLine = [adresse, [codePostal, ville].filter(Boolean).join(' ')].filter(Boolean).join(' — ')

  /* Section numbering (stable: skip empty sections) */
  const hasContexte     = !!(rapport.contexte && rapport.contexte.trim())
  const hasMethodo      = (rapport.phases?.length ?? 0) > 0 || !!(rapport.travaux_realises && rapport.travaux_realises.trim())
  const hasAnomalies    = (rapport.analyse_table?.length ?? 0) > 0
  const hasPrecos       = (rapport.preconisations?.length ?? 0) > 0 || !!(rapport.recommandations && rapport.recommandations.trim())
  const hasConclusion   =
    !!(rapport.avis_technique?.diagnostic_final || rapport.avis_technique?.recommandation_urgente) ||
    !!(rapport.diagnostic && rapport.diagnostic.trim()) ||
    !!(rapport.commentaire_technicien && rapport.commentaire_technicien.trim())
  const garantie = rapport.garantie_intervention
  const hasGarantie = garantie != null && typeof garantie.est_garanti === 'boolean'

  const sections: string[] = []
  if (hasContexte) sections.push('contexte')
  if (hasMethodo) sections.push('methodo')
  if (hasAnomalies) sections.push('anomalies')
  if (hasPhotos) sections.push('photos')
  if (hasPrecos) sections.push('precos')
  if (hasGarantie) sections.push('garantie')
  if (hasConclusion) sections.push('conclusion')

  const numOf = (key: string) => String(sections.indexOf(key) + 1)

  /* Critical callout (ÉLÉMENT ESSENTIEL) — shown only when avis_technique is critical */
  const showCritical =
    rapport.avis_technique &&
    (rapport.avis_technique.niveau === 'critical' || !rapport.avis_technique.niveau) &&
    !!(rapport.avis_technique.intro || rapport.avis_technique.titre)

  /* Methodology steps: use phases titres, fallback to travaux_realises split */
  const methoSteps: string[] =
    (rapport.phases && rapport.phases.length > 0)
      ? rapport.phases.map(p => p.titre || '').filter(Boolean)
      : (rapport.travaux_realises ? [rapport.travaux_realises] : [])

  /* Devis calc */
  const lignes = rapport.devis?.lignes || []
  const totalHT = lignes.reduce((sum, l) => sum + l.pu_ht * l.qte, 0)
  const tvaTaux = rapport.devis?.tva_taux ?? 10
  const tva = totalHT * tvaTaux / 100
  const totalTTC = totalHT + tva
  const devisSectionsMap = new Map<string, DevisLine[]>()
  lignes.forEach(l => {
    const k = l.section || 'Prestations'
    if (!devisSectionsMap.has(k)) devisSectionsMap.set(k, [])
    devisSectionsMap.get(k)!.push(l)
  })

  return (
    <Document>
      {/* ============ RAPPORT (flow sur plusieurs pages) ============ */}
      <Page size="A4" style={s.page}>
        <Header refNum={ref} phone={phone} />

        <View style={s.content}>
          {/* Client + métadonnées (style facture) */}
          <View style={s.infoRow} wrap={false}>
            <View style={s.billTo}>
              <Text style={s.sectionLabel}>Client</Text>
              <Text style={s.clientName}>{clientNom || '—'}</Text>
              {chantierLine ? (
                <>
                  <Text style={s.clientLabel}>Adresse du chantier</Text>
                  <Text style={s.clientLine}>{chantierLine}</Text>
                </>
              ) : null}
            </View>
            <View style={s.metaBox}>
              <View style={s.metaRow}>
                <Text style={s.metaK}>Date</Text>
                <Text style={s.metaV}>{fmtDateFR(dateIntervention)}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaK}>Référence</Text>
                <Text style={s.metaV}>{ref}</Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.metaK}>Intervention</Text>
                <Text style={s.metaV}>{typeIntervention || '—'}</Text>
              </View>
              <View style={[s.metaRow, s.metaRowLast]}>
                <Text style={s.metaK}>Technicien</Text>
                <View style={s.metaTechRow}>
                  {technicienPhotoUrl ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image style={s.techPhoto} src={technicienPhotoUrl} />
                  ) : null}
                  <Text style={[s.metaV, { maxWidth: '100%', textAlign: 'right' }]}>{technicienNom || '—'}</Text>
                </View>
              </View>
            </View>
          </View>

          {rapport.objet ? (
            <Text style={s.objet}>
              <Text style={s.objetLabel}>Objet : </Text>
              {rapport.objet}
            </Text>
          ) : null}

          {/* Section — CONTEXTE */}
          {hasContexte && (
            <SectionCard num={numOf('contexte')} title="Contexte de l'intervention">
              <Text style={s.cardText}>{rapport.contexte}</Text>

              {showCritical && (
                <View style={[s.callout, { marginTop: 8 }]} wrap={false}>
                  <View style={s.calloutHead}>
                    <Text style={s.calloutHeadTxt}>
                      Élément essentiel — {rapport.avis_technique?.titre || 'Point de vigilance'}
                    </Text>
                  </View>
                  <View style={s.calloutBody}>
                    {rapport.avis_technique?.intro && (
                      <Text style={s.calloutText}>{rapport.avis_technique.intro}</Text>
                    )}
                    {(rapport.avis_technique?.points_majeurs || []).map((pt, i) => (
                      <Text key={i} style={s.calloutText}>• {pt}</Text>
                    ))}
                  </View>
                </View>
              )}
            </SectionCard>
          )}

          {/* Section — MÉTHODOLOGIE */}
          {hasMethodo && (
            <SectionCard num={numOf('methodo')} title="Méthodologie d'investigation">
              {methoSteps.map((step, i) => (
                <View key={i} style={s.methStep} wrap={false}>
                  <Text style={s.methNum}>{i + 1}</Text>
                  <Text style={s.methText}>{step}</Text>
                </View>
              ))}
            </SectionCard>
          )}

          {/* Section — ANOMALIES */}
          {hasAnomalies && (
            <SectionCard num={numOf('anomalies')} title="Anomalies constatées" accent="orange">
              {rapport.analyse_table!.map((row, i) => {
                const st = statutLabel(row.statut)
                return (
                  <View key={i} style={s.anomaly} wrap={false}>
                    <View style={[s.anomalyBar, { backgroundColor: st.barColor }]} />
                    <View style={s.anomalyBody}>
                      <View style={s.anomalyHead}>
                        <Text style={s.anomalyTag}>#{i + 1}</Text>
                        <Text style={s.anomalyTitle}>{row.probleme}</Text>
                        <Text style={[s.anomalyBadge, { backgroundColor: st.bg }]}>{st.text}</Text>
                      </View>
                      <Text style={s.anomalyDesc}>
                        {row.localisation ? <Text>{row.localisation} — </Text> : null}
                        {row.description}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </SectionCard>
          )}

          {/* Section — PHOTOS */}
          {hasPhotos && (
            <SectionCard num={numOf('photos')} title="Documents photographiques">
              <Text style={s.photosIntro}>
                Clichés pris lors de l&apos;intervention, annexés au présent rapport à titre de constat :
              </Text>
              <View style={s.photosGrid}>
                {photos!.map((p, i) => (
                  <View key={i} style={s.photoCell} wrap={false}>
                    <View style={s.photoCard}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image src={p.url} style={s.photoImg} />
                      <Text style={s.photoCap}>
                        Photo nº {i + 1}{p.legende ? ` — ${p.legende}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {/* Section — PRESCRIPTIONS */}
          {hasPrecos && (
            <SectionCard num={numOf('precos')} title="Prescriptions & travaux à engager" accent="teal">
              {(rapport.preconisations?.length ?? 0) > 0 ? (
                rapport.preconisations!.map((p, idx) => {
                  const kind = idx % 3 === 0 ? 'red' : idx % 3 === 1 ? 'blue' : 'teal'
                  const bandStyle = kind === 'red' ? s.subBandRed : kind === 'blue' ? s.subBandBlue : s.subBandTeal
                  const sqStyle = kind === 'red' ? s.sqRed : kind === 'blue' ? s.sqBlue : s.sqTeal
                  return (
                    <View key={idx} style={{ marginBottom: 8 }} wrap={false}>
                      <View style={[s.subBand, bandStyle]} wrap={false}>
                        <Text style={s.subBandTxt}>
                          {`${numOf('precos')}.${idx + 1}`}  {p.titre || p.tag}
                        </Text>
                      </View>
                      {(Array.isArray(p.items) ? p.items : []).map((it, j) => (
                        <View key={j} style={s.precoItem}>
                          <View style={[s.precoSquare, sqStyle]} />
                          <Text style={s.precoTxt}>
                            {it?.k ? <Text style={{ fontFamily: 'Helvetica-Bold' }}>{it.k} : </Text> : null}
                            {it?.v}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )
                })
              ) : (
                <Text style={s.cardText}>{rapport.recommandations}</Text>
              )}
            </SectionCard>
          )}

          {/* Section — Garantie */}
          {hasGarantie && garantie && (
            <SectionCard
              num={numOf('garantie')}
              title="Garantie d'intervention"
              accent={garantie.est_garanti ? 'green' : 'red'}
            >
              <View
                style={[
                  s.garantieBlock,
                  garantie.est_garanti
                    ? { borderColor: C.greenBorder, backgroundColor: C.tealSoft }
                    : { borderColor: C.red, backgroundColor: C.redSoft },
                ]}
                wrap={false}
              >
                <Text
                  style={[
                    s.garantieTitle,
                    { color: garantie.est_garanti ? C.teal : C.red },
                  ]}
                >
                  {garantie.est_garanti ? 'Intervention garantie' : 'Intervention non garantie'}
                </Text>
                {garantie.commentaire ? (
                  <Text style={s.garantieText}>{garantie.commentaire}</Text>
                ) : (
                  <Text style={s.garantieText}>
                    {garantie.est_garanti
                      ? 'Les travaux réalisés font l\'objet d\'une garantie selon nos conditions générales.'
                      : 'Les travaux réalisés ne sont pas couverts par une garantie spécifique au-delà des dispositions légales applicables.'}
                  </Text>
                )}
              </View>
            </SectionCard>
          )}

          {/* Section — CONCLUSION */}
          {hasConclusion && (
            <SectionCard num={numOf('conclusion')} title="Conclusion">
              {rapport.avis_technique?.diagnostic_final && (
                <Text style={s.cardText}>{rapport.avis_technique.diagnostic_final}</Text>
              )}
              {rapport.avis_technique?.recommandation_urgente && (
                <Text style={[s.cardText, { marginTop: 6 }]}>{rapport.avis_technique.recommandation_urgente}</Text>
              )}
              {!rapport.avis_technique?.diagnostic_final && rapport.diagnostic && (
                <Text style={s.cardText}>{rapport.diagnostic}</Text>
              )}
              {rapport.commentaire_technicien && (
                <Text style={[s.cardText, { marginTop: 6 }]}>{rapport.commentaire_technicien}</Text>
              )}
            </SectionCard>
          )}

          <View wrap={false} style={{ marginTop: 14, marginBottom: 6 }}>
            <RapportSignatures
              technicienNom={technicienNom}
              clientNom={clientNom}
              dateIntervention={dateIntervention}
              signatureLtdbUrl={ltdbSigUrl}
              signatureClientUrl={signatureClientUrl}
              signatureClientDate={signatureClientDate}
            />
          </View>
        </View>

        <Footer phone={phone} />
      </Page>

      {/* ============ DEVIS (page dédiée si présent) ============ */}
      {rapport.devis && (
        <Page size="A4" style={s.page}>
          <Header
            title="DEVIS"
            refNum={rapport.devis.numero || `DV-${ref}`}
            phone={phone}
          />

          <View style={s.content}>
            <View style={s.infoRow} wrap={false}>
              <View style={s.billTo}>
                <Text style={s.sectionLabel}>Client</Text>
                <Text style={s.clientName}>{clientNom || '—'}</Text>
                <Text style={s.clientLine}>{chantierLine}</Text>
              </View>
              <View style={s.metaBox}>
                <View style={s.metaRow}>
                  <Text style={s.metaK}>Émis le</Text>
                  <Text style={s.metaV}>{fmtDateFR(dateIntervention)}</Text>
                </View>
                <View style={s.metaRow}>
                  <Text style={s.metaK}>Validité</Text>
                  <Text style={s.metaV}>{rapport.devis.validite_jours || 30} jours</Text>
                </View>
                <View style={[s.metaRow, s.metaRowLast]}>
                  <Text style={s.metaK}>Réf. intervention</Text>
                  <Text style={s.metaV}>{ref}</Text>
                </View>
              </View>
            </View>

            <View style={s.itemsHead} wrap={false}>
              <Text style={[s.itemsHeadCell, { width: '52%' }]}>Désignation</Text>
              <Text style={[s.itemsHeadCell, { width: '12%', textAlign: 'right' }]}>Qté</Text>
              <Text style={[s.itemsHeadCell, { width: '18%', textAlign: 'right' }]}>PU HT</Text>
              <Text style={[s.itemsHeadCell, { width: '18%', textAlign: 'right' }]}>Total HT</Text>
            </View>

            {Array.from(devisSectionsMap.entries()).map(([sec, items], si) => (
              <View key={si}>
                <View style={s.devisSectionRow} wrap={false}>
                  <Text style={s.devisSectionTxt}>{sec}</Text>
                </View>
                {items.map((l, li) => (
                  <View key={li} style={s.itemsRow} wrap={false}>
                    <View style={s.cDesig}>
                      <Text style={s.cDesigName}>{l.designation}</Text>
                      {l.description ? <Text style={s.cDesigDesc}>{l.description}</Text> : null}
                    </View>
                    <Text style={s.cQte}>{l.qte}</Text>
                    <Text style={s.cPu}>{fmtEur(l.pu_ht)}</Text>
                    <Text style={s.cTot}>{fmtEur(l.pu_ht * l.qte)}</Text>
                  </View>
                ))}
              </View>
            ))}

            <View style={s.totalsMini} wrap={false}>
              <View style={s.totalsMiniRow}>
                <Text style={s.totalsMiniLbl}>Total HT</Text>
                <Text style={s.totalsMiniVal}>{fmtEur(totalHT)}</Text>
              </View>
              <View style={s.totalsMiniRow}>
                <Text style={s.totalsMiniLbl}>TVA {tvaTaux} %</Text>
                <Text style={s.totalsMiniVal}>{fmtEur(tva)}</Text>
              </View>
            </View>
            <View style={s.totalBar} wrap={false}>
              <Text style={s.totalBarLbl}>TOTAL TTC</Text>
              <Text style={s.totalBarVal}>{fmtEur(totalTTC)}</Text>
            </View>

            {rapport.devis.conditions && rapport.devis.conditions.length > 0 && (
              <View style={s.conditions} wrap={false}>
                <Text style={s.conditionsTitle}>Conditions</Text>
                {rapport.devis.conditions.map((c, i) => (
                  <Text key={i} style={s.conditionsItem}>• {c}</Text>
                ))}
              </View>
            )}

            <View wrap={false} style={{ marginTop: 14, marginBottom: 6 }}>
              <RapportSignatures
                technicienNom={technicienNom}
                clientNom={clientNom}
                dateIntervention={dateIntervention}
                signatureLtdbUrl={ltdbSigUrl}
                signatureClientUrl={signatureClientUrl}
                signatureClientDate={signatureClientDate}
                clientHead="Bon pour accord — Client"
              />
            </View>
          </View>

          <Footer phone={phone} />
        </Page>
      )}
    </Document>
  )
}


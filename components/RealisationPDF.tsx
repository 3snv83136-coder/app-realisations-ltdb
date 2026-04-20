'use client'
import { Document, Page, Text, View, Image, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer"

/* ============ CHARTE LTDB ============ */
const C = {
  navy: '#0e2a52',
  blue: '#1a4a8a',
  blueMid: '#2563eb',
  blueLight: '#e8f0fe',
  orange: '#f59e0b',
  orangeLight: '#fffbeb',
  critical: '#dc2626',
  criticalBg: '#fef2f2',
  warn: '#ea580c',
  warnBg: '#fff7ed',
  info: '#2563eb',
  infoBg: '#eff6ff',
  ok: '#16a34a',
  okBg: '#f0fdf4',
  neutral: '#6b7280',
  neutralBg: '#f3f4f6',
  text: '#1e293b',
  muted: '#64748b',
  border: '#cbd5e1',
  bgSoft: '#f1f5f9',
  white: '#ffffff',
}

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingTop: 90,
    paddingBottom: 60,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.white,
    position: 'relative',
  },
  topbar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 6, backgroundColor: C.navy,
  },
  topbarOrange: {
    position: 'absolute', top: 0, right: 0,
    height: 6, width: '30%', backgroundColor: C.blueMid,
  },
  headerBand: {
    position: 'absolute', top: 6, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 40, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.white,
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: {
    width: 42, height: 42, backgroundColor: C.navy, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  logoText: { color: C.white, fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  brandName: { fontSize: 10, color: C.navy, fontFamily: 'Helvetica-Bold' },
  brandTag: { fontSize: 7, color: C.muted, marginTop: 2 },
  refBlock: { textAlign: 'right' },
  refLabel: { fontSize: 7, color: C.muted },
  refNum: { fontSize: 9, color: C.navy, fontFamily: 'Helvetica-Bold', marginVertical: 1 },

  content: { paddingHorizontal: 40 },

  /* Filigrane */
  watermark: {
    position: 'absolute', top: 320, left: 0, right: 0,
    textAlign: 'center', fontSize: 110,
    color: '#0e2a520a', fontFamily: 'Helvetica-Bold',
    letterSpacing: 8, transform: 'rotate(-30deg)',
  },

  /* Cover */
  cover: { paddingTop: 30, alignItems: 'center' },
  eyebrow: {
    backgroundColor: C.blueMid, color: C.white,
    paddingVertical: 5, paddingHorizontal: 16,
    fontSize: 8, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5, borderRadius: 12, marginBottom: 16,
  },
  coverTitle: {
    fontSize: 26, color: C.navy, fontFamily: 'Helvetica-Bold',
    textAlign: 'center', marginBottom: 6,
  },
  coverSubtitle: { fontSize: 11, color: C.muted, marginBottom: 24 },
  coverDivider: { width: 60, height: 3, backgroundColor: C.blueMid, marginBottom: 24 },

  /* Stats */
  stats: { flexDirection: 'row', marginVertical: 20, gap: 10 },
  stat: {
    flex: 1, borderWidth: 1, borderColor: C.border,
    borderTopWidth: 4, borderTopColor: C.blueMid,
    borderRadius: 6, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  statCritical: { borderTopColor: C.critical },
  statWarn: { borderTopColor: C.warn },
  statOk: { borderTopColor: C.ok },
  statNum: { fontSize: 22, color: C.navy, fontFamily: 'Helvetica-Bold' },
  statNumCritical: { color: C.critical },
  statNumWarn: { color: C.warn },
  statNumOk: { color: C.ok },
  statLbl: { fontSize: 7, color: C.muted, marginTop: 4, textTransform: 'uppercase' },

  /* Cover card */
  coverCard: {
    backgroundColor: C.blueLight, borderLeftWidth: 5, borderLeftColor: C.blueMid,
    padding: 20, borderRadius: 6, marginTop: 14,
  },
  coverCardTitle: {
    fontSize: 8, color: C.navy, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1, marginBottom: 12,
  },
  coverGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  coverItem: { width: '50%', marginBottom: 10, paddingRight: 10 },
  coverK: { fontSize: 7, color: C.muted, letterSpacing: 0.4, marginBottom: 2 },
  coverV: { fontSize: 10, color: C.text, fontFamily: 'Helvetica-Bold' },

  /* Sections */
  sectionWrap: { marginTop: 24 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: C.blueMid,
    paddingBottom: 8, marginBottom: 6,
  },
  sectionNum: {
    width: 24, height: 24, backgroundColor: C.blueMid, color: C.white,
    fontSize: 12, fontFamily: 'Helvetica-Bold',
    textAlign: 'center', borderRadius: 5, marginRight: 10, paddingTop: 5,
  },
  sectionTitle: {
    fontSize: 13, color: C.navy, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  sectionAccent: { width: 50, height: 3, backgroundColor: C.blueMid },

  /* Infobox */
  infobox: {
    backgroundColor: C.blueLight, borderLeftWidth: 4, borderLeftColor: C.blueMid,
    padding: 14, marginTop: 10, borderRadius: 4, fontSize: 9.5, lineHeight: 1.5,
  },
  infoboxTtl: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },

  /* Phase */
  phase: {
    borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 5, borderLeftColor: C.blueMid,
    backgroundColor: '#f8fafc', padding: 16, marginTop: 12, borderRadius: 6,
  },
  phaseSuccess: { borderLeftColor: C.ok },
  phaseFailed: { borderLeftColor: C.warn },
  phaseHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  phaseNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: C.blueMid,
    color: C.white, textAlign: 'center', fontSize: 11,
    fontFamily: 'Helvetica-Bold', paddingTop: 6, marginRight: 10,
  },
  phaseNumOk: { backgroundColor: C.ok },
  phaseNumWarn: { backgroundColor: C.warn },
  phaseTitle: { fontSize: 11, color: C.navy, fontFamily: 'Helvetica-Bold', flex: 1 },
  phaseTitleOk: { color: C.ok },
  phaseTitleWarn: { color: C.warn },
  phaseItem: { marginBottom: 6, paddingLeft: 10 },
  phaseK: { color: C.navy, fontFamily: 'Helvetica-Bold' },

  /* Avis */
  avis: {
    backgroundColor: C.criticalBg, borderLeftWidth: 5, borderLeftColor: C.critical,
    padding: 16, marginTop: 14, borderRadius: 3,
  },
  avisTag: {
    alignSelf: 'flex-start', backgroundColor: C.critical, color: C.white,
    fontSize: 8, fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3, marginBottom: 8,
  },
  avisTitle: {
    color: C.critical, fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 8,
  },
  avisP: { marginVertical: 5 },
  avisBullet: { marginVertical: 3, paddingLeft: 12 },

  /* Préconisations */
  preco: {
    backgroundColor: C.orangeLight, borderLeftWidth: 5, borderLeftColor: C.orange,
    padding: 16, marginTop: 12, borderRadius: 3,
  },
  precoTag: {
    alignSelf: 'flex-start', backgroundColor: C.orange, color: C.white,
    fontSize: 8, fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3, marginBottom: 8,
  },
  precoTitle: { color: '#a04e09', fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  precoItem: { marginVertical: 4, paddingLeft: 14 },
  precoK: { color: '#7d3c00', fontFamily: 'Helvetica-Bold' },

  /* Tableau */
  table: {
    marginTop: 12, borderWidth: 1, borderColor: C.border, borderRadius: 6, overflow: 'hidden',
  },
  tableHeader: { flexDirection: 'row', backgroundColor: C.navy },
  tableHeaderCell: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8,
    padding: 10, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border,
  },
  tableRowAlt: { backgroundColor: C.blueLight },
  tableCell: { padding: 10, fontSize: 8.5 },
  tableCellFirst: { color: C.navy, fontFamily: 'Helvetica-Bold' },

  /* Badge */
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 2, paddingHorizontal: 6,
    borderRadius: 8, fontSize: 7, fontFamily: 'Helvetica-Bold',
    borderWidth: 1,
  },
  badgeCritical: { color: C.critical, backgroundColor: C.criticalBg, borderColor: '#f5b7b1' },
  badgeWarn: { color: C.warn, backgroundColor: C.warnBg, borderColor: '#f5cba7' },
  badgeInfo: { color: C.info, backgroundColor: C.infoBg, borderColor: '#aed6f1' },
  badgeOk: { color: C.ok, backgroundColor: C.okBg, borderColor: '#abebc6' },
  badgeNeutral: { color: C.neutral, backgroundColor: C.neutralBg, borderColor: '#d5d8dc' },

  /* Légende */
  legend: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 10,
    padding: 10, backgroundColor: C.bgSoft, borderRadius: 3, fontSize: 7,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },

  /* Signature */
  endBlock: {
    marginTop: 24, padding: 20, backgroundColor: C.blueLight,
    borderRadius: 6, borderWidth: 1, borderColor: C.border,
    alignItems: 'center',
  },
  endStrong: {
    fontSize: 12, color: C.navy, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  endGen: { fontSize: 8, color: C.muted, marginTop: 4, fontStyle: 'italic' },
  signatureRow: {
    flexDirection: 'row', marginTop: 18, width: '100%', gap: 16,
  },
  sigBlock: { flex: 1, borderTopWidth: 2, borderTopColor: C.blueMid, paddingTop: 8 },
  sigRole: { fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  sigName: { fontFamily: 'Helvetica-Bold', color: C.navy, fontSize: 10, marginTop: 2 },
  sigQual: { color: C.blueMid, fontSize: 8, fontFamily: 'Helvetica-BoldOblique', marginTop: 2 },
  sigScript: { fontSize: 16, color: C.navy, fontFamily: 'Helvetica-Oblique', marginTop: 8 },
  sigLine: {
    marginTop: 14, borderTopWidth: 0.5, borderTopColor: C.border,
    paddingTop: 4, fontSize: 7, color: C.muted, fontStyle: 'italic', textAlign: 'center',
  },

  /* Footer */
  pageFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 40, paddingVertical: 10,
    backgroundColor: C.bgSoft, borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 7, color: C.muted,
  },
  pageNum: {
    backgroundColor: C.navy, color: C.white,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    fontFamily: 'Helvetica-Bold',
  },

  /* ===== DEVIS ===== */
  devisHeader: {
    backgroundColor: C.navy, padding: 20, borderRadius: 4,
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4,
  },
  devisHeaderTitle: { color: C.white, fontSize: 18, fontFamily: 'Helvetica-Bold' },
  devisHeaderSub: { color: '#93c5fd', fontSize: 9, marginTop: 4 },
  devisHeaderRight: { alignItems: 'flex-end' },
  devisHeaderLbl: { color: '#93c5fd', fontSize: 7, textTransform: 'uppercase' },
  devisHeaderV: { color: C.white, fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 4 },

  devisMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  devisMetaItem: {
    width: '50%', backgroundColor: C.blueLight,
    borderLeftWidth: 3, borderLeftColor: C.blueMid,
    padding: 10, marginBottom: 8,
  },

  devisTable: {
    marginTop: 14, borderWidth: 1, borderColor: C.border, borderRadius: 4,
  },
  devisHead: { flexDirection: 'row', backgroundColor: C.navy },
  devisHeadCell: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8,
    padding: 8, textTransform: 'uppercase',
  },
  devisSectionRow: { backgroundColor: C.blueLight, padding: 6 },
  devisSectionTxt: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8,
    textTransform: 'uppercase',
  },
  devisLine: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, padding: 8,
  },
  devisDesignation: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  devisDescription: { color: C.muted, fontSize: 8, marginTop: 2 },

  totaux: { marginTop: 14, marginLeft: 'auto', width: '55%' },
  totauxRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bgSoft,
  },
  totauxRowTtc: { backgroundColor: C.navy },
  totauxLbl: { color: C.muted, fontSize: 9 },
  totauxV: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  totauxLblTtc: { color: '#93c5fd', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  totauxVTtc: { color: C.white, fontSize: 12, fontFamily: 'Helvetica-Bold' },

  conditions: {
    marginTop: 16, backgroundColor: C.orangeLight,
    borderLeftWidth: 4, borderLeftColor: C.orange,
    padding: 12, borderRadius: 3,
  },
  conditionsTitle: {
    color: '#a04e09', fontSize: 9, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', marginBottom: 6,
  },
  conditionsItem: { marginVertical: 2, paddingLeft: 8, fontSize: 8 },

  /* Photos */
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 10 },
  photoCard: {
    width: '47%', borderWidth: 1, borderColor: C.border,
    borderRadius: 4, overflow: 'hidden', marginBottom: 10, backgroundColor: C.white,
  },
  photoImg: { width: '100%', height: 130, objectFit: 'cover' },
  photoCap: { padding: 6, fontSize: 7, color: C.muted, fontStyle: 'italic', textAlign: 'center' },
  photoBadge: {
    position: 'absolute', top: 6, left: 6, backgroundColor: C.navy, color: C.white,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    fontSize: 7, fontFamily: 'Helvetica-Bold',
  },
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
}

export interface PDFProps {
  clientNom: string
  adresse: string
  ville: string
  codePostal: string
  dateIntervention: string
  typeIntervention: string
  technicienNom: string
  rapport: RapportData
  phone?: string
  reference?: string
  photos?: { url: string; legende?: string }[]
}

/* ============ HELPERS ============ */
const badgeStyle = (statut: Statut) => {
  switch (statut) {
    case 'critical': return s.badgeCritical
    case 'warn': return s.badgeWarn
    case 'info': return s.badgeInfo
    case 'ok': return s.badgeOk
    default: return s.badgeNeutral
  }
}
const phaseColor = (statut?: Statut) => {
  if (statut === 'ok') return { wrap: s.phaseSuccess, num: s.phaseNumOk, title: s.phaseTitleOk }
  if (statut === 'warn' || statut === 'critical') return { wrap: s.phaseFailed, num: s.phaseNumWarn, title: s.phaseTitleWarn }
  return { wrap: {}, num: {}, title: {} }
}
const fmtEur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, ' ') + ' €'

const Header = ({ reference, dateIntervention, ville }: { reference: string; dateIntervention: string; ville: string }) => (
  <>
    <View style={s.topbar} fixed />
    <View style={s.topbarOrange} fixed />
    <View style={s.headerBand} fixed>
      <View style={s.brand}>
        <View style={s.logo}><Text style={s.logoText}>LTDB</Text></View>
        <View>
          <Text style={s.brandName}>LTDB — LES TECHNICIENS DU DÉBOUCHAGE</Text>
          <Text style={s.brandTag}>Débouchage · Curage · Inspection caméra · Assainissement</Text>
        </View>
      </View>
      <View style={s.refBlock}>
        <Text style={s.refLabel}>RAPPORT D&apos;INTERVENTION</Text>
        <Text style={s.refNum}>{reference}</Text>
        <Text style={s.refLabel}>{dateIntervention} · {ville}</Text>
      </View>
    </View>
  </>
)

const Footer = ({ num, total }: { num: number; total: number }) => (
  <View style={s.pageFooter} fixed>
    <Text>LTDB · Les Techniciens du Débouchage · Assainissement</Text>
    <Text>Rapport rédigé à titre probatoire</Text>
    <Text style={s.pageNum}>{num} / {total}</Text>
  </View>
)

const Section = ({ num, title }: { num: number | string; title: string }) => (
  <View style={s.sectionRow}>
    <Text style={s.sectionNum}>{num}</Text>
    <Text style={s.sectionTitle}>{title}</Text>
  </View>
)

/* ============ DOCUMENT ============ */
export function RealisationDocument({ clientNom, adresse, ville, codePostal, dateIntervention, typeIntervention, technicienNom, rapport, reference, photos }: PDFProps) {
  const ref = reference || `LTDB-${dateIntervention.replace(/-/g, '')}`
  const hasPhotos = (photos?.length ?? 0) > 0
  const totalPages = 3 + (hasPhotos ? 1 : 0) + (rapport.devis ? 1 : 0)

  const counts = (rapport.analyse_table || []).reduce((acc, r) => {
    acc[r.statut] = (acc[r.statut] || 0) + 1
    return acc
  }, {} as Record<Statut, number>)

  const lignes = rapport.devis?.lignes || []
  const totalHT = lignes.reduce((sum, l) => sum + l.pu_ht * l.qte, 0)
  const tvaTaux = rapport.devis?.tva_taux ?? 10
  const tva = totalHT * tvaTaux / 100
  const totalTTC = totalHT + tva
  // Group by section
  const sections = new Map<string, DevisLine[]>()
  lignes.forEach(l => {
    const k = l.section || 'Prestations'
    if (!sections.has(k)) sections.set(k, [])
    sections.get(k)!.push(l)
  })

  return (
    <Document>
      {/* ============ PAGE 1 — COUVERTURE ============ */}
      <Page size="A4" style={s.page}>
        <Header reference={ref} dateIntervention={dateIntervention} ville={ville} />
        <Text style={s.watermark} fixed>RAPPORT</Text>

        <View style={s.content}>
          <View style={s.cover}>
            <Text style={s.eyebrow}>RAPPORT D'INTERVENTION</Text>
            <Text style={s.coverTitle}>Débouchage & diagnostic approfondi</Text>
            <Text style={s.coverTitle}>du réseau d'évacuation</Text>
            <Text style={s.coverSubtitle}>{rapport.objet || `${typeIntervention} — ${ville}`}</Text>
            <View style={s.coverDivider} />
          </View>

          <View style={s.stats}>
            <View style={[s.stat, s.statCritical]}>
              <Text style={[s.statNum, s.statNumCritical]}>{counts.critical || 0}</Text>
              <Text style={s.statLbl}>Anomalies critiques</Text>
            </View>
            <View style={[s.stat, s.statWarn]}>
              <Text style={[s.statNum, s.statNumWarn]}>{counts.warn || 0}</Text>
              <Text style={s.statLbl}>Non-conformités</Text>
            </View>
            <View style={[s.stat, s.statOk]}>
              <Text style={[s.statNum, s.statNumOk]}>{counts.ok || 0}</Text>
              <Text style={s.statLbl}>Conformes</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statNum}>{(rapport.phases || []).length}</Text>
              <Text style={s.statLbl}>Investigations</Text>
            </View>
          </View>

          <View style={s.coverCard}>
            <Text style={s.coverCardTitle}>▸ INFORMATIONS DOSSIER</Text>
            <View style={s.coverGrid}>
              <View style={s.coverItem}><Text style={s.coverK}>CLIENT</Text><Text style={s.coverV}>{clientNom || '—'}</Text></View>
              <View style={s.coverItem}><Text style={s.coverK}>NATURE INITIALE</Text><Text style={s.coverV}>{typeIntervention}</Text></View>
              <View style={s.coverItem}><Text style={s.coverK}>ADRESSE</Text><Text style={s.coverV}>{adresse}{'\n'}{codePostal} {ville}</Text></View>
              <View style={s.coverItem}><Text style={s.coverK}>DATE D'INTERVENTION</Text><Text style={s.coverV}>{dateIntervention}</Text></View>
              <View style={s.coverItem}><Text style={s.coverK}>TECHNICIEN INTERVENANT</Text><Text style={s.coverV}>{technicienNom}</Text></View>
              <View style={s.coverItem}><Text style={s.coverK}>NATURE FINALE</Text><Text style={s.coverV}>{rapport.objet || `${typeIntervention} ${ville}`}</Text></View>
            </View>
          </View>
        </View>

        <Footer num={1} total={totalPages} />
      </Page>

      {/* ============ PAGE 2 — LOCALISATION + OPÉRATIONS ============ */}
      <Page size="A4" style={s.page}>
        <Header reference={ref} dateIntervention={dateIntervention} ville={ville} />
        <Text style={s.watermark} fixed>CONSTATS</Text>

        <View style={s.content}>
          {rapport.contexte && (
            <View style={s.sectionWrap}>
              <Section num="1" title="CONTEXTE DE L'INTERVENTION" />
              <View style={s.infobox}>
                <Text>{rapport.contexte}</Text>
              </View>
            </View>
          )}

          <View style={s.sectionWrap}>
              <Section num={rapport.contexte ? "2" : "1"} title="MÉTHODOLOGIE D'INVESTIGATION" />
            {rapport.localisation?.zone && (
              <View style={s.infobox}>
                <Text><Text style={s.infoboxTtl}>Zone d'intervention : </Text>{rapport.localisation.zone}</Text>
              </View>
            )}
            {rapport.localisation?.configuration && (
              <View style={s.infobox}>
                <Text><Text style={s.infoboxTtl}>Configuration technique : </Text>{rapport.localisation.configuration}</Text>
              </View>
            )}
            {rapport.conditions_intervention && (
              <View style={s.infobox}>
                <Text><Text style={s.infoboxTtl}>Conditions d'intervention : </Text>{rapport.conditions_intervention}</Text>
              </View>
            )}
            {rapport.duree_intervention && (
              <View style={s.infobox}>
                <Text><Text style={s.infoboxTtl}>Durée : </Text>{rapport.duree_intervention}</Text>
              </View>
            )}
          </View>

          {rapport.diagnostic && (
            <View style={s.sectionWrap}>
              <Section num={rapport.contexte ? "3" : "2"} title="ANOMALIES CONSTATÉES" />
              <View style={s.infobox}>
                <Text>{rapport.diagnostic}</Text>
              </View>
            </View>
          )}

          {rapport.travaux_realises && (
            <View style={s.sectionWrap}>
              <Section num={rapport.contexte ? "4" : "3"} title="CONSTATS ET OPÉRATIONS RÉALISÉES" />
              <View style={s.infobox}>
                <Text>{rapport.travaux_realises}</Text>
              </View>
              {(rapport.materiel_utilise?.length ?? 0) > 0 && (
                <View style={s.infobox}>
                  <Text style={s.infoboxTtl}>Matériel utilisé :</Text>
                  {rapport.materiel_utilise!.map((m, i) => (
                    <Text key={i}>• {m}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {rapport.recommandations && (
            <View style={s.sectionWrap}>
              <Section num={rapport.contexte ? "5" : "4"} title="PRESCRIPTIONS & TRAVAUX À ENGAGER" />
              <View style={s.infobox}>
                <Text>{rapport.recommandations}</Text>
              </View>
            </View>
          )}

          {(rapport.phases?.length ?? 0) > 0 && (
            <View style={s.sectionWrap}>
              <Section num={rapport.contexte ? "6" : "5"} title="MÉTHODOLOGIE D'INVESTIGATION" />
              {rapport.phases!.map((p, i) => {
                const c = phaseColor(p.statut)
                return (
                  <View key={i} style={[s.phase, c.wrap]}>
                    <View style={s.phaseHead}>
                      <Text style={[s.phaseNum, c.num]}>{i + 1}</Text>
                      <Text style={[s.phaseTitle, c.title]}>{p.titre}</Text>
                    </View>
                    <View style={s.phaseItem}><Text><Text style={s.phaseK}>Contexte : </Text>{p.contexte}</Text></View>
                    <View style={s.phaseItem}><Text><Text style={s.phaseK}>Action : </Text>{p.action}</Text></View>
                    <View style={s.phaseItem}><Text><Text style={s.phaseK}>Résultat : </Text>{p.resultat}</Text></View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        <Footer num={2} total={totalPages} />
      </Page>

      {/* ============ PAGE 3 — AVIS + ANALYSE + PRÉCONISATIONS + SIGNATURE ============ */}
      <Page size="A4" style={s.page}>
        <Header reference={ref} dateIntervention={dateIntervention} ville={ville} />
        <Text style={s.watermark} fixed>SYNTHÈSE</Text>

        <View style={s.content}>
          {rapport.avis_technique && (
            <View style={s.sectionWrap}>
              <Section num="6" title="SYNTHÈSE ET AVIS TECHNIQUE" />
              <View style={s.avis}>
                <Text style={s.avisTag}>⚠ AVIS CRITIQUE</Text>
                <Text style={s.avisTitle}>{rapport.avis_technique.titre}</Text>
                <Text style={s.avisP}>{rapport.avis_technique.intro}</Text>
                {rapport.avis_technique.points_majeurs.map((pt, i) => (
                  <Text key={i} style={s.avisBullet}>• {pt}</Text>
                ))}
                <Text style={s.avisP}><Text style={s.infoboxTtl}>Diagnostic final : </Text>{rapport.avis_technique.diagnostic_final}</Text>
                <Text style={s.avisP}><Text style={s.infoboxTtl}>Recommandation urgente : </Text>{rapport.avis_technique.recommandation_urgente}</Text>
              </View>
            </View>
          )}

          {(rapport.analyse_table?.length ?? 0) > 0 && (
            <View style={s.sectionWrap}>
              <Section num="7" title="ANALYSE DÉTAILLÉE" />
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderCell, { width: '25%' }]}>Problème</Text>
                  <Text style={[s.tableHeaderCell, { width: '22%' }]}>Localisation</Text>
                  <Text style={[s.tableHeaderCell, { width: '33%' }]}>Description</Text>
                  <Text style={[s.tableHeaderCell, { width: '20%' }]}>Diagnostic</Text>
                </View>
                {rapport.analyse_table!.map((row, i) => (
                  <View key={i} style={[s.tableRow, i % 2 ? s.tableRowAlt : {}]}>
                    <Text style={[s.tableCell, s.tableCellFirst, { width: '25%' }]}>{row.probleme}</Text>
                    <Text style={[s.tableCell, { width: '22%' }]}>{row.localisation}</Text>
                    <Text style={[s.tableCell, { width: '33%' }]}>{row.description}</Text>
                    <View style={[s.tableCell, { width: '20%' }]}>
                      <Text style={[s.badge, badgeStyle(row.statut)]}>{row.label}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={s.legend}>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.critical }]} /><Text>Critique</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.warn }]} /><Text>Attention</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.info }]} /><Text>À prévoir</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.ok }]} /><Text>Conforme</Text></View>
                <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: C.neutral }]} /><Text>N/A</Text></View>
              </View>
            </View>
          )}

          {(rapport.preconisations?.length ?? 0) > 0 && (
            <View style={s.sectionWrap}>
              <Section num="8" title="PRÉCONISATIONS DE TRAVAUX" />
              {rapport.preconisations!.map((p, i) => (
                <View key={i} style={s.preco}>
                  <Text style={s.precoTag}>{p.tag}</Text>
                  <Text style={s.precoTitle}>{p.titre}</Text>
                  {p.items.map((it, j) => (
                    <Text key={j} style={s.precoItem}>{j + 1}. <Text style={s.precoK}>{it.k} : </Text>{it.v}</Text>
                  ))}
                </View>
              ))}
            </View>
          )}

          <View style={s.endBlock}>
            <Text style={s.endStrong}>CONCLUSION</Text>
            <Text style={s.endGen}>Rapport d'intervention du {dateIntervention} — document technique probatoire</Text>
            <View style={s.signatureRow}>
              <View style={s.sigBlock}>
                <Text style={s.sigRole}>TECHNICIEN INTERVENANT</Text>
                <Text style={s.sigName}>{technicienNom}</Text>
                <Text style={s.sigQual}>Lu et validé</Text>
                <Text style={s.sigScript}>{technicienNom}</Text>
                <Text style={s.sigLine}>Signature et cachet</Text>
              </View>
              <View style={s.sigBlock}>
                  <Text style={s.sigRole}>CLIENT — LU ET APPROUVÉ</Text>
                <Text style={s.sigName}>{clientNom || '—'}</Text>
                <Text style={s.sigQual}>Lu et approuvé</Text>
                <Text style={s.sigLine}>Date · Signature</Text>
              </View>
            </View>
          </View>
        </View>

        <Footer num={3} total={totalPages} />
      </Page>

      {/* ============ PAGE 4 — PHOTOS ============ */}
      {hasPhotos && (
        <Page size="A4" style={s.page}>
          <Header reference={ref} dateIntervention={dateIntervention} ville={ville} />
          <Text style={s.watermark} fixed>PHOTOS</Text>

          <View style={s.content}>
            <View style={s.sectionWrap}>
              <Section num="9" title="DOCUMENTS PHOTOGRAPHIQUES" />
              <View style={s.photoGrid}>
                {photos!.map((p, i) => (
                  <View key={i} style={s.photoCard}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={p.url} style={s.photoImg} />
                    <Text style={s.photoBadge}>{i + 1}</Text>
                    {p.legende && <Text style={s.photoCap}>{p.legende}</Text>}
                  </View>
                ))}
              </View>
            </View>
          </View>

          <Footer num={4} total={totalPages} />
        </Page>
      )}

      {/* ============ PAGE DEVIS ============ */}
      {rapport.devis && (
        <Page size="A4" style={s.page}>
          <Header reference={ref} dateIntervention={dateIntervention} ville={ville} />
          <Text style={s.watermark} fixed>DEVIS</Text>

          <View style={s.content}>
            <View style={s.devisHeader}>
              <View>
                <Text style={s.devisHeaderTitle}>DEVIS Nº {rapport.devis.numero || `DV-${ref}`}</Text>
                <Text style={s.devisHeaderSub}>Travaux complémentaires suite à intervention du {dateIntervention}</Text>
              </View>
              <View style={s.devisHeaderRight}>
                <Text style={s.devisHeaderLbl}>VALIDITÉ</Text>
                <Text style={s.devisHeaderV}>{rapport.devis.validite_jours || 30} jours</Text>
                <Text style={s.devisHeaderLbl}>ÉMIS LE</Text>
                <Text style={s.devisHeaderV}>{dateIntervention}</Text>
              </View>
            </View>

            <View style={s.devisMeta}>
              <View style={s.devisMetaItem}><Text style={s.coverK}>CLIENT</Text><Text style={s.coverV}>{clientNom || '—'}</Text></View>
              <View style={s.devisMetaItem}><Text style={s.coverK}>CHANTIER</Text><Text style={s.coverV}>{adresse}, {codePostal} {ville}</Text></View>
              <View style={s.devisMetaItem}><Text style={s.coverK}>RÉFÉRENCE INTERVENTION</Text><Text style={s.coverV}>{ref}</Text></View>
              <View style={s.devisMetaItem}><Text style={s.coverK}>DÉLAI D'EXÉCUTION</Text><Text style={s.coverV}>Sous 15 jours après acceptation</Text></View>
            </View>

            <View style={s.devisTable}>
              <View style={s.devisHead}>
                <Text style={[s.devisHeadCell, { width: '52%' }]}>Désignation</Text>
                <Text style={[s.devisHeadCell, { width: '12%', textAlign: 'right' }]}>Qté</Text>
                <Text style={[s.devisHeadCell, { width: '18%', textAlign: 'right' }]}>PU HT</Text>
                <Text style={[s.devisHeadCell, { width: '18%', textAlign: 'right' }]}>Total HT</Text>
              </View>
              {Array.from(sections.entries()).map(([sec, items], si) => (
                <View key={si}>
                  <View style={s.devisSectionRow}><Text style={s.devisSectionTxt}>{sec}</Text></View>
                  {items.map((l, li) => (
                    <View key={li} style={s.devisLine}>
                      <View style={{ width: '52%' }}>
                        <Text style={s.devisDesignation}>{l.designation}</Text>
                        {l.description && <Text style={s.devisDescription}>{l.description}</Text>}
                      </View>
                      <Text style={[s.tableCell, { width: '12%', textAlign: 'right' }]}>{l.qte}</Text>
                      <Text style={[s.tableCell, { width: '18%', textAlign: 'right' }]}>{fmtEur(l.pu_ht)}</Text>
                      <Text style={[s.tableCell, { width: '18%', textAlign: 'right' }]}>{fmtEur(l.pu_ht * l.qte)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            <View style={s.totaux}>
              <View style={s.totauxRow}>
                <Text style={s.totauxLbl}>Total HT</Text>
                <Text style={s.totauxV}>{fmtEur(totalHT)}</Text>
              </View>
              <View style={s.totauxRow}>
                <Text style={s.totauxLbl}>TVA {tvaTaux} %</Text>
                <Text style={s.totauxV}>{fmtEur(tva)}</Text>
              </View>
              <View style={[s.totauxRow, s.totauxRowTtc]}>
                <Text style={s.totauxLblTtc}>TOTAL TTC</Text>
                <Text style={s.totauxVTtc}>{fmtEur(totalTTC)}</Text>
              </View>
            </View>

            {rapport.devis.conditions && rapport.devis.conditions.length > 0 && (
              <View style={s.conditions}>
                <Text style={s.conditionsTitle}>▸ CONDITIONS</Text>
                {rapport.devis.conditions.map((c, i) => (
                  <Text key={i} style={s.conditionsItem}>• {c}</Text>
                ))}
              </View>
            )}

            <View style={[s.endBlock, { marginTop: 14, padding: 14 }]}>
              <View style={s.signatureRow}>
                <View style={s.sigBlock}>
                  <Text style={s.sigRole}>ÉTABLI PAR</Text>
                  <Text style={s.sigName}>{technicienNom}</Text>
                  <Text style={s.sigQual}>★ Expert en assainissement</Text>
                  <Text style={s.sigScript}>{technicienNom}</Text>
                  <Text style={s.sigLine}>Pour Les Techniciens du Débouchage</Text>
                </View>
                <View style={s.sigBlock}>
                  <Text style={s.sigRole}>BON POUR ACCORD</Text>
                  <Text style={s.sigName}>{clientNom || '—'}</Text>
                  <Text style={s.sigQual}>Mention manuscrite obligatoire</Text>
                  <Text style={s.sigLine}>Date · Signature précédée de « Bon pour accord »</Text>
                </View>
              </View>
            </View>
          </View>

          <Footer num={hasPhotos ? 5 : 4} total={totalPages} />
        </Page>
      )}
    </Document>
  )
}

interface DownloadButtonProps extends PDFProps {
  filename?: string
}

export default function PDFDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `rapport-${(props.ville || 'intervention').toLowerCase()}-${props.dateIntervention}.pdf`
  return (
    <PDFDownloadLink document={<RealisationDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 font-semibold"
        >
          {loading ? 'Génération PDF...' : '⬇ Télécharger PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}

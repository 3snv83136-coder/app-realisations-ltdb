'use client'
import React from "react"
import { Document, Page, Text, View, StyleSheet, Image, PDFDownloadLink } from "@react-pdf/renderer"
import { PdfBanner, PDF_C } from "./PdfBranding"
import { isDevisTravauxVariant } from '@/lib/devis-variant'

/* ============ CHARTE ============ */
const C = {
  navy: PDF_C.navy,
  navyDark: PDF_C.navyDark,
  red: PDF_C.red,
  white: PDF_C.white,
  text: PDF_C.text,
  muted: PDF_C.muted,
  line: '#e3e8ef',
  lineSoft: '#eef1f6',
  rowAlt: '#eaf1fa',
  rowSoft: '#f6f8fb',
  teal: '#0d9488',
}

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.45,
  },
  content: { paddingHorizontal: 40, paddingTop: 16, paddingBottom: 28, flexGrow: 1 },

  /* Client + métadonnées */
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  billTo: { flex: 1, paddingRight: 20 },
  sectionLabel: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5,
  },
  clientName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 3 },
  clientLine: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },
  clientLabel: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 5 },
  metaBox: { width: '42%', borderWidth: 1, borderColor: C.line, borderRadius: 8 },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, paddingHorizontal: 12,
    borderBottomWidth: 0.75, borderBottomColor: C.lineSoft,
  },
  metaRowLast: { borderBottomWidth: 0 },
  metaK: { color: C.muted, fontSize: 9 },
  metaV: { color: C.text, fontSize: 9, fontFamily: 'Helvetica-Bold' },

  /* Bandes de section */
  bandNavy: { backgroundColor: C.navy, paddingVertical: 7, paddingHorizontal: 14, marginTop: 10, borderRadius: 6 },
  bandRed: { backgroundColor: C.red, paddingVertical: 7, paddingHorizontal: 14, marginTop: 14, borderRadius: 6 },
  bandTeal: { backgroundColor: C.teal, paddingVertical: 7, paddingHorizontal: 14, marginTop: 14, borderRadius: 6 },
  bandTxt: { color: C.white, fontSize: 10, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, textTransform: 'uppercase' },

  objetBox: {
    borderWidth: 1, borderColor: C.line, backgroundColor: C.rowSoft,
    borderRadius: 6, paddingVertical: 11, paddingHorizontal: 14, marginTop: 6, marginBottom: 4,
  },
  objetText: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },

  /* Photos */
  photosGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    marginTop: 8, marginBottom: 4,
  },
  photoCell: { width: '48.5%', marginBottom: 10 },
  photoImg: {
    width: '100%', height: 150, objectFit: 'cover',
    borderRadius: 6, borderWidth: 1, borderColor: C.line,
  },
  linePhotos: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6,
  },
  linePhoto: {
    width: 110, height: 78, objectFit: 'cover',
    borderRadius: 4, borderWidth: 1, borderColor: C.line,
  },
  linePhotoCaption: {
    fontSize: 7.5, color: C.muted, marginTop: 2, width: 110,
  },

  constatItem: {
    borderWidth: 1, borderColor: C.line, borderRadius: 6,
    paddingVertical: 9, paddingHorizontal: 12, marginTop: 6,
  },
  constatTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: C.navy, marginBottom: 4 },
  constatLoc: { fontSize: 8.5, color: C.muted, marginBottom: 4 },
  constatDesc: { fontSize: 9, color: C.text, lineHeight: 1.45 },

  /* Tableau — en-tête « pilule » */
  itemsHead: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.2, borderColor: C.navy, borderRadius: 22,
    paddingVertical: 7, paddingHorizontal: 8, marginTop: 8,
  },
  itemsHeadCell: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: 6,
  },
  sectionRow: { paddingTop: 8, paddingBottom: 2, paddingHorizontal: 8 },
  sectionRowTxt: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  itemsRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 8,
    borderBottomWidth: 0.75, borderBottomColor: C.lineSoft,
  },
  cDesig: { width: '50%', paddingHorizontal: 6 },
  cDesigName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  cDesigDesc: { color: C.muted, fontSize: 8.5, marginTop: 1, lineHeight: 1.4 },
  cPu: { width: '18%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'right' },
  cQte: { width: '14%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'center' },
  cTot: { width: '18%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'right', fontFamily: 'Helvetica-Bold' },

  /* Totaux */
  totalsMini: { alignSelf: 'flex-end', width: '46%', marginTop: 10 },
  totalsMiniRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 8 },
  totalsMiniLbl: { color: C.muted, fontSize: 10 },
  totalsMiniVal: { color: C.text, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.red, borderRadius: 8,
    paddingVertical: 11, paddingHorizontal: 18, marginTop: 8, marginBottom: 12,
  },
  totalBarLbl: { color: C.white, fontSize: 12.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  totalBarVal: { color: C.white, fontSize: 15, fontFamily: 'Helvetica-Bold' },

  /* Conditions */
  condTable: { borderWidth: 1, borderColor: C.line, borderRadius: 6, marginTop: 6, marginBottom: 12 },
  condRow: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: C.lineSoft },
  condRowLast: { borderBottomWidth: 0 },
  condLabel: {
    width: '35%', paddingVertical: 8, paddingHorizontal: 12,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    borderRightWidth: 0.75, borderRightColor: C.lineSoft,
  },
  condValue: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, color: C.text, fontSize: 9, lineHeight: 1.45 },

  /* Modalités */
  modalitesBox: {
    borderWidth: 1, borderColor: C.line, borderRadius: 6, borderLeftWidth: 4, borderLeftColor: C.red,
    padding: 12, marginTop: 6, marginBottom: 10,
  },
  modalitesP: { color: C.text, fontSize: 9.5, marginBottom: 6, lineHeight: 1.5 },
  modalitesStrong: { fontFamily: 'Helvetica-Bold' },
  modalitesMuted: { color: C.muted, fontSize: 8, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' },

  legalItem: { color: C.text, fontSize: 8.5, lineHeight: 1.45, marginBottom: 6, paddingLeft: 8 },
  legalBullet: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5 },

  attestation: { color: C.text, fontSize: 8.5, fontFamily: 'Helvetica-Oblique', lineHeight: 1.5, marginVertical: 12 },
  attestationStrong: { fontFamily: 'Helvetica-BoldOblique' },

  /* Signatures — encadrés arrondis (modèle) */
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  sigCard: {
    width: '48%', borderWidth: 1.2, borderColor: C.line, borderRadius: 10,
    padding: 12, minHeight: 96,
  },
  sigCardClient: { borderColor: C.red },
  sigHeadTxt: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 10 },
  sigLine: { color: C.text, fontSize: 9, marginBottom: 10 },
  sigMention: { color: C.text, fontSize: 9, marginBottom: 6 },
  sigMentionStrong: { fontFamily: 'Helvetica-Bold' },

  /* Footer */
  footer: {
    paddingHorizontal: 40, paddingTop: 8, paddingBottom: 14,
    borderTopWidth: 2, borderTopColor: C.red,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: C.white,
  },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },
})

/* ============ TYPES ============ */
export interface DevisConstatItem {
  intitule: string
  localisation?: string
  description: string
}

export interface DevisLineData {
  section?: string
  designation: string
  description?: string
  qte: number
  unite?: string
  pu_ht: number
  /** Photos illustrant cette ligne (travaux assainissement / pompe) — data URI ou URL. */
  photos?: string[]
}

export interface DevisConditions {
  validite?: string
  delai_execution?: string
  duree_chantier?: string
  garanties?: string
  assurance?: string
  particulieres?: string
}

export interface DevisModalites {
  acompte_pct?: number
  modes_paiement?: string[]
}

export interface DevisData {
  numero: string
  date_devis: string
  validite_jours?: number
  majoration_note?: string
  objet: string
  reference_dossier?: string
  /** classique = débouchage/curage · travaux-assainissement = terrassement, regards, pompes */
  variant?: 'classique' | 'travaux-assainissement'
  lignes: DevisLineData[]
  tva_taux?: number
  tva_reduite_attestation?: boolean
  conditions?: DevisConditions
  modalites?: DevisModalites
  constats_conformes?: DevisConstatItem[]
  constats_critiques?: DevisConstatItem[]
  non_garantie?: string
  /** Bloc mentions légales (devis travaux assainissement / pompe de relevage). */
  mentions_legales?: string[]
  photos?: string[]           // URLs ou data URIs (base64) — optionnel, non bloquant
}

export interface EmetteurData {
  raisonSociale: string
  adresseLignes: string[]
  telephone: string
  email: string
  rcs?: string
  capital?: string
  siret?: string
  tva?: string
  iban?: string
  bic?: string
}

export interface ClientData {
  nom: string
  /** Occupant / locataire / propriétaire (cas syndic). */
  nomFinal?: string
  adresseLignes: string[]
  adresseChantier?: string
  siret?: string
}

export interface DevisPDFProps {
  emetteur: EmetteurData
  client: ClientData
  devis: DevisData
  phone?: string
}

/* ============ HELPERS ============ */
const fmtEur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[\u00A0\u202F\u2007\u2009\u200A]/g, ' ') + ' €'

const fmtDateFR = (raw: string) => {
  if (!raw) return ''
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return raw
}

function groupBySection(lines: DevisLineData[]): { section: string; items: DevisLineData[] }[] {
  const order: string[] = []
  const map = new Map<string, DevisLineData[]>()
  lines.forEach(l => {
    const key = l.section || 'Prestations'
    if (!map.has(key)) { map.set(key, []); order.push(key) }
    map.get(key)!.push(l)
  })
  return order.map(section => ({ section, items: map.get(section)! }))
}

const Footer = ({ emetteur }: { emetteur: EmetteurData }) => {
  const line1 = [emetteur.raisonSociale, ...emetteur.adresseLignes].filter(Boolean).join(' · ')
  const line2 = [
    emetteur.capital ? `Capital ${emetteur.capital}` : '',
    emetteur.rcs || '',
    emetteur.siret ? `SIRET ${emetteur.siret}` : '',
    emetteur.email || '',
  ].filter(Boolean).join(' · ')
  return (
    <View style={s.footer} fixed>
      <View>
        <Text style={s.footerL}>{line1}</Text>
        {line2 ? <Text style={s.footerL}>{line2}</Text> : null}
      </View>
      <Text style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  )
}

/**
 * Bloc harmonieux : titre + contenu restent ensemble.
 * - non splitable → le bloc entier saute de page s'il ne tient pas
 * - splitable → le début (bandeau) ne reste pas orphelin en bas de page
 */
function DevisBlock({
  children,
  minPresenceAhead = 88,
  splitable = false,
}: {
  children: React.ReactNode
  minPresenceAhead?: number
  splitable?: boolean
}) {
  return (
    <View
      wrap={splitable ? undefined : false}
      minPresenceAhead={minPresenceAhead}
      style={{ marginBottom: 4 }}
    >
      {children}
    </View>
  )
}

function Band({
  label,
  tone = 'navy',
}: {
  label: string
  tone?: 'navy' | 'red' | 'teal'
}) {
  const style = tone === 'red' ? s.bandRed : tone === 'teal' ? s.bandTeal : s.bandNavy
  return (
    <View style={style} wrap={false}>
      <Text style={s.bandTxt}>{label}</Text>
    </View>
  )
}

function PrestationsLine({ l }: { l: DevisLineData }) {
  return (
    <View style={s.itemsRow} wrap={false} minPresenceAhead={48}>
      <View style={s.cDesig}>
        <Text style={s.cDesigName}>{l.designation}</Text>
        {l.description ? <Text style={s.cDesigDesc}>{l.description}</Text> : null}
        {(l.photos?.length ?? 0) > 0 ? (
          <View style={s.linePhotos}>
            {l.photos!.slice(0, 4).map((src, pi) => (
              <View key={pi} wrap={false}>
                <Image src={src} style={s.linePhoto} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Text style={s.cPu}>{fmtEur(l.pu_ht)}</Text>
      <Text style={s.cQte}>{l.qte}{l.unite ? ` ${l.unite}` : ''}</Text>
      <Text style={s.cTot}>{fmtEur(l.pu_ht * l.qte)}</Text>
    </View>
  )
}

/* ============ DOCUMENT ============ */
export function DevisDocument({ emetteur, client, devis, phone }: DevisPDFProps) {
  const validite = devis.validite_jours ?? 30
  const dateFmt = fmtDateFR(devis.date_devis)
  const tvaTaux = devis.tva_taux ?? 10

  const totalHT = devis.lignes.reduce((sum, l) => sum + l.pu_ht * l.qte, 0)
  const tva = totalHT * tvaTaux / 100
  const totalTTC = totalHT + tva

  const acomptePct = devis.modalites?.acompte_pct ?? 30
  const acompteTTC = totalTTC * acomptePct / 100
  const soldePct = 100 - acomptePct
  const soldeTTC = totalTTC - acompteTTC

  const modesPaiement = devis.modalites?.modes_paiement && devis.modalites.modes_paiement.length > 0
    ? devis.modalites.modes_paiement
    : ['Chèque', 'Virement bancaire', 'Carte bancaire', 'Espèces (dans la limite légale)']

  const sections = groupBySection(devis.lignes)

  const subTitle = [
    `établi le ${dateFmt}`,
    `valable ${validite} jours`,
    devis.majoration_note ? `majoration ${devis.majoration_note}` : '',
  ].filter(Boolean).join(' · ')

  const conditionRows = devis.conditions
    ? [
        { k: 'Validité du devis', v: devis.conditions.validite || `${validite} jours à compter de la date d'établissement` },
        { k: "Délai d'exécution", v: devis.conditions.delai_execution || '—' },
        { k: 'Durée estimée du chantier', v: devis.conditions.duree_chantier || '—' },
        { k: 'Garanties', v: devis.conditions.garanties || '—' },
        { k: 'Assurance', v: devis.conditions.assurance || '—' },
        { k: 'Conditions particulières', v: devis.conditions.particulieres || '—' },
      ]
    : []

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <View fixed>
          <PdfBanner
            title="DEVIS"
            numero={devis.numero}
            subtitle={subTitle}
            phone={phone || emetteur.telephone}
            email={emetteur.email}
          />
        </View>

        <View style={s.content}>
          {/* ===== Client + métadonnées ===== */}
          <DevisBlock minPresenceAhead={110}>
            <View style={s.infoRow}>
              <View style={s.billTo}>
                <Text style={s.sectionLabel}>Devis pour</Text>
                <Text style={s.clientName}>{client.nom}</Text>
                {client.nomFinal ? (
                  <Text style={s.clientLine}>Client concerné : {client.nomFinal}</Text>
                ) : null}
                {client.adresseLignes.map((l, i) => (
                  <Text key={i} style={s.clientLine}>{l}</Text>
                ))}
                {client.siret ? <Text style={s.clientLine}>SIRET {client.siret}</Text> : null}
                {client.adresseChantier ? (
                  <>
                    <Text style={s.clientLabel}>Adresse du chantier :</Text>
                    <Text style={s.clientLine}>{client.adresseChantier}</Text>
                  </>
                ) : null}
              </View>
              <View style={s.metaBox}>
                <View style={s.metaRow}>
                  <Text style={s.metaK}>Date</Text>
                  <Text style={s.metaV}>{dateFmt}</Text>
                </View>
                <View style={s.metaRow}>
                  <Text style={s.metaK}>Validité</Text>
                  <Text style={s.metaV}>{validite} jours</Text>
                </View>
                {devis.reference_dossier ? (
                  <View style={[s.metaRow, s.metaRowLast]}>
                    <Text style={s.metaK}>Réf.</Text>
                    <Text style={s.metaV}>{devis.reference_dossier}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </DevisBlock>

          {/* ===== Objet ===== */}
          {devis.objet ? (
            <DevisBlock minPresenceAhead={72}>
              <Band label="Objet du devis" />
              <View style={s.objetBox}>
                <Text style={s.objetText}>{devis.objet}</Text>
              </View>
            </DevisBlock>
          ) : null}

          {/* ===== Constats conformes ===== */}
          {(devis.constats_conformes?.length ?? 0) > 0 ? (
            <DevisBlock splitable minPresenceAhead={96}>
              <View wrap={false} minPresenceAhead={64}>
                <Band label="Conforme" tone="teal" />
                <View style={s.constatItem}>
                  <Text style={s.constatTitle}>{devis.constats_conformes![0].intitule}</Text>
                  {devis.constats_conformes![0].localisation
                    ? <Text style={s.constatLoc}>{devis.constats_conformes![0].localisation}</Text>
                    : null}
                  <Text style={s.constatDesc}>{devis.constats_conformes![0].description}</Text>
                </View>
              </View>
              {devis.constats_conformes!.slice(1).map((row, i) => (
                <View key={i} style={s.constatItem} wrap={false} minPresenceAhead={56}>
                  <Text style={s.constatTitle}>{row.intitule}</Text>
                  {row.localisation ? <Text style={s.constatLoc}>{row.localisation}</Text> : null}
                  <Text style={s.constatDesc}>{row.description}</Text>
                </View>
              ))}
            </DevisBlock>
          ) : null}

          {/* ===== Constats critiques ===== */}
          {(devis.constats_critiques?.length ?? 0) > 0 ? (
            <DevisBlock splitable minPresenceAhead={96}>
              <View wrap={false} minPresenceAhead={64}>
                <Band label="Critique" tone="red" />
                <View style={s.constatItem}>
                  <Text style={s.constatTitle}>{devis.constats_critiques![0].intitule}</Text>
                  {devis.constats_critiques![0].localisation
                    ? <Text style={s.constatLoc}>{devis.constats_critiques![0].localisation}</Text>
                    : null}
                  <Text style={s.constatDesc}>{devis.constats_critiques![0].description}</Text>
                </View>
              </View>
              {devis.constats_critiques!.slice(1).map((row, i) => (
                <View key={i} style={s.constatItem} wrap={false} minPresenceAhead={56}>
                  <Text style={s.constatTitle}>{row.intitule}</Text>
                  {row.localisation ? <Text style={s.constatLoc}>{row.localisation}</Text> : null}
                  <Text style={s.constatDesc}>{row.description}</Text>
                </View>
              ))}
            </DevisBlock>
          ) : null}

          {/* ===== Non garantie ===== */}
          {devis.non_garantie ? (
            <DevisBlock minPresenceAhead={80}>
              <Band label="Non garantie suite à notre intervention" />
              <View style={s.objetBox}>
                <Text style={s.objetText}>{devis.non_garantie}</Text>
              </View>
            </DevisBlock>
          ) : null}

          {/* ===== Photos (optionnel) ===== */}
          {(devis.photos?.length ?? 0) > 0 ? (
            <DevisBlock splitable minPresenceAhead={160}>
              <View wrap={false} minPresenceAhead={120}>
                <Band label="Photos" />
                <View style={s.photosGrid}>
                  {devis.photos!.slice(0, 2).map((src, i) => (
                    <View key={i} style={s.photoCell} wrap={false}>
                      <Image src={src} style={s.photoImg} />
                    </View>
                  ))}
                </View>
              </View>
              {(devis.photos!.length > 2) ? (
                <View style={s.photosGrid}>
                  {devis.photos!.slice(2).map((src, i) => (
                    <View key={i} style={s.photoCell} wrap={false} minPresenceAhead={140}>
                      <Image src={src} style={s.photoImg} />
                    </View>
                  ))}
                </View>
              ) : null}
            </DevisBlock>
          ) : null}

          {/* ===== Tableau prestations ===== */}
          <DevisBlock splitable minPresenceAhead={100}>
            <View style={s.itemsHead} wrap={false} minPresenceAhead={72}>
              <Text style={[s.itemsHeadCell, { width: '50%' }]}>Description</Text>
              <Text style={[s.itemsHeadCell, { width: '18%', textAlign: 'right' }]}>Prix unitaire</Text>
              <Text style={[s.itemsHeadCell, { width: '14%', textAlign: 'center' }]}>Quantité</Text>
              <Text style={[s.itemsHeadCell, { width: '18%', textAlign: 'right' }]}>Total HT</Text>
            </View>

            {sections.map((sec, si) => {
              const [first, ...rest] = sec.items
              return (
                <View key={si} minPresenceAhead={64}>
                  <View wrap={false} minPresenceAhead={56}>
                    <View style={s.sectionRow}>
                      <Text style={s.sectionRowTxt}>{sec.section}</Text>
                    </View>
                    {first ? <PrestationsLine l={first} /> : null}
                  </View>
                  {rest.map((l, li) => (
                    <PrestationsLine key={li} l={l} />
                  ))}
                </View>
              )
            })}
          </DevisBlock>

          {/* ===== Totaux (toujours ensemble) ===== */}
          <DevisBlock minPresenceAhead={110}>
            <View style={s.totalsMini}>
              <View style={s.totalsMiniRow}>
                <Text style={s.totalsMiniLbl}>Sous-total HT</Text>
                <Text style={s.totalsMiniVal}>{fmtEur(totalHT)}</Text>
              </View>
              <View style={s.totalsMiniRow}>
                <Text style={s.totalsMiniLbl}>
                  TVA ({tvaTaux} %){devis.tva_reduite_attestation ? ' — taux réduit' : ''}
                </Text>
                <Text style={s.totalsMiniVal}>{tvaTaux === 0 ? '—' : fmtEur(tva)}</Text>
              </View>
            </View>
            <View style={s.totalBar}>
              <Text style={s.totalBarLbl}>TOTAL TTC</Text>
              <Text style={s.totalBarVal}>{fmtEur(totalTTC)}</Text>
            </View>
          </DevisBlock>

          {/* ===== Conditions d'exécution ===== */}
          {devis.conditions ? (
            <DevisBlock minPresenceAhead={160}>
              <Band label="Conditions d'exécution" />
              <View style={s.condTable}>
                {conditionRows.map((row, i, arr) => (
                  <View key={i} style={[s.condRow, i === arr.length - 1 ? s.condRowLast : {}]} wrap={false}>
                    <Text style={s.condLabel}>{row.k}</Text>
                    <Text style={s.condValue}>{row.v}</Text>
                  </View>
                ))}
              </View>
            </DevisBlock>
          ) : null}

          {/* ===== Modalités de règlement ===== */}
          <DevisBlock minPresenceAhead={140}>
            <Band label="Modalités de règlement" tone="red" />
            <View style={s.modalitesBox}>
              <Text style={s.modalitesP}>
                <Text style={s.modalitesStrong}>Acompte à la commande : </Text>
                {acomptePct} % soit {fmtEur(acompteTTC)} TTC
              </Text>
              <Text style={s.modalitesP}>
                <Text style={s.modalitesStrong}>Solde : </Text>
                {soldePct} % soit {fmtEur(soldeTTC)} TTC à la réception des travaux
              </Text>
              <Text style={s.modalitesP}>
                <Text style={s.modalitesStrong}>Modes de paiement acceptés : </Text>
                {modesPaiement.join(' · ')}
              </Text>
              <Text style={s.modalitesMuted}>
                Indemnité forfaitaire de recouvrement en cas de retard de paiement : 40 € (art. L441-10 C. com.) · Pas d&apos;escompte pour règlement anticipé.
              </Text>
            </View>
          </DevisBlock>

          {/* ===== Mentions légales (devis travaux) ===== */}
          {isDevisTravauxVariant(devis.variant) && devis.mentions_legales && devis.mentions_legales.length > 0 ? (
            <DevisBlock splitable minPresenceAhead={120}>
              <View wrap={false} minPresenceAhead={80}>
                <Band label="Mentions légales & réglementaires" />
                <View style={[s.modalitesBox, { borderLeftColor: C.navy, marginBottom: 4 }]}>
                  <Text style={s.legalItem}>
                    <Text style={s.legalBullet}>1. </Text>
                    {devis.mentions_legales[0]}
                  </Text>
                </View>
              </View>
              <View style={[s.modalitesBox, { borderLeftColor: C.navy, marginBottom: 10, marginTop: 0 }]}>
                {devis.mentions_legales.slice(1).map((mention, i) => (
                  <Text key={i} style={s.legalItem} wrap={false} minPresenceAhead={36}>
                    <Text style={s.legalBullet}>{i + 2}. </Text>
                    {mention}
                  </Text>
                ))}
              </View>
            </DevisBlock>
          ) : null}

          {/* ===== Attestation TVA 10% ===== */}
          {devis.tva_reduite_attestation ? (
            <DevisBlock minPresenceAhead={72}>
              <Text style={s.attestation}>
                Je soussigné <Text style={s.attestationStrong}>{client.nom}</Text> atteste par la présente que les travaux qui font l&apos;objet du présent devis sont réalisés à l&apos;adresse précitée, à usage d&apos;habitation à plus de 50 % et que la construction est achevée depuis plus de 2 ans (attestation permettant l&apos;application du taux réduit de TVA à 10 %, art. 279-0 bis du CGI).
              </Text>
            </DevisBlock>
          ) : null}

          {/* ===== Signatures ===== */}
          <DevisBlock minPresenceAhead={150}>
            <View style={s.sigRow}>
              <View style={s.sigCard}>
                <Text style={s.sigHeadTxt}>{emetteur.raisonSociale}</Text>
                <Text style={s.sigLine}>Date : {dateFmt}</Text>
                <Text style={s.sigLine}>Cachet &amp; signature :</Text>
              </View>
              <View style={[s.sigCard, s.sigCardClient]}>
                <Text style={s.sigHeadTxt}>Client — Bon pour accord, devis approuvé</Text>
                <Text style={s.sigMention}><Text style={s.sigMentionStrong}>{client.nom}</Text></Text>
                <Text style={s.sigLine}>Date : ______________________</Text>
                <Text style={s.sigMention}>
                  Mention « <Text style={s.sigMentionStrong}>Bon pour accord</Text> » + signature :
                </Text>
              </View>
            </View>
          </DevisBlock>
        </View>

        <Footer emetteur={emetteur} />
      </Page>
    </Document>
  )
}

interface DownloadButtonProps extends DevisPDFProps {
  filename?: string
}

export default function DevisDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `devis-${(props.client.nom || 'client').toLowerCase().replace(/\s+/g, '-')}-${props.devis.numero}.pdf`
  return (
    <PDFDownloadLink document={<DevisDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 font-semibold"
        >
          {loading ? 'Génération PDF...' : '⬇ Télécharger le devis PDF'}
        </button>
      )}
    </PDFDownloadLink>
  )
}

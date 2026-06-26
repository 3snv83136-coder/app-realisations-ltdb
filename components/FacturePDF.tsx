import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import type { EmetteurData, ClientData } from "./DevisPDF"
import { FACTURE_MENTIONS_LEGALES } from "@/lib/entreprise"
import { MENTION_TVA_FRANCHISE } from "@/lib/accord/blocs-legaux"
import { PdfBanner, PDF_C } from "./PdfBranding"
import type { Agence } from "@/lib/agences"

export type { Agence } from "@/lib/agences"
export { AGENCES } from "@/lib/agences"

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
  green: '#0f7a3b',
  greenSoft: '#e8f3ec',
  greenBorder: '#a3c9b3',
  yellowDark: '#7c5e00',
  yellowSoft: '#fff8dc',
  yellowBorder: '#e8d384',
  blueSoft: '#eef4fc',
  blueBorder: '#b9cce8',
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
  content: { paddingHorizontal: 40, paddingTop: 16, paddingBottom: 10, flexGrow: 1 },

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
  metaVRegle: { color: C.green },

  /* Objet */
  objet: { fontSize: 9.5, marginBottom: 8, lineHeight: 1.5 },
  objetLabel: { fontFamily: 'Helvetica-Bold', color: C.navy },

  /* Tableau prestations — en-tête « pilule » */
  itemsHead: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.2, borderColor: C.navy, borderRadius: 22,
    paddingVertical: 7, paddingHorizontal: 8,
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
  cDesig: { width: '50%', paddingHorizontal: 6 },
  cDesigName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5 },
  cDesigDesc: { color: C.muted, fontSize: 8.5, marginTop: 1, lineHeight: 1.4 },
  cPu: { width: '18%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'right' },
  cQte: { width: '14%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'center' },
  cTot: { width: '18%', paddingHorizontal: 6, fontSize: 9.5, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  cInclus: { color: C.muted, fontStyle: 'italic', fontFamily: 'Helvetica' },

  /* Totaux : mini-lignes alignées à droite + barre rouge pleine largeur */
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

  tvaFranchiseBox: {
    marginTop: -4, marginBottom: 10, paddingVertical: 6, paddingHorizontal: 10,
    borderWidth: 1, borderColor: C.yellowBorder, backgroundColor: C.yellowSoft, borderRadius: 6,
  },
  tvaFranchiseText: { color: C.yellowDark, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  /* Cartes (paiement / observations) */
  card: {
    borderWidth: 1, borderColor: C.line, borderRadius: 8,
    padding: 12, marginBottom: 10,
  },
  cardAccentGreen: { borderLeftWidth: 4, borderLeftColor: C.green },
  cardAccentBlue: { borderLeftWidth: 4, borderLeftColor: C.navy },
  cardAccentYellow: { borderLeftWidth: 4, borderLeftColor: C.yellowBorder, backgroundColor: '#fffdf4' },
  cardTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9.5,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  cardText: { color: C.text, fontSize: 9.5, lineHeight: 1.5 },
  cardPara: { marginBottom: 5 },
  cardStrong: { fontFamily: 'Helvetica-Bold' },
  ribRow: { flexDirection: 'row', marginBottom: 2 },
  ribLbl: { color: C.muted, fontSize: 9, width: 44 },
  ribVal: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5, letterSpacing: 0.5 },
  ribNote: { color: C.muted, fontSize: 8.5, marginTop: 4, fontStyle: 'italic' },

  legalBox: {
    marginTop: 4, padding: 9, borderWidth: 1, borderColor: C.line,
    borderRadius: 6, backgroundColor: '#fafbfc',
  },
  legalText: { color: C.muted, fontSize: 7.5, lineHeight: 1.45 },

  /* Footer */
  footer: {
    paddingHorizontal: 40, paddingTop: 8, paddingBottom: 14,
    borderTopWidth: 2, borderTopColor: C.red,
    backgroundColor: C.white,
  },
  footerBankRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingBottom: 6, marginBottom: 6,
    borderBottomWidth: 0.5, borderBottomColor: C.line,
  },
  footerBankCol: { fontSize: 7.5, color: C.text },
  footerBankLbl: { color: C.muted, fontFamily: 'Helvetica' },
  footerBankVal: { fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  footerBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerL: { color: C.muted, fontSize: 7.5, lineHeight: 1.4 },
  footerR: { color: C.muted, fontSize: 7.5, textAlign: 'right' },
})

/* ============ TYPES ============ */
export interface FactureLineData {
  designation: string
  description?: string
  qte: number
  unite?: string
  pu_ht: number
  inclus?: boolean
}

export interface FactureData {
  numero: string
  date_facture: string
  echeance: string
  objet: string
  reference_dossier?: string
  lignes: FactureLineData[]
  tva_taux?: number
  mode_reglement?: string
  observations?: string
  recommandation?: string
}

export interface FactureEmetteurData extends EmetteurData {
  agence?: Agence | string
}

export interface FacturePDFProps {
  emetteur: FactureEmetteurData
  client: ClientData
  facture: FactureData
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

const Footer = ({ emetteur }: { emetteur: FactureEmetteurData }) => {
  const iban = emetteur.iban || ''
  const bic = emetteur.bic || ''
  const line1 = [emetteur.raisonSociale, ...emetteur.adresseLignes].filter(Boolean).join(' · ')
  const line2 = [
    emetteur.rcs || '',
    emetteur.siret ? `SIRET ${emetteur.siret}` : '',
    emetteur.tva ? `TVA ${emetteur.tva}` : '',
  ].filter(Boolean).join(' · ')
  const line3 = [
    emetteur.email || '',
    emetteur.telephone ? `Tél. ${emetteur.telephone}` : '',
  ].filter(Boolean).join(' · ')
  return (
    <View style={s.footer} fixed>
      {iban ? (
        <View style={s.footerBankRow}>
          <Text style={s.footerBankCol}>
            <Text style={s.footerBankLbl}>IBAN </Text>
            <Text style={s.footerBankVal}>{iban}</Text>
          </Text>
          {bic ? (
            <Text style={s.footerBankCol}>
              <Text style={s.footerBankLbl}>BIC </Text>
              <Text style={s.footerBankVal}>{bic}</Text>
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={s.footerBottomRow}>
        <View>
          <Text style={s.footerL}>{line1}</Text>
          {line2 ? <Text style={s.footerL}>{line2}</Text> : null}
          {line3 ? <Text style={s.footerL}>{line3}</Text> : null}
        </View>
        <Text style={s.footerR} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
      </View>
    </View>
  )
}

/* ============ DOCUMENT ============ */
export function FactureDocument({ emetteur, client, facture, phone }: FacturePDFProps) {
  const dateFmt = fmtDateFR(facture.date_facture)
  const tvaTaux = facture.tva_taux ?? 0
  const echeanceVal = facture.echeance || 'À réception'
  const isRegle = /^r[ée]gl[ée]e?$/i.test(echeanceVal.trim())

  const totalHT = facture.lignes.reduce((sum, l) => {
    if (l.inclus) return sum
    return sum + (Number(l.pu_ht) || 0) * (Number(l.qte) || 0)
  }, 0)
  const tva = totalHT * tvaTaux / 100
  const totalTTC = totalHT + tva

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View fixed>
          <PdfBanner
            title="FACTURE"
            numero={facture.numero}
            phone={phone || emetteur.telephone}
            email={emetteur.email}
          />
        </View>

        <View style={s.content}>
          {/* ===== Client + métadonnées ===== */}
          <View style={s.infoRow} wrap={false}>
            <View style={s.billTo}>
              <Text style={s.sectionLabel}>Facturé à</Text>
              <Text style={s.clientName}>{client.nom}</Text>
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
                <Text style={s.metaK}>Échéance</Text>
                <Text style={[s.metaV, isRegle ? s.metaVRegle : {}]}>{echeanceVal}</Text>
              </View>
              {facture.reference_dossier ? (
                <View style={[s.metaRow, s.metaRowLast]}>
                  <Text style={s.metaK}>Réf.</Text>
                  <Text style={s.metaV}>{facture.reference_dossier}</Text>
                </View>
              ) : (
                emetteur.agence ? (
                  <View style={[s.metaRow, s.metaRowLast]}>
                    <Text style={s.metaK}>Agence</Text>
                    <Text style={s.metaV}>{emetteur.agence}</Text>
                  </View>
                ) : null
              )}
            </View>
          </View>

          {/* ===== Objet ===== */}
          {facture.objet ? (
            <Text style={s.objet} wrap={false}>
              <Text style={s.objetLabel}>Objet : </Text>
              {facture.objet}
            </Text>
          ) : null}

          {/* ===== Tableau prestations ===== */}
          <View style={s.itemsHead}>
            <Text style={[s.itemsHeadCell, { width: '50%' }]}>Description</Text>
            <Text style={[s.itemsHeadCell, { width: '18%', textAlign: 'right' }]}>Prix unitaire</Text>
            <Text style={[s.itemsHeadCell, { width: '14%', textAlign: 'center' }]}>Quantité</Text>
            <Text style={[s.itemsHeadCell, { width: '18%', textAlign: 'right' }]}>Total HT</Text>
          </View>

          {facture.lignes.map((l, li) => (
            <View key={li} style={s.itemsRow} wrap={false}>
              <View style={s.cDesig}>
                <Text style={s.cDesigName}>{l.designation}</Text>
                {l.description ? <Text style={s.cDesigDesc}>{l.description}</Text> : null}
              </View>
              <Text style={[s.cPu, l.inclus ? s.cInclus : {}]}>
                {l.inclus ? 'inclus' : fmtEur(l.pu_ht)}
              </Text>
              <Text style={s.cQte}>{l.qte}{l.unite ? ` ${l.unite}` : ''}</Text>
              <Text style={[s.cTot, l.inclus ? s.cInclus : {}]}>
                {l.inclus ? 'inclus' : fmtEur((l.pu_ht || 0) * (l.qte || 0))}
              </Text>
            </View>
          ))}

          {/* ===== Totaux ===== */}
          <View style={s.totalsMini} wrap={false}>
            <View style={s.totalsMiniRow}>
              <Text style={s.totalsMiniLbl}>Sous-total HT</Text>
              <Text style={s.totalsMiniVal}>{fmtEur(totalHT)}</Text>
            </View>
            <View style={s.totalsMiniRow}>
              <Text style={s.totalsMiniLbl}>
                {tvaTaux === 0
                  ? 'TVA (non applicable)'
                  : `TVA (${tvaTaux} %)${tvaTaux === 10 ? ' — taux réduit' : ''}`}
              </Text>
              <Text style={s.totalsMiniVal}>{tvaTaux === 0 ? '—' : fmtEur(tva)}</Text>
            </View>
          </View>
          <View style={s.totalBar} wrap={false}>
            <Text style={s.totalBarLbl}>{tvaTaux === 0 ? 'NET À PAYER' : 'TOTAL TTC'}</Text>
            <Text style={s.totalBarVal}>{fmtEur(totalTTC)}</Text>
          </View>

          {tvaTaux === 0 ? (
            <View style={s.tvaFranchiseBox} wrap={false}>
              <Text style={s.tvaFranchiseText}>{MENTION_TVA_FRANCHISE} (franchise en base de TVA).</Text>
            </View>
          ) : null}

          {/* ===== Informations de paiement ===== */}
          {(facture.mode_reglement || (!isRegle && emetteur.iban)) ? (
            <View style={[s.card, isRegle ? s.cardAccentGreen : s.cardAccentBlue]} wrap={false}>
              <Text style={s.cardTitle}>Informations de paiement</Text>
              {facture.mode_reglement ? (
                <Text style={s.cardText}>{facture.mode_reglement}</Text>
              ) : null}
              {!isRegle && emetteur.iban ? (
                <>
                  <View style={s.ribRow}>
                    <Text style={s.ribLbl}>IBAN</Text>
                    <Text style={s.ribVal}>{emetteur.iban}</Text>
                  </View>
                  {emetteur.bic ? (
                    <View style={s.ribRow}>
                      <Text style={s.ribLbl}>BIC</Text>
                      <Text style={s.ribVal}>{emetteur.bic}</Text>
                    </View>
                  ) : null}
                  <Text style={s.ribNote}>
                    Merci d&apos;indiquer le numéro de facture {facture.numero} en référence du virement.
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          {/* ===== Observations du technicien =====
              Pas de wrap={false} : le texte peut être long et doit pouvoir
              se découper sur plusieurs pages sans se chevaucher. */}
          {(facture.observations || facture.recommandation) ? (
            <View style={[s.card, s.cardAccentYellow]}>
              <Text style={s.cardTitle}>Observations du technicien</Text>
              <Text style={s.cardText}>
                {facture.observations || ''}
                {facture.observations && facture.recommandation ? '\n\n' : ''}
                {facture.recommandation ? (
                  <>
                    <Text style={s.cardStrong}>Recommandation : </Text>
                    {facture.recommandation}
                  </>
                ) : null}
              </Text>
            </View>
          ) : null}

          <View style={s.legalBox} wrap={false}>
            <Text style={s.legalText}>{FACTURE_MENTIONS_LEGALES}</Text>
          </View>
        </View>

        <Footer emetteur={emetteur} />
      </Page>
    </Document>
  )
}

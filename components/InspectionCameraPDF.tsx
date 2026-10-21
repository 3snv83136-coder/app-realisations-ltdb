'use client'
/**
 * Rapport caméra LTDB : couverture et synthèse, constats illustrés par tronçon,
 * puis guide de lecture. Les pages se prolongent selon le contenu.
 * Génération via `buildInspectionPdfBlob` pour tous les rapports.
 */
import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import { INSPECTION_LOGO } from "@/lib/inspection-logo"
import { PDF_C } from "./PdfBranding"
import type { Style } from "@react-pdf/types"
import { GRAVITE_LABELS, GLOSSAIRE, findDefaut } from "@/lib/camera-defauts"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/* ============ CHARTE ============ */
const C = {
  navy: PDF_C.navy,
  red: '#c0392b',
  redSoft: '#fdecea',
  greenSoft: '#e8f3ec',
  greenBorder: '#a3c9b3',
  greenDark: '#0f5132',
  yellowSoft: '#fff8dc',
  yellowBorder: '#e8d384',
  yellowDark: '#7c5e00',
  blueSoft: '#eef4fc',
  blueBorder: '#b9cce8',
  rowAlt: '#eef2f8',
  border: '#c7cfdb',
  text: '#1a1f2e',
  muted: '#5a6270',
  white: '#ffffff',
}

/* ============ TYPES ============ */
export type ObservationItem = {
  position: string
  code?: string
  description: string
  photoUrl?: string
  photoLegende?: string
}

export type Troncon = {
  reseau?: string
  materiau?: string
  diametre?: string
  longueurM?: number
  regardAmont?: string
  regardAval?: string
  sensInspection?: string
  materielUtilise?: string
  conditionsMeteo?: string
}

export type ConclusionEtat = 'bon' | 'a-surveiller' | 'desordre' | 'critique'
export type PreconisationItem = { titre: string; detail: string; urgence?: string }

export type TronconBloc = {
  nom?: string
  caracteristiques: Troncon
  observations: ObservationItem[]
  preconisations: PreconisationItem[]
  resume: string
  conclusionEtat: ConclusionEtat
}

/** Marqueur d’anomalie placé sur le schéma libre du réseau. */
export type SchemaMarker = {
  id: string
  /** Position relative 0–100 */
  xPct: number
  yPct: number
  /** Numéro affiché sur la pastille */
  n: number
  tronconId: string
  tronconNom?: string
  obsIndex: number
  label: string
  code?: string
  description?: string
  hasPhoto?: boolean
}

export type InspectionData = {
  numero: string
  dateInspection: string
  technicienNom: string
  agence?: string
  client: {
    nom: string
    adresse: string
    codePostal: string
    ville: string
    email?: string
    telephone?: string
  }
  /** Image carte (data URL) pour la page de garde — remplie à la génération PDF. */
  mapImageUrl?: string
  /** Photo de présentation choisie explicitement, indépendante des observations. */
  coverPhotoUrl?: string
  /** Schéma libre du réseau (composite dessin + pastilles) pour le PDF. */
  schemaReseauUrl?: string
  /** Légende des anomalies placées sur le schéma. */
  schemaMarkers?: SchemaMarker[]
  troncons: TronconBloc[]
  conclusionEtat: ConclusionEtat
}

export type InspectionPDFVariant = 'full' | 'intro' | 'troncon' | 'schema' | 'glossaire'

const ETAT_SEVERITY: Record<ConclusionEtat, number> = {
  bon: 0, 'a-surveiller': 1, desordre: 2, critique: 3,
}

export function worstConclusion(etats: ConclusionEtat[]): ConclusionEtat {
  let worst: ConclusionEtat = 'bon'
  for (const e of etats) {
    if (ETAT_SEVERITY[e] > ETAT_SEVERITY[worst]) worst = e
  }
  return worst
}

export interface InspectionPDFProps {
  data: InspectionData
  variant?: InspectionPDFVariant
  tronconIndex?: number
  tronconTotal?: number
}

const ETAT_LABEL: Record<ConclusionEtat, { label: string; bg: string; fg: string }> = {
  bon:            { label: 'État satisfaisant', bg: C.greenSoft, fg: C.greenDark },
  'a-surveiller': { label: 'À surveiller', bg: C.yellowSoft, fg: C.yellowDark },
  desordre:       { label: 'Désordres significatifs', bg: C.redSoft, fg: C.red },
  critique:       { label: 'Désordres critiques — action requise', bg: '#fbe1de', fg: '#7f1d1d' },
}

function fmtDateFR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/* Photos conservées en entier ; les observations passent à la page suivante si nécessaire. */
const PHOTO_W = 210
const PHOTO_H = 118

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingTop: 91,
    paddingBottom: 48,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.text,
    backgroundColor: '#edf4fc',
    lineHeight: 1.45,
  },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 77,
    backgroundColor: C.navy, paddingHorizontal: 32, paddingTop: 17, paddingBottom: 13,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 5, borderBottomColor: C.red,
  },
  firmName: { color: C.white, fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  firmTag:  { color: '#dbe4f3', fontSize: 8, marginTop: 1 },
  headerRight: { alignItems: 'flex-end', maxWidth: '43%' },
  headerMeta:     { color: '#dbe4f3', fontSize: 7, marginBottom: 1 },
  headerMetaBold: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },

  content: { paddingHorizontal: 32, paddingTop: 0, paddingBottom: 4 },

  titleBlock: { marginBottom: 10 },
  titleRedBar: { height: 3, width: 44, backgroundColor: C.red, marginBottom: 6 },
  titleMain: { color: C.navy, fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  titleSub:  { color: C.muted, fontSize: 8, marginTop: 3 },

  /* Page de garde */
  coverWrap: { paddingTop: 8, marginBottom: 18 },
  coverRedBar: { height: 4, width: 72, backgroundColor: C.red, marginBottom: 14 },
  coverTitle: {
    color: C.navy, fontSize: 28, fontFamily: 'Helvetica-Bold',
    textAlign: 'left', lineHeight: 1.12,
  },
  coverSub: { color: C.muted, fontSize: 9, marginTop: 8 },
  coverClientBox: {
    width: '100%', borderRadius: 10, borderLeftWidth: 5, borderLeftColor: C.red,
    backgroundColor: C.navy, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 12,
  },
  coverClientLabel: {
    color: C.muted, fontSize: 7.5, textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginBottom: 6,
  },
  coverClientName: {
    color: C.white, fontSize: 16, fontFamily: 'Helvetica-Bold',
    textAlign: 'left', marginBottom: 4,
  },
  coverClientAddr: { color: C.white, fontSize: 10, textAlign: 'left', marginBottom: 2 },
  coverMapBox: {
    width: '100%', borderWidth: 1, borderColor: C.border,
    marginBottom: 12, borderRadius: 10, overflow: 'hidden',
  },
  coverMapImg: { width: '100%', height: 150, objectFit: 'contain' },
  coverMapCap: {
    color: C.muted, fontSize: 7, textAlign: 'center',
    paddingVertical: 4, backgroundColor: C.rowAlt,
  },
  coverMapFallback: {
    width: '100%', height: 100, backgroundColor: C.rowAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
  },
  coverMapFallbackTxt: { color: C.muted, fontSize: 9 },
  coverMetaHint: { color: C.muted, fontSize: 8, marginTop: 4, textAlign: 'center' },

  schemaBox: {
    width: '100%', borderWidth: 1, borderColor: C.border,
    borderRadius: 10, overflow: 'hidden', backgroundColor: C.white, marginBottom: 8,
  },
  schemaImg: { width: '100%', height: 320, objectFit: 'contain' },
  schemaLegendRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderWidth: 1, borderColor: C.border, borderRadius: 7,
    paddingVertical: 7, paddingHorizontal: 8, marginBottom: 6, backgroundColor: C.white,
  },
  schemaLegendNum: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  schemaLegendNumTxt: { color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  schemaLegendTitle: { color: C.navy, fontSize: 8.5, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  schemaLegendDesc: { color: C.muted, fontSize: 7.5 },

  metaTable: {
    flexDirection: 'row', borderRadius: 8,
    marginBottom: 12, backgroundColor: C.navy,
  },
  metaCell: {
    width: '25%', paddingVertical: 10, paddingHorizontal: 9,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaLabel: { color: '#dbe4f3', fontSize: 6.5, textTransform: 'uppercase' },
  metaValue: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8, marginTop: 2 },

  etatBox: {
    borderRadius: 8, borderLeftWidth: 5,
    paddingVertical: 11, paddingHorizontal: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  etatLbl: { color: C.white, fontSize: 7, textTransform: 'uppercase' },
  etatVal: { fontFamily: 'Helvetica-Bold', fontSize: 10, maxWidth: '66%', textAlign: 'right' },

  sectionTitle: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 12,
    backgroundColor: C.navy, borderRadius: 7,
    padding: 10, marginBottom: 10,
  },

  partyTable: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  partyCol: { width: '50%', padding: 7 },
  partyColSep: { borderRightWidth: 1, borderRightColor: C.border },
  partyHead: {
    color: C.navy, fontSize: 7, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', marginBottom: 3,
  },
  partyName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 1 },
  partyLine: { color: C.text, fontSize: 8, marginBottom: 1 },

  /* Grille 2 colonnes — compacte */
  kvGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: C.white, borderRadius: 8, marginBottom: 12,
  },
  kvCell: {
    width: '50%', flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: C.border,
    borderRightWidth: 1, borderRightColor: C.border,
    minHeight: 18,
  },
  kvLabel: {
    width: '40%', paddingVertical: 5, paddingHorizontal: 5,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 7.5,
    backgroundColor: C.rowAlt,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  kvValue: {
    width: '60%', paddingVertical: 5, paddingHorizontal: 5,
    color: C.text, fontSize: 8,
  },

  /* Observation : texte | photo côte à côte */
  obsItem: {
    borderWidth: 1, borderColor: '#dbe4f3', borderRadius: 8, marginBottom: 10,
    backgroundColor: C.white, overflow: 'hidden',
  },
  obsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7, paddingHorizontal: 8,
    backgroundColor: C.navy, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  obsHeaderLeft: { flexDirection: 'row', alignItems: 'center', width: '54%' },
  obsNum: {
    backgroundColor: C.red, color: C.white,
    paddingVertical: 1, paddingHorizontal: 4, marginRight: 5,
    fontFamily: 'Helvetica-Bold', fontSize: 7.5,
  },
  obsPos: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9, flex: 1 },
  obsCode: {
    paddingVertical: 1, paddingHorizontal: 4, maxWidth: '43%',
    fontFamily: 'Helvetica-Bold', fontSize: 7,
  },
  obsRow: { flexDirection: 'row', padding: 9 },
  obsTextCol: { flex: 1, paddingRight: 10 },
  obsPhotoCol: { width: PHOTO_W, alignItems: 'center' },
  obsMetaLine: { color: C.muted, fontSize: 7, marginBottom: 1 },
  obsMetaStrong: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  obsDesc: { color: C.text, fontSize: 9, marginTop: 1, lineHeight: 1.3 },
  obsPhotoImg: { width: PHOTO_W, height: PHOTO_H, objectFit: 'contain' },
  obsPhotoCap: { color: C.muted, fontSize: 6.5, textAlign: 'center', marginTop: 1 },

  precoBox: {
    backgroundColor: C.red, borderRadius: 8,
    borderLeftWidth: 4, borderLeftColor: '#8f291f', padding: 11, marginBottom: 10, marginTop: 2,
  },
  precoTitle: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 10,
    textTransform: 'uppercase', marginBottom: 2,
  },
  precoItem: { marginBottom: 7 },
  precoItemTitle: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 1 },
  precoItemDetail: { color: C.white, fontSize: 9, lineHeight: 1.25 },

  resumeBox: {
    backgroundColor: C.navy, borderRadius: 8,
    borderLeftWidth: 4, borderLeftColor: C.red, padding: 11, marginBottom: 12,
  },
  resumeTitle: {
    color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 10,
    textTransform: 'uppercase', marginBottom: 2,
  },
  resumeText: { color: C.text, fontSize: 9, lineHeight: 1.3 },

  glossBox: {
    backgroundColor: C.blueSoft, borderWidth: 1, borderColor: C.blueBorder,
    padding: 12, marginTop: 6, borderRadius: 8,
  },
  glossTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8,
    textTransform: 'uppercase', marginBottom: 4,
  },
  glossRow: { flexDirection: 'row', marginBottom: 6 },
  glossTerme: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8, width: '24%', paddingRight: 8 },
  glossDef:  { width: '76%', color: C.text, fontSize: 8, lineHeight: 1.3 },

  /* Footer fixe en bas — évite la page blanche orpheline */
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 28,
    right: 28,
    paddingTop: 4,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerL: { color: C.muted, fontSize: 6.5, lineHeight: 1.3, width: 380 },
  footerR: { color: C.muted, fontSize: 6.5, textAlign: 'right', width: 100 },

  introNote: { color: C.muted, fontSize: 8, marginTop: 6, lineHeight: 1.35 },
})

/* ============ COMPONENTS ============ */
/** Motif de fond hors flux : répété aussi sur les pages de continuation.
 * Le logo embarqué est réutilisé sans requête réseau ; les cartes restent opaques.
 */
const PageWatermark = () => (
  <View
    fixed
    style={{ position: 'absolute', top: 0, left: 0, width: 595.28, height: 841.89 }}
  >
    {Array.from({ length: 15 }, (_, row) =>
      Array.from({ length: 8 }, (_, col) => (
        <Image
          key={`${row}-${col}`}
          src={INSPECTION_LOGO}
          style={{
            position: 'absolute',
            top: 90 + row * 48,
            left: 21 + col * 72 + (row % 2) * 28,
            width: 24,
            height: 24,
            opacity: 0.12,
          }}
        />
      ))
    )}
  </View>
)


const Header = () => (
  <View style={s.header} fixed>
    <View>
      <Text style={s.firmName}>Les Techniciens du Débouchage</Text>
      <Text style={s.firmTag}>Comprendre votre réseau. Préparer la suite.</Text>
    </View>
    <View style={s.headerRight}>
      <Text style={s.headerMetaBold}>LTDB / INSPECTION CAMÉRA</Text>
      <Text style={s.headerMeta}>700 Av. du 15ème Corps · 83000 Toulon</Text>
      <Text style={s.headerMeta}>Tél. {TEL_PRINCIPAL_FALLBACK}</Text>
    </View>
  </View>
)

const Footer = ({ numero, pageLabel }: { numero: string; pageLabel?: string }) => (
  <View style={s.footer} fixed>
    <Text style={s.footerL}>
      LTDB · ITV {numero} · contact@lestechniciensdudebouchage.fr · {TEL_PRINCIPAL_FALLBACK}
    </Text>
    {pageLabel ? <Text style={s.footerR}>{pageLabel}</Text> : null}
  </View>
)

function Kv({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <View style={s.kvCell}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue}>{value}</Text>
    </View>
  )
}

function isImageSrc(url?: string): url is string {
  return typeof url === 'string'
    && (url.startsWith('data:') || url.startsWith('http'))
}

function IntroBlock({ data, etat, tronconCount }: {
  data: InspectionData
  etat: { label: string; bg: string; fg: string }
  tronconCount: number
}) {
  const adresseLigne = [
    data.client.adresse,
    [data.client.codePostal, data.client.ville].filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ')

  const coverSrc = isImageSrc(data.coverPhotoUrl) ? data.coverPhotoUrl : INSPECTION_LOGO
  const hasCoverPhoto = coverSrc !== INSPECTION_LOGO
  const coverCaption = hasCoverPhoto ? 'Photo de présentation' : 'Les Techniciens du Débouchage'

  return (
    <>
      {/* Page de garde : titre + client + photo dédiée (ou logo LTDB) */}
      <View style={s.coverWrap} wrap={false}>
        <Text style={s.coverClientLabel}>LTDB / DIAGNOSTIC DU RÉSEAU</Text>
        <View style={s.coverRedBar} />
        <Text style={s.coverTitle}>Rapport d&apos;inspection caméra</Text>
        <Text style={s.coverSub}>Votre réseau en images, les constats et les actions à prévoir.</Text>
      </View>

      <View style={s.coverClientBox} wrap={false}>
        <Text style={[s.coverClientLabel, { color: "#dbe4f3" }]}>Votre intervention</Text>
        <Text style={s.coverClientName}>{data.client.nom || '—'}</Text>
        {adresseLigne ? <Text style={s.coverClientAddr}>{adresseLigne}</Text> : null}
      </View>

      <View style={s.coverMapBox} wrap={false}>
        <Image src={coverSrc} style={s.coverMapImg} />
        <Text style={s.coverMapCap}>{coverCaption}</Text>
      </View>

      <View style={s.metaTable} wrap={false}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>N° rapport</Text>
          <Text style={s.metaValue}>{data.numero}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Date</Text>
          <Text style={s.metaValue}>{fmtDateFR(data.dateInspection)}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Technicien</Text>
          <Text style={s.metaValue}>{data.technicienNom || '—'}</Text>
        </View>
        <View style={[s.metaCell, s.metaCellLast]}>
          <Text style={s.metaLabel}>Agence</Text>
          <Text style={s.metaValue}>{data.agence || 'LTDB'}</Text>
        </View>
      </View>

      <View style={[s.etatBox, { backgroundColor: etat.fg, borderLeftColor: etat.fg }]} wrap={false}>
        <Text style={s.etatLbl}>{tronconCount > 1 ? 'Conclusion globale' : 'Conclusion'}</Text>
        <Text style={[s.etatVal, { color: C.white }]}>{etat.label}</Text>
      </View>

      {data.troncons.length > 0 ? (
        <View style={s.resumeBox}>
          <Text style={s.resumeTitle}>Votre inspection en un regard</Text>
          {data.troncons.map((bloc, i) => (
            <View key={i} style={s.precoItem} wrap={false}>
              <Text style={s.precoItemTitle}>{String(i + 1).padStart(2, '0')} / {bloc.nom || 'Tronçon inspecté'}</Text>
              <Text style={[s.resumeText, { color: C.white }]}>{ETAT_LABEL[bloc.conclusionEtat].label} · {bloc.observations.length} observation(s) · {bloc.preconisations.length} action(s) renseignée(s)</Text>
            </View>
          ))}
        </View>
      ) : null}

      {tronconCount > 0 ? (
        <Text style={s.introNote}>
          {tronconCount} tronçon{tronconCount > 1 ? 's' : ''} - retrouvez les observations et les photos dans les pages suivantes.
        </Text>
      ) : null}
    </>
  )
}

function TronconBlock({
  bloc,
  ti,
  total,
  codeStyle,
}: {
  bloc: TronconBloc
  ti: number
  total: number
  codeStyle: (g: number) => Style
}) {
  const t = bloc.caracteristiques || {}
  const titre = bloc.nom?.trim() || (total > 1 ? `Tronçon ${ti + 1}` : 'Tronçon inspecté')
  const etatTronc = ETAT_LABEL[bloc.conclusionEtat]

  return (
    <View>
      {/* En-tête tronçon + tableau : restent ensemble */}
      <View wrap={false}>
        <Text style={s.sectionTitle}>
          {total > 1 ? `${ti + 1}. ${titre}` : titre}
        </Text>

        <View style={[s.etatBox, { backgroundColor: etatTronc.fg, borderLeftColor: etatTronc.fg, marginBottom: 10 }]}>
          <Text style={s.etatLbl}>Conclusion</Text>
          <Text style={[s.etatVal, { color: C.white }]}>{etatTronc.label}</Text>
        </View>

        <View style={s.kvGrid}>
          <Kv label="Réseau" value={t.reseau} />
          <Kv label="Matériau" value={t.materiau} />
          <Kv label="Diamètre" value={t.diametre} />
          <Kv label="Linéaire" value={t.longueurM != null ? `${t.longueurM} m` : undefined} />
          <Kv label="Amont" value={t.regardAmont} />
          <Kv label="Aval" value={t.regardAval} />
          <Kv label="Sens" value={t.sensInspection} />
          <Kv label="Matériel" value={t.materielUtilise} />
          {t.conditionsMeteo ? <Kv label="Conditions" value={t.conditionsMeteo} /> : null}
        </View>
      </View>

      {bloc.resume ? (
        <View style={s.resumeBox} wrap={false}>
          <Text style={s.resumeTitle}>À retenir sur ce tronçon</Text>
          <Text style={[s.resumeText, { color: C.white }]}>{bloc.resume}</Text>
        </View>
      ) : null}

      <Text style={s.glossTitle}>Constats et photos / {bloc.observations.length} observation(s)</Text>
      {bloc.observations.length === 0 ? <Text style={s.introNote}>Aucune observation renseignée pour ce tronçon.</Text> : null}
      {bloc.observations.map((o, i) => {
        const def = findDefaut(o.code || '')
        const grav = def ? def.gravite : 1
        const photoSrc = typeof o.photoUrl === 'string'
          && (o.photoUrl.startsWith('data:') || o.photoUrl.startsWith('http'))
          ? o.photoUrl
          : null
        const desc = (o.description || '').trim()
        const gravLabel = GRAVITE_LABELS[grav]?.label

        return (
          <View key={i} style={s.obsItem} wrap={false}>
            <View style={s.obsHeader}>
              <View style={s.obsHeaderLeft}>
                <Text style={s.obsNum}>{`OBS ${String(i + 1).padStart(2, '0')}`}</Text>
                <Text style={s.obsPos}>{o.position || `Point ${i + 1}`}</Text>
              </View>
              {def ? (
                <Text style={[s.obsCode, codeStyle(grav)]}>
                  {def.code} · {def.libelle}
                </Text>
              ) : null}
            </View>
            <View style={s.obsRow}>
              <View style={s.obsTextCol}>
                {def ? (
                  <Text style={s.obsMetaLine}>
                    {def.categorie} · {gravLabel || ''}
                  </Text>
                ) : null}
                {desc ? <Text style={s.obsDesc}>{desc}</Text> : null}
                {!desc && !def ? (
                  <Text style={s.obsMetaLine}>Aucune description</Text>
                ) : null}
              </View>
              {photoSrc ? (
                <View style={s.obsPhotoCol}>
                  <Image src={photoSrc} style={s.obsPhotoImg} />
                  <Text style={s.obsPhotoCap}>
                    {o.photoLegende || `Photo ${i + 1}`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )
      })}

      {bloc.preconisations.length > 0 && (
        <View style={s.precoBox}>
          <Text style={s.precoTitle}>Les actions à prévoir</Text>
          {bloc.preconisations.map((p, i) => (
            <View key={i} style={s.precoItem} wrap={false}>
              <Text style={s.precoItemTitle}>{String(i + 1).padStart(2, "0")} / {p.titre}</Text>
              {p.urgence ? <Text style={[s.obsMetaStrong, { color: C.white }]}>Priorité indiquée : {p.urgence}</Text> : null}
              <Text style={s.precoItemDetail}>{p.detail}</Text>
            </View>
          ))}
        </View>
      )}


    </View>
  )
}

function SchemaBlock({ data }: { data: InspectionData }) {
  const markers = data.schemaMarkers || []
  const hasImg = isImageSrc(data.schemaReseauUrl)
  return (
    <View>
      <View style={s.titleBlock}>
        <View style={s.titleRedBar} />
        <Text style={s.titleMain}>Schéma du réseau</Text>
        <Text style={s.titleSub}>
          Représentation schématique du sens du réseau et localisation des anomalies constatées.
        </Text>
      </View>
      {hasImg ? (
        <View style={s.schemaBox} wrap={false}>
          <Image src={data.schemaReseauUrl!} style={s.schemaImg} />
        </View>
      ) : (
        <View style={s.coverMapFallback}>
          <Text style={s.coverMapFallbackTxt}>Schéma non renseigné</Text>
        </View>
      )}
      {markers.length > 0 ? (
        <View style={{ marginTop: 10 }}>
          <Text style={s.sectionTitle}>Légende des anomalies</Text>
          {markers.map(m => (
            <View key={m.id} style={s.schemaLegendRow} wrap={false}>
              <View style={s.schemaLegendNum}>
                <Text style={s.schemaLegendNumTxt}>{m.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.schemaLegendTitle}>
                  {m.label}{m.code ? ` · ${m.code}` : ''}{m.hasPhoto ? ' · photo' : ''}
                </Text>
                <Text style={s.schemaLegendDesc}>
                  {m.description || '—'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function ReadingGuide() {
  return (
            <View style={s.glossBox}>
              <Text style={s.sectionTitle}>Les clés pour lire votre rapport</Text>
              <Text style={s.resumeText}>Chaque observation associe un repère dans la canalisation, un constat et, lorsqu’elle est disponible, une photo. Les actions proposées figurent après les constats de chaque tronçon.</Text>
              <Text style={[s.glossTitle, { marginTop: 14 }]}>Les niveaux de conclusion</Text>
              {Object.values(ETAT_LABEL).map(e => (
                <View key={e.label} style={[s.etatBox, { backgroundColor: e.fg, borderLeftColor: e.fg }]} wrap={false}>
                  <Text style={[s.etatVal, { color: C.white, maxWidth: '100%', textAlign: 'left' }]}>{e.label}</Text>
                </View>
              ))}
              <Text style={s.glossTitle}>Le vocabulaire technique</Text>
              {GLOSSAIRE.map(g => (
                <View key={g.terme} style={s.glossRow} wrap={false}>
                  <Text style={s.glossTerme}>{g.terme}</Text>
                  <Text style={s.glossDef}>{g.def}</Text>
                </View>
              ))}
            </View>
  )
}

/* ============ DOCUMENT ============ */
export function InspectionDocument({
  data,
  variant = 'full',
  tronconIndex,
  tronconTotal,
}: InspectionPDFProps) {
  const troncons = data.troncons?.length ? data.troncons : []
  const conclusionGlobale = data.conclusionEtat
    || worstConclusion(troncons.map(t => t.conclusionEtat))
  const etat = ETAT_LABEL[conclusionGlobale]

  const codeStyle = (gravite: number): Style => {
    const g = GRAVITE_LABELS[gravite] || GRAVITE_LABELS[1]
    return { backgroundColor: g.color, color: '#fff' }
  }

  const total = tronconTotal ?? troncons.length
  const pageLabel = variant === 'troncon' && tronconIndex != null && total > 0
    ? `Tronçon ${tronconIndex}/${total}`
    : variant === 'intro'
      ? 'Couverture'
      : variant === 'schema'
        ? 'Schéma réseau'
      : variant === 'glossaire'
        ? 'Guide de lecture'
        : undefined

  if (variant === 'intro') {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          <PageWatermark />
          <Header />
          <View style={s.content}>
            <IntroBlock data={data} etat={etat} tronconCount={total || troncons.length} />
          </View>
          <Footer numero={data.numero} pageLabel={pageLabel} />
        </Page>
      </Document>
    )
  }

  if (variant === 'schema') {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          <PageWatermark />
          <Header />
          <View style={s.content}>
            <SchemaBlock data={data} />
          </View>
          <Footer numero={data.numero} pageLabel={pageLabel} />
        </Page>
      </Document>
    )
  }

  if (variant === 'glossaire') {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          <PageWatermark />
          <Header />
          <View style={s.content}>
            <ReadingGuide />
          </View>
          <Footer numero={data.numero} pageLabel={pageLabel} />
        </Page>
      </Document>
    )
  }

  if (variant === 'troncon') {
    return (
      <Document>
        <Page size="A4" style={s.page} wrap>
          <PageWatermark />
          <Header />
          <View style={s.content}>
            {troncons.map((bloc, i) => (
              <TronconBlock
                key={i}
                bloc={bloc}
                ti={(tronconIndex ?? 1) - 1}
                total={total || 1}
                codeStyle={codeStyle}
              />
            ))}
          </View>
          <Footer numero={data.numero} pageLabel={pageLabel} />
        </Page>
      </Document>
    )
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PageWatermark />
          <Header />
        <View style={s.content}>
          <IntroBlock data={data} etat={etat} tronconCount={troncons.length} />
        </View>
        <Footer numero={data.numero} pageLabel="Couverture" />
      </Page>
      {troncons.map((bloc, ti) => (
        <Page key={ti} size="A4" style={s.page} wrap>
          <PageWatermark />
          <Header />
          <View style={s.content}>
            <TronconBlock bloc={bloc} ti={ti} total={troncons.length} codeStyle={codeStyle} />
          </View>
          <Footer numero={data.numero} pageLabel={`Tronçon ${ti + 1}/${troncons.length}`} />
        </Page>
      ))}
      {isImageSrc(data.schemaReseauUrl) ? (
        <Page size="A4" style={s.page}>
          <PageWatermark />
          <Header />
          <View style={s.content}>
            <SchemaBlock data={data} />
          </View>
          <Footer numero={data.numero} pageLabel="Schéma réseau" />
        </Page>
      ) : null}
      <Page size="A4" style={s.page}>
        <PageWatermark />
          <Header />
        <View style={s.content}><ReadingGuide /></View>
        <Footer numero={data.numero} pageLabel="Guide de lecture" />
      </Page>
    </Document>
  )
}

interface DownloadButtonProps extends InspectionPDFProps {
  filename?: string
  className?: string
  label?: string
}

export default function InspectionDownloadButton(props: DownloadButtonProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const filename = props.filename
    || `inspection-camera-${(props.data.client.nom || 'client').toLowerCase().replace(/\s+/g, '-')}-${props.data.numero}.pdf`

  async function handleDownload() {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      // Même présentation LTDB pour téléchargement, aperçu et envoi
      const { buildInspectionPdfBlob } = await import('@/lib/build-inspection-pdf')
      const blob = await buildInspectionPdfBlob(props.data)
      if (!blob || blob.size < 500) throw new Error('PDF vide — réessaie dans quelques secondes')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      console.error('[InspectionDownload]', e)
      setError(e instanceof Error ? e.message : 'Erreur génération PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={props.className || "bg-blue-800 text-white px-4 py-2 rounded-lg hover:bg-blue-900 disabled:opacity-50 font-semibold"}
      >
        {loading ? 'Préparation PDF…' : (props.label || '📄 Télécharger le PDF')}
      </button>
      {error ? <span className="text-[11px] text-red-200 font-medium max-w-[16rem]">{error}</span> : null}
    </div>
  )
}

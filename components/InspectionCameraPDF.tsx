'use client'
import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import { GRAVITE_LABELS, GLOSSAIRE, findDefaut } from "@/lib/camera-defauts"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/* ============ CHARTE ============ */
const C = {
  navy: '#0f2e5c',
  navyDark: '#0a2047',
  navyMid: '#25477f',
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
  troncons: TronconBloc[]
  conclusionEtat: ConclusionEtat
}

/** Parts générées séparément puis fusionnées (évite plantage react-pdf multi-photos). */
export type InspectionPDFVariant = 'full' | 'intro' | 'troncon' | 'glossaire'

const ETAT_SEVERITY: Record<ConclusionEtat, number> = {
  bon: 0,
  'a-surveiller': 1,
  desordre: 2,
  critique: 3,
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
  /** intro = couverture ; troncon = un/plusieurs tronçons sans couverture ; glossaire ; full = tout */
  variant?: InspectionPDFVariant
  /** Index affiché (ex. 1/5) quand variant=troncon */
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

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 28,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.4,
  },

  header: {
    paddingHorizontal: 40, paddingTop: 16, paddingBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    backgroundColor: C.white,
    borderBottomWidth: 3, borderBottomColor: C.navy,
    marginBottom: 6,
  },
  firmName: { color: C.navy, fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, textTransform: 'uppercase' },
  firmTag:  { color: C.muted, fontSize: 7.5, marginTop: 2 },
  headerRight: { alignItems: 'flex-end', maxWidth: 220 },
  headerMeta:     { color: C.muted, fontSize: 7.5, marginBottom: 1 },
  headerMetaBold: { color: C.navy,  fontFamily: 'Helvetica-Bold', fontSize: 8 },

  content: { paddingHorizontal: 40, paddingTop: 6, paddingBottom: 8 },

  titleBlock: { marginBottom: 14 },
  titleRedBar: { height: 4, width: 56, backgroundColor: C.red, marginBottom: 8 },
  titleMain: { color: C.navy, fontSize: 16, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  titleSub:  { color: C.muted, fontSize: 9, marginTop: 4 },

  metaTable: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.border,
    marginBottom: 12, backgroundColor: C.rowAlt,
  },
  metaCell: {
    width: '25%', paddingVertical: 8, paddingHorizontal: 8,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaLabel: { color: C.muted, fontSize: 7, textTransform: 'uppercase' },
  metaValue: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginTop: 3 },

  etatBox: {
    borderWidth: 1, borderColor: C.border, borderRadius: 4,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  etatLbl: { color: C.muted, fontSize: 7.5, textTransform: 'uppercase' },
  etatVal: { fontFamily: 'Helvetica-Bold', fontSize: 11 },

  sectionTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 11,
    textTransform: 'uppercase',
    paddingBottom: 4, marginBottom: 8, marginTop: 2,
    borderBottomWidth: 1, borderBottomColor: C.navy,
  },

  partyTable: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  partyCol: { width: '50%', padding: 10 },
  partyColSep: { borderRightWidth: 1, borderRightColor: C.border },
  partyHead: {
    color: C.navy, fontSize: 8, fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase', marginBottom: 4,
  },
  partyName: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  partyLine: { color: C.text, fontSize: 9, marginBottom: 1 },

  troncTable: { borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  troncRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border,
    minHeight: 22,
  },
  troncRowAlt: { backgroundColor: C.rowAlt },
  troncLabel: {
    width: 150, paddingVertical: 5, paddingHorizontal: 8,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8.5,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  troncValue: {
    width: 325, paddingVertical: 5, paddingHorizontal: 8,
    color: C.text, fontSize: 9,
  },

  obsItem: {
    borderWidth: 1, borderColor: C.border, marginBottom: 10,
    backgroundColor: C.white,
  },
  obsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 5, paddingHorizontal: 8,
    backgroundColor: C.rowAlt, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  obsHeaderLeft: { flexDirection: 'row', alignItems: 'center', width: 260 },
  obsNum: {
    backgroundColor: C.navy, color: C.white,
    paddingVertical: 2, paddingHorizontal: 5, marginRight: 6,
    fontFamily: 'Helvetica-Bold', fontSize: 8,
  },
  obsPos: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9, width: 190 },
  obsCode: {
    paddingVertical: 2, paddingHorizontal: 5, maxWidth: 190,
    fontFamily: 'Helvetica-Bold', fontSize: 7.5,
  },
  obsBody: { padding: 8 },
  obsCodeBlock: { marginBottom: 4 },
  obsCodeLine: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 },
  obsCodeKey: { color: C.muted, fontSize: 7.5, textTransform: 'uppercase', width: 72 },
  obsCodeVal: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 8.5, width: 370 },
  obsDesc: { color: C.text, fontSize: 9, marginTop: 3, lineHeight: 1.4 },
  obsPhotoWrap: {
    marginTop: 6, borderWidth: 1, borderColor: C.border,
    padding: 4, alignItems: 'center',
  },
  // ~16:9 — assez haut pour ne pas écraser la vue caméra
  obsPhotoImg: { width: 470, height: 195 },
  obsPhotoCap: { color: C.muted, fontSize: 7.5, textAlign: 'center', marginTop: 3 },

  precoBox: {
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBorder,
    borderLeftWidth: 4, padding: 10, marginBottom: 10,
  },
  precoTitle: {
    color: C.greenDark, fontFamily: 'Helvetica-Bold', fontSize: 9,
    textTransform: 'uppercase', marginBottom: 6,
  },
  precoItem: { marginBottom: 6 },
  precoItemTitle: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 9.5, marginBottom: 2 },
  precoItemDetail: { color: C.text, fontSize: 9, lineHeight: 1.4 },
  precoItemUrgence: {
    color: C.muted, fontSize: 7.5, textTransform: 'uppercase', marginTop: 2,
  },

  resumeBox: {
    backgroundColor: C.yellowSoft, borderWidth: 1, borderColor: C.yellowBorder,
    borderLeftWidth: 4, padding: 10, marginBottom: 10,
  },
  resumeTitle: {
    color: C.yellowDark, fontFamily: 'Helvetica-Bold', fontSize: 9,
    textTransform: 'uppercase', marginBottom: 4,
  },
  resumeText: { color: C.text, fontSize: 9.5, lineHeight: 1.45 },

  glossBox: {
    backgroundColor: C.blueSoft, borderWidth: 1, borderColor: C.blueBorder,
    padding: 10, marginBottom: 6,
  },
  glossTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 9,
    textTransform: 'uppercase', marginBottom: 6,
  },
  glossRow: { flexDirection: 'row', marginBottom: 3 },
  glossTerme: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8, width: 90 },
  glossDef:  { width: 385, color: C.text, fontSize: 8, lineHeight: 1.35 },

  footer: {
    paddingHorizontal: 40, paddingTop: 8, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: C.border,
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 10,
  },
  footerL: { color: C.muted, fontSize: 7, lineHeight: 1.35, width: 360 },
  footerR: { color: C.muted, fontSize: 7, textAlign: 'right', width: 120 },

  introNote: { color: C.muted, fontSize: 9, marginTop: 8, lineHeight: 1.45 },
})

/* ============ COMPONENTS ============ */
const Header = () => (
  <View style={s.header}>
    <View>
      <Text style={s.firmName}>Les Techniciens du Débouchage</Text>
      <Text style={s.firmTag}>Inspection télévisée des canalisations · ITV · NF EN 13508-2</Text>
    </View>
    <View style={s.headerRight}>
      <Text style={s.headerMetaBold}>Rapport d&apos;inspection caméra</Text>
      <Text style={s.headerMeta}>700 Av. du 15ème Corps · 83000 Toulon</Text>
      <Text style={s.headerMeta}>Tél. {TEL_PRINCIPAL_FALLBACK}</Text>
    </View>
  </View>
)

const Footer = ({ numero, pageLabel }: { numero: string; pageLabel?: string }) => (
  <View style={s.footer}>
    <View>
      <Text style={s.footerL}>LTDB · Rapport ITV {numero}</Text>
      <Text style={s.footerL}>contact@lestechniciensdudebouchage.fr · {TEL_PRINCIPAL_FALLBACK}</Text>
    </View>
    {pageLabel ? <Text style={s.footerR}>{pageLabel}</Text> : null}
  </View>
)

function TroncRow({ label, value, alt }: { label: string; value: string; alt?: boolean }) {
  if (!value) return null
  return (
    <View style={alt ? [s.troncRow, s.troncRowAlt] : s.troncRow} wrap={false}>
      <Text style={s.troncLabel}>{label}</Text>
      <Text style={s.troncValue}>{value}</Text>
    </View>
  )
}

function IntroBlock({ data, etat, tronconCount }: {
  data: InspectionData
  etat: { label: string; bg: string; fg: string }
  tronconCount: number
}) {
  return (
    <>
      <View style={s.titleBlock}>
        <View style={s.titleRedBar} />
        <Text style={s.titleMain}>Rapport d&apos;inspection caméra</Text>
        <Text style={s.titleSub}>Inspection télévisée (ITV) — codification NF EN 13508-2</Text>
      </View>

      <View style={s.metaTable} wrap={false}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>N° rapport</Text>
          <Text style={s.metaValue}>{data.numero}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Date d&apos;inspection</Text>
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

      <View style={[s.etatBox, { backgroundColor: etat.bg }]} wrap={false}>
        <Text style={s.etatLbl}>{tronconCount > 1 ? 'Conclusion globale' : 'Conclusion'}</Text>
        <Text style={[s.etatVal, { color: etat.fg }]}>{etat.label}</Text>
      </View>

      <View style={s.partyTable} wrap={false}>
        <View style={[s.partyCol, s.partyColSep]}>
          <Text style={s.partyHead}>ÉMETTEUR</Text>
          <Text style={s.partyName}>Les Techniciens du Débouchage</Text>
          <Text style={s.partyLine}>700 Avenue du 15ème Corps</Text>
          <Text style={s.partyLine}>83000 Toulon</Text>
          <Text style={s.partyLine}>Tél. {TEL_PRINCIPAL_FALLBACK}</Text>
          <Text style={s.partyLine}>contact@lestechniciensdudebouchage.fr</Text>
        </View>
        <View style={s.partyCol}>
          <Text style={s.partyHead}>CLIENT</Text>
          <Text style={s.partyName}>{data.client.nom || '—'}</Text>
          {data.client.adresse ? <Text style={s.partyLine}>{data.client.adresse}</Text> : null}
          {(data.client.codePostal || data.client.ville) ? (
            <Text style={s.partyLine}>{[data.client.codePostal, data.client.ville].filter(Boolean).join(' ')}</Text>
          ) : null}
          {data.client.telephone ? <Text style={s.partyLine}>Tél. {data.client.telephone}</Text> : null}
          {data.client.email ? <Text style={s.partyLine}>{data.client.email}</Text> : null}
        </View>
      </View>

      {tronconCount > 0 ? (
        <Text style={s.introNote}>
          {tronconCount} tronçon{tronconCount > 1 ? 's' : ''} détaillé{tronconCount > 1 ? 's' : ''} en page{tronconCount > 1 ? 's' : ''} suivante{tronconCount > 1 ? 's' : ''} (un tronçon par page).
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
      <Text style={s.sectionTitle}>
        {total > 1 ? `${ti + 1}. ${titre}` : `Caractéristiques du ${titre.toLowerCase()}`}
      </Text>

      {total > 1 && (
        <View style={[s.etatBox, { backgroundColor: etatTronc.bg, marginBottom: 10 }]} wrap={false}>
          <Text style={s.etatLbl}>Conclusion tronçon</Text>
          <Text style={[s.etatVal, { color: etatTronc.fg }]}>{etatTronc.label}</Text>
        </View>
      )}

      <View style={s.troncTable} wrap={false}>
        <TroncRow label="Type de réseau" value={t.reseau || ''} alt />
        <TroncRow label="Matériau" value={t.materiau || ''} />
        <TroncRow label="Diamètre (DN)" value={t.diametre || ''} alt />
        <TroncRow label="Linéaire inspecté" value={t.longueurM ? `${t.longueurM} m` : ''} />
        <TroncRow label="Regard amont" value={t.regardAmont || ''} alt />
        <TroncRow label="Regard aval" value={t.regardAval || ''} />
        <TroncRow label="Sens d'inspection" value={t.sensInspection || ''} alt />
        <TroncRow label="Matériel utilisé" value={t.materielUtilise || ''} />
        <TroncRow label="Conditions" value={t.conditionsMeteo || ''} alt />
      </View>

      {bloc.observations.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { fontSize: 10 }]}>
            Observations{total > 1 ? ` — ${titre}` : ''}
          </Text>
          {bloc.observations.map((o, i) => {
            const def = findDefaut(o.code || '')
            const grav = def ? def.gravite : 1
            const photoSrc = typeof o.photoUrl === 'string'
              && (o.photoUrl.startsWith('data:') || o.photoUrl.startsWith('http'))
              ? o.photoUrl
              : null
            const descLines = (o.description || '').split(/\n+/).map(l => l.trim()).filter(Boolean)
            return (
              // Bloc atomique : texte + photo restent sur la même page (pas de coupe)
              <View key={i} style={s.obsItem} wrap={false} minPresenceAhead={120}>
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
                <View style={s.obsBody}>
                  {def ? (
                    <View style={s.obsCodeBlock}>
                      <View style={s.obsCodeLine}>
                        <Text style={s.obsCodeKey}>Catégorie</Text>
                        <Text style={s.obsCodeVal}>{def.categorie}</Text>
                      </View>
                      <View style={s.obsCodeLine}>
                        <Text style={s.obsCodeKey}>Gravité</Text>
                        <Text style={[s.obsCodeVal, { color: GRAVITE_LABELS[grav].color }]}>
                          {GRAVITE_LABELS[grav].label}
                        </Text>
                      </View>
                      <View style={s.obsCodeLine}>
                        <Text style={s.obsCodeKey}>Définition</Text>
                        <Text style={[s.obsCodeVal, { fontFamily: 'Helvetica' }]}>{def.description}</Text>
                      </View>
                    </View>
                  ) : null}
                  {descLines.map((line, li) => (
                    <Text key={li} style={s.obsDesc}>{line}</Text>
                  ))}
                  {photoSrc ? (
                    <View style={s.obsPhotoWrap}>
                      <Image src={photoSrc} style={s.obsPhotoImg} />
                      <Text style={s.obsPhotoCap}>
                        {o.photoLegende || `Photo ${i + 1}${o.position ? ` — ${o.position}` : ''}`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )
          })}
        </>
      )}

      {bloc.preconisations.length > 0 && (
        <View style={s.precoBox} wrap={false}>
          <Text style={s.precoTitle}>
            Préconisations{total > 1 ? ` — ${titre}` : ''}
          </Text>
          {bloc.preconisations.map((p, i) => (
            <View key={i} style={s.precoItem}>
              <Text style={s.precoItemTitle}>• {p.titre}</Text>
              <Text style={s.precoItemDetail}>{p.detail}</Text>
              {p.urgence ? <Text style={s.precoItemUrgence}>Urgence : {p.urgence}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {bloc.resume ? (
        <View style={s.resumeBox} wrap={false}>
          <Text style={s.resumeTitle}>
            Synthèse{total > 1 ? ` — ${titre}` : ' du technicien'}
          </Text>
          <Text style={s.resumeText}>{bloc.resume}</Text>
        </View>
      ) : null}
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
    ? `Tronçon ${tronconIndex} / ${total}`
    : variant === 'intro'
      ? 'Couverture'
      : variant === 'glossaire'
        ? 'Glossaire'
        : undefined

  if (variant === 'intro') {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          <Header />
          <View style={s.content}>
            <IntroBlock data={data} etat={etat} tronconCount={total || troncons.length} />
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
          <Header />
          <View style={s.content}>
            <View style={s.glossBox}>
              <Text style={s.glossTitle}>Glossaire technique</Text>
              {GLOSSAIRE.map(g => (
                <View key={g.terme} style={s.glossRow} wrap={false}>
                  <Text style={s.glossTerme}>{g.terme}</Text>
                  <Text style={s.glossDef}>{g.def}</Text>
                </View>
              ))}
            </View>
          </View>
          <Footer numero={data.numero} pageLabel={pageLabel} />
        </Page>
      </Document>
    )
  }

  if (variant === 'troncon') {
    // Un Document = un tronçon (peut occuper plusieurs pages internes si beaucoup d'obs)
    // La fusion place chaque Document après le précédent → chaque tronçon commence page neuve.
    return (
      <Document>
        <Page size="A4" style={s.page} wrap>
          <Header />
          <View style={s.content}>
            {troncons.map((bloc, ti) => (
              <TronconBlock
                key={ti}
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

  // full : couverture + tronçons (sans photos lourdes idéalement) + glossaire
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Header />
        <View style={s.content}>
          <IntroBlock data={data} etat={etat} tronconCount={troncons.length} />
        </View>
        <Footer numero={data.numero} pageLabel="Couverture" />
      </Page>

      {troncons.map((bloc, ti) => (
        <Page key={ti} size="A4" style={s.page} wrap>
          <Header />
          <View style={s.content}>
            <TronconBlock
              bloc={bloc}
              ti={ti}
              total={troncons.length}
              codeStyle={codeStyle}
            />
          </View>
          <Footer numero={data.numero} pageLabel={`Tronçon ${ti + 1} / ${troncons.length}`} />
        </Page>
      ))}

      <Page size="A4" style={s.page}>
        <Header />
        <View style={s.content}>
          <View style={s.glossBox}>
            <Text style={s.glossTitle}>Glossaire technique</Text>
            {GLOSSAIRE.map(g => (
              <View key={g.terme} style={s.glossRow} wrap={false}>
                <Text style={s.glossTerme}>{g.terme}</Text>
                <Text style={s.glossDef}>{g.def}</Text>
              </View>
            ))}
          </View>
        </View>
        <Footer numero={data.numero} pageLabel="Glossaire" />
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
      const recupSlug = props.data.numero === 'ITV-20260724-1513'
        ? 'ITV-20260724-1513-mirabella'
        : null
      if (recupSlug) {
        const res = await fetch(`/recup/${recupSlug}.pdf`, { cache: 'no-store' })
        if (res.ok) {
          const blob = await res.blob()
          if (blob.size > 2000) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(url), 2000)
            return
          }
        }
      }

      const { pdfElementToBlob } = await import('@/lib/pdfToBase64')
      const element = React.createElement(InspectionDocument, { data: props.data, variant: 'full' })
      const blob = await pdfElementToBlob(element)
      if (!blob || blob.size < 500) {
        throw new Error('PDF vide — réessaie dans quelques secondes')
      }
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

'use client'
import React from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import { GRAVITE_LABELS, GLOSSAIRE, findDefaut } from "@/lib/camera-defauts"
import { TEL_PRINCIPAL_FALLBACK } from "@/lib/parametres"

/* ============ CHARTE ============ */
const C = {
  navy: '#0f2e5c',
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

export type InspectionPDFVariant = 'full' | 'intro' | 'troncon' | 'glossaire'

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

/* Photo 16:9 compacte — 3 obs + tableau + préco sur 1 page A4 */
const PHOTO_W = 210
const PHOTO_H = 118

/* ============ STYLES ============ */
const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 32,
    paddingHorizontal: 0,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.text,
    backgroundColor: C.white,
    lineHeight: 1.35,
  },

  header: {
    paddingHorizontal: 28, paddingTop: 12, paddingBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 2.5, borderBottomColor: C.navy,
  },
  firmName: { color: C.navy, fontSize: 11, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  firmTag:  { color: C.muted, fontSize: 7, marginTop: 1 },
  headerRight: { alignItems: 'flex-end', maxWidth: 200 },
  headerMeta:     { color: C.muted, fontSize: 7, marginBottom: 1 },
  headerMetaBold: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },

  content: { paddingHorizontal: 28, paddingTop: 10, paddingBottom: 4 },

  titleBlock: { marginBottom: 10 },
  titleRedBar: { height: 3, width: 44, backgroundColor: C.red, marginBottom: 6 },
  titleMain: { color: C.navy, fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  titleSub:  { color: C.muted, fontSize: 8, marginTop: 3 },

  metaTable: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.border,
    marginBottom: 8, backgroundColor: C.rowAlt,
  },
  metaCell: {
    width: '25%', paddingVertical: 5, paddingHorizontal: 6,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  metaCellLast: { borderRightWidth: 0 },
  metaLabel: { color: C.muted, fontSize: 6.5, textTransform: 'uppercase' },
  metaValue: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8, marginTop: 2 },

  etatBox: {
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 5, paddingHorizontal: 8, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  etatLbl: { color: C.muted, fontSize: 7, textTransform: 'uppercase' },
  etatVal: { fontFamily: 'Helvetica-Bold', fontSize: 10 },

  sectionTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 10,
    textTransform: 'uppercase',
    paddingBottom: 3, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: C.navy,
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
    borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  kvCell: {
    width: '50%', flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: C.border,
    borderRightWidth: 1, borderRightColor: C.border,
    minHeight: 18,
  },
  kvLabel: {
    width: 100, paddingVertical: 3, paddingHorizontal: 5,
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 7.5,
    backgroundColor: C.rowAlt,
    borderRightWidth: 1, borderRightColor: C.border,
  },
  kvValue: {
    width: 154, paddingVertical: 3, paddingHorizontal: 5,
    color: C.text, fontSize: 8,
  },

  /* Observation : texte | photo côte à côte */
  obsItem: {
    borderWidth: 1, borderColor: C.border, marginBottom: 5,
    backgroundColor: C.white,
  },
  obsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 2, paddingHorizontal: 5,
    backgroundColor: C.rowAlt, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  obsHeaderLeft: { flexDirection: 'row', alignItems: 'center', width: 290 },
  obsNum: {
    backgroundColor: C.navy, color: C.white,
    paddingVertical: 1, paddingHorizontal: 4, marginRight: 5,
    fontFamily: 'Helvetica-Bold', fontSize: 7.5,
  },
  obsPos: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 8.5, width: 210 },
  obsCode: {
    paddingVertical: 1, paddingHorizontal: 4, maxWidth: 200,
    fontFamily: 'Helvetica-Bold', fontSize: 7,
  },
  obsRow: { flexDirection: 'row', padding: 4 },
  obsTextCol: { width: 290, paddingRight: 5 },
  obsPhotoCol: { width: PHOTO_W + 2, alignItems: 'center' },
  obsMetaLine: { color: C.muted, fontSize: 7, marginBottom: 1 },
  obsMetaStrong: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 7.5 },
  obsDesc: { color: C.text, fontSize: 8, marginTop: 1, lineHeight: 1.3 },
  obsPhotoImg: { width: PHOTO_W, height: PHOTO_H },
  obsPhotoCap: { color: C.muted, fontSize: 6.5, textAlign: 'center', marginTop: 1 },

  precoBox: {
    backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.greenBorder,
    borderLeftWidth: 3, padding: 5, marginBottom: 4, marginTop: 2,
  },
  precoTitle: {
    color: C.greenDark, fontFamily: 'Helvetica-Bold', fontSize: 8,
    textTransform: 'uppercase', marginBottom: 2,
  },
  precoItem: { marginBottom: 2 },
  precoItemTitle: { color: C.text, fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 1 },
  precoItemDetail: { color: C.text, fontSize: 7.5, lineHeight: 1.25 },

  resumeBox: {
    backgroundColor: C.yellowSoft, borderWidth: 1, borderColor: C.yellowBorder,
    borderLeftWidth: 3, padding: 5, marginBottom: 4,
  },
  resumeTitle: {
    color: C.yellowDark, fontFamily: 'Helvetica-Bold', fontSize: 8,
    textTransform: 'uppercase', marginBottom: 2,
  },
  resumeText: { color: C.text, fontSize: 8, lineHeight: 1.3 },

  glossBox: {
    backgroundColor: C.blueSoft, borderWidth: 1, borderColor: C.blueBorder,
    padding: 7, marginTop: 6,
  },
  glossTitle: {
    color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 8,
    textTransform: 'uppercase', marginBottom: 4,
  },
  glossRow: { flexDirection: 'row', marginBottom: 2 },
  glossTerme: { color: C.navy, fontFamily: 'Helvetica-Bold', fontSize: 7, width: 78 },
  glossDef:  { width: 400, color: C.text, fontSize: 7, lineHeight: 1.3 },

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
const Header = () => (
  <View style={s.header}>
    <View>
      <Text style={s.firmName}>Les Techniciens du Débouchage</Text>
      <Text style={s.firmTag}>Inspection télévisée · ITV · NF EN 13508-2</Text>
    </View>
    <View style={s.headerRight}>
      <Text style={s.headerMetaBold}>Rapport d&apos;inspection caméra</Text>
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

      <View style={[s.etatBox, { backgroundColor: etat.bg }]} wrap={false}>
        <Text style={s.etatLbl}>{tronconCount > 1 ? 'Conclusion globale' : 'Conclusion'}</Text>
        <Text style={[s.etatVal, { color: etat.fg }]}>{etat.label}</Text>
      </View>

      <View style={s.partyTable} wrap={false}>
        <View style={[s.partyCol, s.partyColSep]}>
          <Text style={s.partyHead}>Émetteur</Text>
          <Text style={s.partyName}>Les Techniciens du Débouchage</Text>
          <Text style={s.partyLine}>700 Avenue du 15ème Corps · 83000 Toulon</Text>
          <Text style={s.partyLine}>Tél. {TEL_PRINCIPAL_FALLBACK}</Text>
          <Text style={s.partyLine}>contact@lestechniciensdudebouchage.fr</Text>
        </View>
        <View style={s.partyCol}>
          <Text style={s.partyHead}>Client</Text>
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
          {tronconCount} tronçon{tronconCount > 1 ? 's' : ''} — détail à la suite (1 tronçon par page).
        </Text>
      ) : null}

      <View style={s.glossBox} wrap={false}>
        <Text style={s.glossTitle}>Glossaire technique</Text>
        {GLOSSAIRE.map(g => (
          <View key={g.terme} style={s.glossRow}>
            <Text style={s.glossTerme}>{g.terme}</Text>
            <Text style={s.glossDef}>{g.def}</Text>
          </View>
        ))}
      </View>
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

        <View style={[s.etatBox, { backgroundColor: etatTronc.bg, marginBottom: 6 }]}>
          <Text style={s.etatLbl}>Conclusion</Text>
          <Text style={[s.etatVal, { color: etatTronc.fg }]}>{etatTronc.label}</Text>
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
        <View style={s.precoBox} wrap={false}>
          <Text style={s.precoTitle}>Préconisations</Text>
          {bloc.preconisations.map((p, i) => (
            <View key={i} style={s.precoItem}>
              <Text style={s.precoItemTitle}>• {p.titre}</Text>
              <Text style={s.precoItemDetail}>{p.detail}</Text>
            </View>
          ))}
        </View>
      )}

      {bloc.resume ? (
        <View style={s.resumeBox} wrap={false}>
          <Text style={s.resumeTitle}>Synthèse</Text>
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
    ? `Tronçon ${tronconIndex}/${total}`
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
    return (
      <Document>
        <Page size="A4" style={s.page} wrap>
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
            <TronconBlock bloc={bloc} ti={ti} total={troncons.length} codeStyle={codeStyle} />
          </View>
          <Footer numero={data.numero} pageLabel={`Tronçon ${ti + 1}/${troncons.length}`} />
        </Page>
      ))}
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

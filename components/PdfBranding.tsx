import React from "react"
import { View, Text, StyleSheet, Svg, Path, Rect, Image } from "@react-pdf/renderer"
import { LTDB_LOGO_SRC } from "@/lib/ltdb-logo"

/* ============================================================
   Branding PDF partagé (factures & devis) — modèle bleu/blanc/rouge.
   Bandeau bleu marine avec vague rouge + logo « LTDB » (wordmark).
   100 % vectoriel/texte (aucune image externe) et sans position:absolute
   (compatibilité Aperçu macOS / Mail / iOS — moteur CoreGraphics).
   ============================================================ */

export const PDF_C = {
  navy: '#1e3a6f',
  navyDark: '#142a52',
  red: '#c0392b',
  white: '#ffffff',
  navySoft: '#dbe4f3',
  navyKicker: '#a9bcdc',
  text: '#1e293b',
  muted: '#6b7280',
}

const PAGE_W = 595.28 // A4 en points

/** Hauteur totale bandeau bleu + vague rouge (points PDF, mesurée au rendu). */
export const PDF_BANNER_HEIGHT = 149

const b = StyleSheet.create({
  band: { backgroundColor: PDF_C.navy },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 40, paddingTop: 24, paddingBottom: 16,
  },
  leftCol: { flexShrink: 1, paddingRight: 16 },
  kicker: {
    color: PDF_C.navyKicker, fontSize: 9, letterSpacing: 2,
    textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginBottom: 5,
  },
  title: {
    color: PDF_C.white, fontSize: 27, fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5, lineHeight: 1.05,
  },
  numero: {
    color: PDF_C.white, fontSize: 12, fontFamily: 'Helvetica-Bold',
    marginTop: 7,
  },
  sub: { color: PDF_C.navySoft, fontSize: 9, marginTop: 3 },

  rightCol: { alignItems: 'flex-end' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logoBox: { width: 44, height: 44, marginRight: 8 },
  logo: { width: 44, height: 44 },
  contact: { color: PDF_C.navySoft, fontSize: 8.5, textAlign: 'right', lineHeight: 1.5 },
})

/** Logo carré bleu, à côté des coordonnées pour garder la hauteur du bandeau. */
export function PdfLogo() {
  return (
    <View style={b.logoBox}>
      <Image src={LTDB_LOGO_SRC} style={b.logo} />
    </View>
  )
}

/** Vague rouge décorative (bas du bandeau bleu). */
function RedWave() {
  return (
    <Svg width={PAGE_W} height={30} viewBox="0 0 595 30">
      <Rect x="0" y="0" width="595" height="30" fill={PDF_C.navy} />
      <Path
        d="M0,15 C 130,2 270,26 420,12 C 500,4 555,9 595,6 L595,30 L0,30 Z"
        fill={PDF_C.red}
      />
    </Svg>
  )
}

export interface PdfBannerProps {
  title: string                 // "FACTURE" | "DEVIS"
  numero?: string               // "FA-2026-0001"
  subtitle?: string             // ligne secondaire (ex: "valable 30 jours")
  phone?: string
  email?: string
  site?: string
}

/**
 * Bandeau d'en-tête de page (titre + logo + contacts), pensé pour être passé en
 * `fixed` (répété sur chaque page) sans position:absolute.
 */
export function PdfBanner({ title, numero, subtitle, phone, email, site }: PdfBannerProps) {
  const siteUrl = site || 'lestechniciensdudebouchage.fr'
  return (
    <View>
      <View style={b.band}>
        <View style={b.row}>
          <View style={b.leftCol}>
            <Text style={b.kicker}>Les Techniciens du Débouchage</Text>
            <Text style={b.title}>{title}</Text>
            {numero ? <Text style={b.numero}>N° {numero}</Text> : null}
            {subtitle ? <Text style={b.sub}>{subtitle}</Text> : null}
          </View>
          <View style={b.rightCol}>
            <View style={b.brandRow}>
              <PdfLogo />
              <View>
                {phone ? <Text style={b.contact}>Tél. {phone}</Text> : null}
                {email ? <Text style={b.contact}>{email}</Text> : null}
                <Text style={b.contact}>{siteUrl}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
      <RedWave />
    </View>
  )
}

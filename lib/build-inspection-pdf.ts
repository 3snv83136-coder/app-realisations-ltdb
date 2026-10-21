/**
 * Génération PDF ITV — présentation LTDB (synthèse, tronçons illustrés, guide de lecture).
 * Toujours passer par ici (téléchargement, aperçu, historique) pour garder
 * la même présentation sur tous les canaux.
 */
'use client'

import { createElement, type ReactElement } from "react"
import { pdf } from "@react-pdf/renderer"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import {
  InspectionDocument,
  type InspectionData,
} from "@/components/InspectionCameraPDF"

async function renderPartToBytes(element: ReactElement): Promise<Uint8Array> {
  const blob = await pdf(element).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}

/** Construit le PDF ITV avec la présentation LTDB (anti pages blanches / anti plantage multi-photos). */
export async function buildInspectionPdfBlob(data: InspectionData): Promise<Blob> {
  const troncons = Array.isArray(data.troncons) ? data.troncons : []
  const parts: Uint8Array[] = []

  // Intro sans tronçons, avec la photo de présentation dédiée ou le logo.
  const introData: InspectionData = {
    ...data,
    troncons,
  }

  parts.push(await renderPartToBytes(createElement(InspectionDocument, {
    data: introData,
    variant: "intro",
    tronconTotal: troncons.length,
  })))



  for (let i = 0; i < troncons.length; i++) {
    parts.push(await renderPartToBytes(createElement(InspectionDocument, {
      data: { ...data, troncons: [troncons[i]] },
      variant: "troncon",
      tronconIndex: i + 1,
      tronconTotal: Math.max(troncons.length, 1),
    })))
  }

  if (data.schemaReseauUrl) {
    parts.push(await renderPartToBytes(createElement(InspectionDocument, {
      data: { ...data, troncons: [] },
      variant: "schema",
    })))
  }

  parts.push(await renderPartToBytes(createElement(InspectionDocument, {
    data: { ...data, troncons: [] },
    variant: "glossaire",
  })))

  const merged = await PDFDocument.create()
  for (const bytes of parts) {
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const pageFont = await merged.embedFont(StandardFonts.Helvetica)
  const pages = merged.getPages()
  pages.forEach((page, i) => {
    const label = `${i + 1} / ${pages.length}`
    page.drawText(label, {
      x: (page.getWidth() - pageFont.widthOfTextAtSize(label, 7)) / 2,
      y: 8, size: 7, font: pageFont, color: rgb(0.35, 0.39, 0.44),
    })
  })
  const out = await merged.save()
  const copy = new Uint8Array(out.byteLength)
  copy.set(out)
  return new Blob([copy.buffer], { type: "application/pdf" })
}

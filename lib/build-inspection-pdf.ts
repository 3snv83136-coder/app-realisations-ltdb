/**
 * Génération PDF ITV — modèle dense officiel (couverture + 1 page/tronçon).
 * Toujours passer par ici (téléchargement, aperçu, historique) pour garder
 * le même rendu que le rapport Mirabella validé.
 */
'use client'

import { createElement, type ReactElement } from "react"
import { pdf } from "@react-pdf/renderer"
import { PDFDocument } from "pdf-lib"
import {
  InspectionDocument,
  type InspectionData,
} from "@/components/InspectionCameraPDF"
import { fetchInspectionMapDataUrl } from "@/lib/inspection-map-image"

async function renderPartToBytes(element: ReactElement): Promise<Uint8Array> {
  const blob = await pdf(element).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}

async function withCoverMap(data: InspectionData): Promise<InspectionData> {
  if (data.mapImageUrl) return data
  const mapImageUrl = await fetchInspectionMapDataUrl(data.client)
  return mapImageUrl ? { ...data, mapImageUrl } : data
}

/** Construit le PDF ITV au modèle professionnel dense (anti pages blanches / anti plantage multi-photos). */
export async function buildInspectionPdfBlob(data: InspectionData): Promise<Blob> {
  const enriched = await withCoverMap(data)
  const troncons = Array.isArray(enriched.troncons) ? enriched.troncons : []
  const parts: Uint8Array[] = []

  parts.push(await renderPartToBytes(createElement(InspectionDocument, {
    data: { ...enriched, troncons: [] },
    variant: "intro",
    tronconTotal: troncons.length,
  })))

  parts.push(await renderPartToBytes(createElement(InspectionDocument, {
    data: { ...enriched, troncons: [] },
    variant: "glossaire",
  })))

  for (let i = 0; i < troncons.length; i++) {
    parts.push(await renderPartToBytes(createElement(InspectionDocument, {
      data: { ...enriched, troncons: [troncons[i]] },
      variant: "troncon",
      tronconIndex: i + 1,
      tronconTotal: Math.max(troncons.length, 1),
    })))
  }

  const merged = await PDFDocument.create()
  for (const bytes of parts) {
    const doc = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(doc, doc.getPageIndices())
    pages.forEach(p => merged.addPage(p))
  }

  const out = await merged.save()
  const copy = new Uint8Array(out.byteLength)
  copy.set(out)
  return new Blob([copy.buffer], { type: "application/pdf" })
}

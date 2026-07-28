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
  pickCoverPhotoUrl,
  type InspectionData,
} from "@/components/InspectionCameraPDF"
import { fetchInspectionMapDataUrl } from "@/lib/inspection-map-image"

async function renderPartToBytes(element: ReactElement): Promise<Uint8Array> {
  const blob = await pdf(element).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}

/** Carte en priorité ; sinon 1ʳᵉ photo du rapport (ou 2ᵉ). */
async function withCoverVisual(data: InspectionData): Promise<InspectionData> {
  if (data.mapImageUrl) return data

  const mapImageUrl = await fetchInspectionMapDataUrl(data.client)
  if (mapImageUrl) return { ...data, mapImageUrl }

  if (data.coverPhotoUrl) return data
  const coverPhotoUrl = pickCoverPhotoUrl(data.troncons)
  return coverPhotoUrl ? { ...data, coverPhotoUrl } : data
}

/** Construit le PDF ITV au modèle professionnel dense (anti pages blanches / anti plantage multi-photos). */
export async function buildInspectionPdfBlob(data: InspectionData): Promise<Blob> {
  const enriched = await withCoverVisual(data)
  const troncons = Array.isArray(enriched.troncons) ? enriched.troncons : []
  const parts: Uint8Array[] = []

  // Intro sans tronçons (léger) mais conserve coverPhotoUrl / mapImageUrl
  const introData: InspectionData = {
    ...enriched,
    troncons: [],
    coverPhotoUrl: enriched.coverPhotoUrl || pickCoverPhotoUrl(troncons),
  }

  parts.push(await renderPartToBytes(createElement(InspectionDocument, {
    data: introData,
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

'use client'
import { PDFViewer, type DocumentProps } from "@react-pdf/renderer"
import type { ReactElement } from "react"

/**
 * Wrapper client-only autour de PDFViewer.
 * À importer via next/dynamic({ ssr: false }) depuis une page.
 */
export default function TerrainPdfViewer({ doc }: { doc: ReactElement<DocumentProps> }) {
  return (
    <PDFViewer style={{ width: '100%', height: '85vh', border: 'none' }} showToolbar>
      {doc}
    </PDFViewer>
  )
}

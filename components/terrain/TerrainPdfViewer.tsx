'use client'
import { PDFViewer, type DocumentProps } from "@react-pdf/renderer"
import type { ReactElement } from "react"

/**
 * Wrapper client-only autour de PDFViewer.
 * À importer via next/dynamic({ ssr: false }) depuis une page.
 */
export default function TerrainPdfViewer({ doc }: { doc: ReactElement<DocumentProps> }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ height: 'min(85vh, 720px)', minHeight: '50vh' }}>
      <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }} showToolbar>
        {doc}
      </PDFViewer>
    </div>
  )
}

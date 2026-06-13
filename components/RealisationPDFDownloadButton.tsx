'use client'
import React from "react"
import { PDFDownloadLink } from "@react-pdf/renderer"
import { RealisationDocument, type PDFProps } from "./RealisationPDF"

interface DownloadButtonProps extends PDFProps {
  filename?: string
}

export default function PDFDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `rapport-${(props.ville || 'intervention').toLowerCase()}-${props.dateIntervention}.pdf`
  return (
    <PDFDownloadLink document={<RealisationDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0e2a52] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a1f3d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          title="Télécharger le rapport en PDF"
        >
          <span aria-hidden>{loading ? '⏳' : '⬇'}</span>
          <span>{loading ? 'Génération du PDF...' : 'Télécharger le rapport PDF'}</span>
        </button>
      )}
    </PDFDownloadLink>
  )
}

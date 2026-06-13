'use client'
import React from "react"
import { PDFDownloadLink } from "@react-pdf/renderer"
import { FactureDocument, type FacturePDFProps } from "./FacturePDF"

interface DownloadButtonProps extends FacturePDFProps {
  filename?: string
}

export default function FactureDownloadButton(props: DownloadButtonProps) {
  const filename = props.filename || `facture-${(props.client.nom || 'client').toLowerCase().replace(/\s+/g, '-')}-${props.facture.numero}.pdf`
  return (
    <PDFDownloadLink document={<FactureDocument {...props} />} fileName={filename}>
      {({ loading }) => (
        <button
          type="button"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0e2a52] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a1f3d] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          title="Télécharger la facture en PDF"
        >
          <span aria-hidden>{loading ? '⏳' : '⬇'}</span>
          <span>{loading ? 'Génération du PDF...' : 'Télécharger la facture PDF'}</span>
        </button>
      )}
    </PDFDownloadLink>
  )
}

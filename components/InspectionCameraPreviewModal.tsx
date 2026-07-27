'use client'
import { useEffect, useState } from "react"
import type { InspectionData } from "./InspectionCameraPDF"

export default function InspectionCameraPreviewModal({
  data,
  onClose,
}: {
  data: InspectionData
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        const { buildInspectionPdfBlob } = await import("@/lib/build-inspection-pdf")
        const blob = await buildInspectionPdfBlob(data)
        if (cancelled) return
        const objectUrl = URL.createObjectURL(blob)
        revoked = objectUrl
        setUrl(objectUrl)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur aperçu PDF")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [data])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 py-3 border-b bg-slate-50">
          <h3 className="font-black text-[#0e2a52] text-lg">Aperçu PDF — Rapport ITV</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 bg-slate-100 flex items-center justify-center">
          {loading ? (
            <p className="text-slate-600 font-medium text-sm">Préparation de l&apos;aperçu…</p>
          ) : error ? (
            <p className="text-red-600 font-medium text-sm px-4 text-center">{error}</p>
          ) : url ? (
            <iframe title="Aperçu rapport ITV" src={url} className="w-full h-full border-0" />
          ) : null}
        </div>
      </div>
    </div>
  )
}

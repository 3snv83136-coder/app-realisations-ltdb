'use client'
import { pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

export async function pdfDocumentToBase64(doc: ReactElement): Promise<string> {
  const blob = await pdf(doc).toBlob()
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

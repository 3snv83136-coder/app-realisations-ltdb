/**
 * Charge le PDF d'attestation de conformité lié à une intervention (pour PJ mail).
 * Priorité : documents.pdf_url ; sinon rendu à la volée depuis le payload.
 */
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import type { SupabaseClient } from "@supabase/supabase-js"
import { AttestationDocument, type AttestationData } from "@/components/AttestationPDF"
import { embedImageForPdf, getLtdbSignatureDataUri } from "@/lib/pdf-image-embed"
import { getLtdbSignatureUrl } from "@/lib/rapport-signatures"
import { fetchPdfAsBase64Robust, isValidPdfBase64 } from "@/lib/supabase-pdf-fetch"

export type AttestationMailPdf = {
  base64: string
  numero: string
  documentId: string
}

export async function loadAttestationPdfBase64ForIntervention(
  sb: SupabaseClient,
  interventionId: string,
  baseUrl?: string,
): Promise<AttestationMailPdf | null> {
  const { data: doc } = await sb
    .from("documents")
    .select("id, numero, payload, pdf_url")
    .eq("intervention_id", interventionId)
    .eq("type", "attestation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!doc?.id) return null

  const numero = (doc.numero as string) || "attestation"
  if (doc.pdf_url) {
    const b64 = await fetchPdfAsBase64Robust(sb, doc.pdf_url as string)
    if (isValidPdfBase64(b64, 1500)) {
      return { base64: b64!, numero, documentId: doc.id as string }
    }
  }

  const payload = (doc.payload || {}) as AttestationData
  if (!payload.numero && !doc.numero) return null

  const safe: AttestationData = {
    ...payload,
    numero: payload.numero || (doc.numero as string) || "",
    objet: payload.objet || "",
    methode: payload.methode || "",
    observations: Array.isArray(payload.observations) ? payload.observations : [],
    conclusion: payload.conclusion || "",
  }

  const { data: interv } = await sb
    .from("interventions")
    .select("photos_urls, photos_legendes")
    .eq("id", interventionId)
    .maybeSingle()

  const urls = (interv?.photos_urls as string[] | null) || []
  const legendes = (interv?.photos_legendes as string[] | null) || []
  const photos = await Promise.all(
    urls.slice(0, 6).map(async (url, i) => {
      const embedded = await embedImageForPdf(url, baseUrl)
      return { url: embedded || url, legende: legendes[i] || undefined }
    }),
  )

  const signatureLtdbUrl =
    getLtdbSignatureDataUri() || (baseUrl ? getLtdbSignatureUrl(baseUrl) : getLtdbSignatureUrl())

  try {
    const element = createElement(AttestationDocument, {
      data: safe,
      photos,
      signatureLtdbUrl,
    })
    // @react-pdf typings attend DocumentProps ; AttestationDocument est un Document valide.
    const buf = Buffer.from(await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]))
    if (buf.length < 1500) return null
    return {
      base64: buf.toString("base64"),
      numero: safe.numero || numero,
      documentId: doc.id as string,
    }
  } catch (e) {
    console.error("[attestation-pdf-for-mail] render", e)
    return null
  }
}

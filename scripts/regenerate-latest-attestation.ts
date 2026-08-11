/**
 * Régénère le PDF de la dernière attestation avec la signature LTDB.
 * Usage: npx tsx scripts/regenerate-latest-attestation.ts
 */
import fs from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { createClient } from "@supabase/supabase-js"
import { AttestationDocument, type AttestationData } from "../components/AttestationPDF"
import { embedImageForPdf, getLtdbSignatureDataUri } from "../lib/pdf-image-embed"
import { getLtdbSignatureUrl } from "../lib/rapport-signatures"

function loadEnv(name: string) {
  const p = path.resolve(process.cwd(), name)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
  }
}
loadEnv(".env.local")
loadEnv(".env.vercel")

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || "intervention-pdfs"

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase non configuré")

  const sb = createClient(supabaseUrl, serviceKey)
  const baseUrl = process.env.APP_BASE_URL || "https://app-realisations-ltdb.vercel.app"

  const { data: doc, error } = await sb
    .from("documents")
    .select("id, numero, intervention_id, payload, pdf_url, created_at")
    .eq("type", "attestation")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !doc) throw new Error(error?.message || "Aucune attestation trouvée")

  const payload = (doc.payload || {}) as AttestationData
  const safe: AttestationData = {
    ...payload,
    numero: payload.numero || doc.numero || "",
    objet: payload.objet || "",
    methode: payload.methode || "",
    observations: Array.isArray(payload.observations) ? payload.observations : [],
    conclusion: payload.conclusion || "",
  }

  let photos: { url: string; legende?: string }[] = []
  if (doc.intervention_id) {
    const { data: interv } = await sb
      .from("interventions")
      .select("photos_urls, photos_legendes")
      .eq("id", doc.intervention_id)
      .maybeSingle()
    const urls = (interv?.photos_urls as string[] | null) || []
    const legendes = (interv?.photos_legendes as string[] | null) || []
    photos = await Promise.all(
      urls.map(async (url, i) => {
        const embedded = await embedImageForPdf(url, baseUrl)
        return {
          url: embedded || url,
          legende: legendes[i] || undefined,
        }
      }),
    )
  }

  const signatureLtdbUrl =
    getLtdbSignatureDataUri() || getLtdbSignatureUrl(baseUrl)

  const element = createElement(AttestationDocument, {
    data: safe,
    photos,
    signatureLtdbUrl,
  })
  const buf = Buffer.from(await renderToBuffer(element))
  if (buf.length < 1000) throw new Error("PDF attestation vide ou corrompu")

  const stamp = Date.now().toString(36)
  const storagePath = doc.intervention_id
    ? `${doc.intervention_id}/attestation-${safe.numero || stamp}.pdf`
    : `attestations/${safe.numero || stamp}.pdf`

  const { error: upErr } = await sb.storage
    .from(PDFS_BUCKET)
    .upload(storagePath, buf, { contentType: "application/pdf", upsert: true })
  if (upErr) throw new Error(`Upload PDF : ${upErr.message}`)

  const { data: pub } = sb.storage.from(PDFS_BUCKET).getPublicUrl(storagePath)
  const pdf_url = pub.publicUrl
  const { error: dbErr } = await sb
    .from("documents")
    .update({ pdf_url })
    .eq("id", doc.id)
  if (dbErr) throw new Error(dbErr.message)

  // Aperçu local
  const previewDir = path.resolve(process.cwd(), "_tmp-pdf-preview")
  fs.mkdirSync(previewDir, { recursive: true })
  const localPath = path.join(previewDir, `${safe.numero || "attestation"}.pdf`)
  fs.writeFileSync(localPath, buf)

  console.log(JSON.stringify({
    ok: true,
    document_id: doc.id,
    numero: safe.numero,
    intervention_id: doc.intervention_id,
    pdf_url,
    bytes: buf.length,
    local: localPath,
    signature: signatureLtdbUrl.startsWith("data:") ? "data-uri" : signatureLtdbUrl,
    photos: photos.length,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

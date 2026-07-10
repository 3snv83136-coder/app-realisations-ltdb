/**
 * Rendu rapport seul (données Supabase) — sans facture.
 * Usage: npx tsx scripts/test-rapport-render-only.ts [reference]
 */
import fs from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { createClient } from "@supabase/supabase-js"
import { renderToBuffer } from "@react-pdf/renderer"
import { RealisationDocument } from "../components/RealisationPDF"
import { embedImageForPdf, getLtdbSignatureDataUri } from "../lib/pdf-image-embed"
import { pdfBufferHasText } from "../lib/pdf-text-check"
import { getSignatureClientFromRapport } from "../lib/sync-signature-rapport"
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

const ref = process.argv[2] || "LTDB-20260710-1330"
const baseUrl = process.env.APP_BASE_URL || "https://app-realisations-ltdb.vercel.app"
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) throw new Error("Supabase non configuré")

const sb = createClient(supabaseUrl, serviceKey)

async function main() {
  const { data: interv } = await sb
    .from("interventions")
    .select("*, technicien_id, client_id")
    .eq("reference", ref)
    .maybeSingle()
  if (!interv?.rapport_json) throw new Error(`Pas de rapport pour ${ref}`)

  let clientNom = "Client"
  if (interv.client_id) {
    const { data: cl } = await sb.from("clients").select("nom").eq("id", interv.client_id).maybeSingle()
    if (cl?.nom) clientNom = cl.nom as string
  }

  let technicienNom = "Technicien"
  let technicienPhotoUrl: string | null = null
  if (interv.technicien_id) {
    const { data: t } = await sb.from("techniciens").select("nom, photo_url").eq("id", interv.technicien_id).maybeSingle()
    if (t?.nom) technicienNom = t.nom as string
    if (t?.photo_url) technicienPhotoUrl = await embedImageForPdf(t.photo_url as string, baseUrl)
  }

  const { data: accord } = await sb
    .from("accords_intervention")
    .select("signature_image, valide_at")
    .eq("intervention_id", interv.id)
    .eq("statut", "VALIDE")
    .maybeSingle()

  const sigFromRapport = getSignatureClientFromRapport(interv.rapport_json)
  const photos = (
    await Promise.all(
      ((interv.photos_urls as string[]) || []).map(async (url, i) => {
        const embedded = await embedImageForPdf(url, baseUrl)
        if (!embedded) return null
        return {
          url: embedded,
          legende: ((interv.photos_legendes as string[]) || [])[i] || `Photo ${i + 1}`,
        }
      }),
    )
  ).filter(Boolean) as { url: string; legende: string }[]

  const rawClientSig = (accord?.signature_image as string) || sigFromRapport?.image_url || null
  const signatureClientUrl = rawClientSig ? await embedImageForPdf(rawClientSig, baseUrl) : null

  const buf = await renderToBuffer(
    createElement(RealisationDocument, {
      clientNom,
      adresse: (interv.adresse_chantier as string) || "",
      ville: (interv.ville as string) || "",
      codePostal: (interv.code_postal as string) || "",
      dateIntervention: (interv.date_realisee as string) || (interv.date_prevue as string) || "",
      typeIntervention: (interv.type_intervention as string) || "",
      technicienNom,
      technicienPhotoUrl,
      rapport: interv.rapport_json,
      reference: (interv.reference as string) || undefined,
      photos,
      signatureLtdbUrl: getLtdbSignatureDataUri() || getLtdbSignatureUrl(baseUrl),
      signatureClientUrl,
      signatureClientDate: (accord?.valide_at as string) || sigFromRapport?.valide_at || null,
    }),
  )

  const out = `/tmp/rapport-${ref}.pdf`
  fs.writeFileSync(out, buf)
  const hasText = pdfBufferHasText(Buffer.from(buf))
  console.log("written", out, "bytes", buf.byteLength, "hasText", hasText)
  console.log("photos embedded", photos.length)
  console.log("rapport keys", Object.keys(interv.rapport_json as object).join(", "))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

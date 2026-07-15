/**
 * Régénère le rapport PDF de la dernière intervention terminée (rapport seul).
 * Usage: npx tsx scripts/regenerate-latest-rapport.ts
 */
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { createElement } from "react"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { renderToBuffer } from "@react-pdf/renderer"
import { RealisationDocument } from "../components/RealisationPDF"
import { embedImageForPdf, getLtdbSignatureDataUri } from "../lib/pdf-image-embed"
import { pdfBufferHasText } from "../lib/pdf-text-check"
import { getSignatureClientFromRapport } from "../lib/sync-signature-rapport"
import { getLtdbSignatureUrl } from "../lib/rapport-signatures"

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || "intervention-pdfs"

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

async function uploadRapport(sb: SupabaseClient, interventionId: string, buf: Buffer): Promise<string> {
  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80)
  const nonce = crypto.randomBytes(3).toString("hex")
  const storagePath = `${folder}/rapport-${Date.now()}-${nonce}.pdf`
  const { error } = await sb.storage
    .from(PDFS_BUCKET)
    .upload(storagePath, buf, { contentType: "application/pdf", upsert: true })
  if (error) throw new Error(`Upload rapport : ${error.message}`)
  const { data: pub } = sb.storage.from(PDFS_BUCKET).getPublicUrl(storagePath)
  if (!pub?.publicUrl) throw new Error("URL publique rapport introuvable")
  const { error: upErr } = await sb.from("interventions").update({ pdf_rapport_url: pub.publicUrl }).eq("id", interventionId)
  if (upErr) throw new Error(upErr.message)
  return pub.publicUrl
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase non configuré")

  const sb = createClient(supabaseUrl, serviceKey)
  const baseUrl = process.env.APP_BASE_URL || "https://app-realisations-ltdb.vercel.app"

  const { data: interv, error } = await sb
    .from("interventions")
    .select("id, reference, client_id, technicien_id, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, rapport_json, photos_urls, photos_legendes, pdf_rapport_url")
    .not("rapport_json", "is", null)
    .order("date_realisee", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !interv?.rapport_json) throw new Error("Aucune intervention avec rapport trouvée")

  let clientNom = "Client"
  if (interv.client_id) {
    const { data: cl } = await sb.from("clients").select("nom").eq("id", interv.client_id).maybeSingle()
    if (cl?.nom) clientNom = cl.nom as string
  }

  let technicienNom = "Technicien"
  let technicienPhotoUrl: string | null = null
  if (interv.technicien_id) {
    const { data: t } = await sb
      .from("techniciens")
      .select("nom, photo_url")
      .eq("id", interv.technicien_id)
      .maybeSingle()
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

  console.log("→ Dernière intervention:", interv.reference, "|", interv.type_intervention, "|", interv.ville)
  console.log("→ Client:", clientNom)
  console.log("→ Ancien PDF:", interv.pdf_rapport_url || "(aucun)")

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

  const rapportBuffer = Buffer.from(buf)
  if (!pdfBufferHasText(rapportBuffer)) throw new Error("PDF rapport vide")

  const localOut = `/tmp/rapport-${interv.reference}.pdf`
  fs.writeFileSync(localOut, rapportBuffer)

  const url = await uploadRapport(sb, interv.id as string, rapportBuffer)

  console.log("\n✅ Rapport régénéré")
  console.log("   URL:", url)
  console.log("   Taille:", rapportBuffer.byteLength, "octets")
  console.log("   Copie locale:", localOut)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

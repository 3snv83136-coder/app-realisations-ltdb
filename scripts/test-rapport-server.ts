/**
 * Génère un rapport PDF côté serveur (comme Vercel) pour une intervention réelle.
 * Usage: npx tsx scripts/test-rapport-server.ts [reference|interventionId]
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { generateTerrainPdfsOnServer } from "../lib/terrain-pdf-server"
import { pdfBufferHasText } from "../lib/pdf-text-check"

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

const refOrId = process.argv[2] || "LTDB-20260710-1330"
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  throw new Error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local ou .env.vercel)")
}
const sb = createClient(supabaseUrl, serviceKey)

async function main() {
  let q = sb.from("interventions").select("id, reference, client_id").limit(1)
  if (refOrId.includes("-") && refOrId.startsWith("LTDB")) {
    q = q.eq("reference", refOrId)
  } else {
    q = q.eq("id", refOrId)
  }
  const { data: interv, error } = await q.maybeSingle()
  if (error || !interv) throw new Error(`Intervention introuvable: ${refOrId}`)

  let clientNom = "Client"
  if (interv.client_id) {
    const { data: cl } = await sb.from("clients").select("nom").eq("id", interv.client_id).maybeSingle()
    if (cl?.nom) clientNom = cl.nom as string
  }

  const baseUrl = process.env.APP_BASE_URL || "https://app-realisations-ltdb.vercel.app"
  console.log("Intervention:", interv.reference || interv.id)
  console.log("Base URL:", baseUrl)

  const result = await generateTerrainPdfsOnServer({
    interventionId: interv.id as string,
    baseUrl,
    clientNom,
    sb,
  })

  console.log("OK", result)
  const { data } = await sb.storage
    .from(process.env.SUPABASE_PDFS_BUCKET || "intervention-pdfs")
    .download(result.rapport_url.split("/object/public/intervention-pdfs/")[1] || "")
  if (data) {
    const buf = Buffer.from(await data.arrayBuffer())
    console.log("hasText", pdfBufferHasText(buf), "bytes", buf.length)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

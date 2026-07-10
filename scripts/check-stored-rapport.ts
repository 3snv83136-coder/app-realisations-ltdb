import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
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

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const ref = process.argv[2] || "LTDB-20260710-1330"
  const { data } = await sb.from("interventions").select("pdf_rapport_url").eq("reference", ref).single()
  console.log("url", data?.pdf_rapport_url)
  if (!data?.pdf_rapport_url) return
  const res = await fetch(data.pdf_rapport_url)
  const buf = Buffer.from(await res.arrayBuffer())
  console.log("stored bytes", buf.length, "hasText", pdfBufferHasText(buf))
}

main().catch(console.error)

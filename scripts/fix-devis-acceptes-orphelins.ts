import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { createClient } from "@supabase/supabase-js"
import { accepterDevis } from "../lib/devis-accepter"

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  )

  const SANTONI = "e5b4ae71-c5e0-489a-9cde-3af3e5ce417a"
  console.log("--- Santoni ---")
  const r1 = await accepterDevis(SANTONI)
  console.log(JSON.stringify(r1, null, 2))

  const { data: orphans } = await sb
    .from("documents")
    .select("id, numero")
    .eq("type", "devis")
    .eq("statut", "accepte")
    .is("intervention_id", null)

  console.log("\nOrphelins restants:", orphans?.length || 0)
  for (const d of orphans || []) {
    const r = await accepterDevis(d.id)
    console.log(d.numero, JSON.stringify(r))
  }

  if (r1.ok && r1.interventionId) {
    const { data: itv } = await sb
      .from("interventions")
      .select("id, reference, type_intervention, statut, adresse_chantier, ville, prix_prevu, notes_internes, client_id")
      .eq("id", r1.interventionId)
      .single()
    const { data: c } = await sb.from("clients").select("nom").eq("id", itv!.client_id).single()
    console.log("\nFiche Santoni:", { ...itv, client: c?.nom })
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

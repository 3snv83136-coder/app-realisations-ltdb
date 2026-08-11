/**
 * Régénère le PDF de la dernière facture avec l'adresse chantier.
 * Usage: npx tsx scripts/regenerate-latest-facture.ts
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { generateTerrainPdfsOnServer } from "../lib/terrain-pdf-server"

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
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase non configuré")

  const sb = createClient(supabaseUrl, serviceKey)
  const baseUrl = process.env.APP_BASE_URL || "https://app-realisations-ltdb.vercel.app"

  const { data: facture, error } = await sb
    .from("documents")
    .select("id, numero, intervention_id, payload, client_id, created_at")
    .eq("type", "facture")
    .not("intervention_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !facture?.intervention_id) {
    throw new Error(error?.message || "Aucune facture liée à une intervention")
  }

  const { data: interv } = await sb
    .from("interventions")
    .select("id, adresse_chantier, ville, code_postal, client_id")
    .eq("id", facture.intervention_id)
    .maybeSingle()

  if (!interv) throw new Error("Intervention introuvable")

  const rue = ((interv.adresse_chantier as string) || "").trim()
  const cpVille = [interv.code_postal, interv.ville].filter(Boolean).join(" ")
  const adresseChantier = [rue, cpVille].filter(Boolean).join(", ")

  const payload = {
    ...((facture.payload as object) || {}),
    ...(adresseChantier ? { adresse_chantier: adresseChantier } : {}),
  }

  const { error: upPayloadErr } = await sb
    .from("documents")
    .update({ payload })
    .eq("id", facture.id)
  if (upPayloadErr) throw new Error(upPayloadErr.message)

  let clientNom = "Client"
  if (interv.client_id) {
    const { data: c } = await sb.from("clients").select("nom").eq("id", interv.client_id).maybeSingle()
    if (c?.nom) clientNom = c.nom as string
  }

  const result = await generateTerrainPdfsOnServer({
    interventionId: interv.id as string,
    baseUrl,
    clientNom,
    sb,
  })

  console.log(JSON.stringify({
    ok: true,
    facture_id: facture.id,
    numero: facture.numero,
    intervention_id: interv.id,
    adresse_chantier: adresseChantier || null,
    facture_url: result.facture_url,
  }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

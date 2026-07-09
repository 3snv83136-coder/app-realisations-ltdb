/**
 * Test E-E-A-T : migration, génération SEO enrichie, publication site.
 * Client test : mondornaji@gmail.com
 *
 * Usage prod :
 *   E2E_BASE_URL=https://app-realisations-ltdb.vercel.app \
 *   E2E_SKIP_VIDEO=1 E2E_SKIP_GMB=1 \
 *   npx tsx scripts/e2e-eeat-test.ts
 */
import { createClient } from "@supabase/supabase-js"
import fs from "node:fs"
import path from "node:path"
import { buildPublishContentHtml } from "../lib/publish-content"

function loadEnvFile(name: string) {
  const p = path.resolve(process.cwd(), name)
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "")
  }
}
loadEnvFile(".env.local")
loadEnvFile(".env.vercel")

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000"
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || "mondornaji@gmail.com"
const INTERNAL_SECRET = process.env.E2E_INTERNAL_SECRET || process.env.NEXTAUTH_SECRET || ""
const SKIP_PUBLISH = process.env.E2E_SKIP_PUBLISH === "1"

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

let pass = 0
let fail = 0
function ok(label: string, detail = "") {
  pass++
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`)
}
function ko(label: string, detail = "") {
  fail++
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`)
}
function step(n: string) {
  console.log(`\n━━ ${n} ━━`)
}

function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra }
  if (INTERNAL_SECRET) h["x-internal-auth"] = INTERNAL_SECRET
  return h
}

async function jfetch(url: string, init?: RequestInit, timeoutMs = 120_000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const headers = apiHeaders(
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : (init?.headers as Record<string, string> | undefined),
  )
  try {
    const res = await fetch(url, { ...init, headers, signal: ctrl.signal })
    let body: unknown = null
    try { body = await res.json() } catch { /* */ }
    return { status: res.status, body }
  } finally {
    clearTimeout(t)
  }
}

async function applyMigrationIfNeeded() {
  step("0 — Migration 022 (colonnes E-E-A-T)")
  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), "supabase/migrations/022_publish_eeat.sql"),
    "utf-8",
  )

  // Vérifie si photos_categories existe déjà
  const { error: catErr } = await sb.from("interventions").select("photos_categories").limit(1)
  if (!catErr) {
    ok("photos_categories", "colonne présente")
  } else if (/photos_categories|column/i.test(catErr.message)) {
    ko("photos_categories", "migration 022 non appliquée — exécutez le SQL dans Supabase")
    console.log("\n  SQL à coller dans Supabase → SQL Editor :\n")
    console.log(migrationSql)
  } else {
    ko("photos_categories", catErr.message)
  }

  const { error: techErr } = await sb.from("techniciens").select("photo_url, annees_experience, titre_metier").limit(1)
  if (!techErr) ok("techniciens E-E-A-T", "colonnes présentes")
  else if (/photo_url|annees_experience|titre_metier|column/i.test(techErr.message)) {
    ko("techniciens E-E-A-T", "migration 022 non appliquée")
  } else {
    ko("techniciens", techErr.message)
  }
}

async function main() {
  console.log(`\n🧪 E2E E-E-A-T — client ${TEST_EMAIL}`)
  console.log(`   Base : ${BASE}`)
  if (!INTERNAL_SECRET) {
    console.error("❌ NEXTAUTH_SECRET manquant")
    process.exit(1)
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Supabase non configuré")
    process.exit(1)
  }

  await applyMigrationIfNeeded()

  step("1 — Génération SEO enrichie (technicien + resume_intervention)")
  let seo: Record<string, unknown> = {}
  let rapport: Record<string, unknown> = {}
  {
    const { status, body } = await jfetch(
      `${BASE}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcription:
            "Intervention à Carqueiranne. Canalisation cuisine bouchée sur 50 mètres. " +
            "Cause accumulation de graisse. Hydrocurage 150 bars puis caméra HD. " +
            "Durée 1h30. Écoulement rétabli. Racines fréquentes sur les vieux PVC du secteur.",
          type_intervention: "Débouchage canalisation",
          ville: "Carqueiranne",
          code_postal: "83320",
          technicien_nom: "Spencer",
          technicien_annees: 8,
          technicien_titre: "technicien déboucheur",
        }),
      },
      180_000,
    )
    if (status !== 200 || !body || typeof body !== "object") {
      ko("Génération IA", `HTTP ${status}`)
      process.exit(1)
    }
    const b = body as { rapport?: Record<string, unknown>; seo?: Record<string, unknown> }
    rapport = b.rapport || {}
    seo = b.seo || {}
    ok("Rapport IA généré")

    const resume = seo.resume_intervention as Record<string, string> | null
    if (resume?.lieu && resume?.probleme) ok("resume_intervention", `${resume.lieu}`)
    else ko("resume_intervention", "champs manquants")

    if (typeof seo.expertise_locale === "string" && seo.expertise_locale.length > 30) {
      ok("expertise_locale", seo.expertise_locale.slice(0, 60) + "…")
    } else {
      ko("expertise_locale", "vide ou trop court")
    }

    const jsonld = seo.jsonld as { "@graph"?: unknown[] } | undefined
    const hasPerson = Array.isArray(jsonld?.["@graph"])
      && jsonld!["@graph"]!.some((n: unknown) => n && typeof n === "object" && (n as { "@type"?: string })["@type"] === "Person")
    hasPerson ? ok("JSON-LD Person (Spencer)") : ko("JSON-LD Person", "absent")
  }

  step("2 — HTML publication (blocs E-E-A-T)")
  {
    const { content } = buildPublishContentHtml({
      seo,
      rapport,
      typeIntervention: "Débouchage canalisation",
      ville: "Carqueiranne",
      codePostal: "83320",
      technicien: {
        nom: "Spencer",
        photoUrl: "https://example.com/spencer.jpg",
        anneesExperience: 8,
        titreMetier: "technicien déboucheur",
      },
      photos: [
        { legende: "Avant", categorie: "avant" },
        { legende: "Pendant hydrocurage", categorie: "pendant" },
        { legende: "Après", categorie: "apres" },
        { legende: "Écran caméra", categorie: "camera" },
      ],
    })
    content.includes("ai-summary-block") ? ok("Bloc résumé IA") : ko("Bloc résumé IA")
    content.includes("technicien-block") && content.includes("Spencer") ? ok("Bloc technicien") : ko("Bloc technicien")
    content.includes("expertise-block") || content.includes("Notre retour terrain") ? ok("Bloc expertise locale") : ko("Bloc expertise")
    content.includes("photo-category-section") ? ok("Galerie par catégorie") : ko("Galerie catégories")
  }

  if (SKIP_PUBLISH) {
    console.log("\n━━ Publication ignorée (E2E_SKIP_PUBLISH=1) ━━")
  } else {
    step("3 — Intervention test + publication site")
    const ref = `EEAT-${Date.now()}`
    let interventionId = ""

    const create = await jfetch(`${BASE}/api/interventions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { nom: `Test E-E-A-T ${ref}`, email: TEST_EMAIL, telephone: "0627699134" },
        type_intervention: "Débouchage canalisation",
        ville: "Carqueiranne",
        code_postal: "83320",
        adresse_chantier: "12 rue du Port",
        date_prevue: new Date().toISOString().slice(0, 10),
        prix_prevu: 320,
      }),
    })
    if ((create.status === 200 || create.status === 201) && (create.body as { intervention?: { id: string } })?.intervention?.id) {
      interventionId = (create.body as { intervention: { id: string } }).intervention.id
      ok("Intervention créée", interventionId.slice(0, 8))
    } else {
      ko("Création intervention", `HTTP ${create.status}`)
      process.exit(1)
    }

    // Technicien assigné + photos catégorisées
    const { data: tech } = await sb.from("techniciens").select("id, nom").eq("actif", true).limit(1).maybeSingle()
    if (tech?.id) {
      await sb.from("interventions").update({ technicien_id: tech.id }).eq("id", interventionId)
      ok("Technicien assigné", tech.nom)
    }

    const photos = [
      "https://lestechniciensdudebouchage.fr/media/gallery/before/IMG_6988.jpeg",
      "https://lestechniciensdudebouchage.fr/media/gallery/after/IMG_6990.jpeg",
      "https://lestechniciensdudebouchage.fr/media/gallery/before/IMG_7002.jpeg",
    ]
    const { error: phErr } = await sb.from("interventions").update({
      photos_urls: photos,
      photos_legendes: ["Photo avant intervention", "Photo après intervention", "Écran caméra défaut graisse"],
      photos_categories: ["avant", "apres", "camera"],
    }).eq("id", interventionId)
    phErr ? ko("Photos seed", phErr.message) : ok("Photos + catégories")

    const save = await jfetch(`${BASE}/api/save-rapport`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interventionId,
        rapport,
        seo,
        transcription: "test eeat carqueiranne",
        typeIntervention: "Débouchage canalisation",
        dateIntervention: new Date().toISOString().slice(0, 10),
      }),
    })
    save.status === 200 ? ok("Rapport sauvegardé") : ko("Save rapport", `HTTP ${save.status}`)

    const pub = await jfetch(
      `${BASE}/api/publish/from-intervention`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId }),
      },
      120_000,
    )
    if (pub.status === 200 && (pub.body as { slug?: string })?.slug) {
      const slug = (pub.body as { slug: string }).slug
      ok("Publication site", slug)
      console.log(`\n  🌐 https://lestechniciensdudebouchage.fr/nos-realisations/${slug}`)
    } else {
      ko("Publication", `HTTP ${pub.status} — ${JSON.stringify(pub.body).slice(0, 300)}`)
    }

    const { data: iv } = await sb
      .from("interventions")
      .select("seo_json, publie_slug")
      .eq("id", interventionId)
      .single()
    const savedSeo = iv?.seo_json as Record<string, unknown> | null
    if (savedSeo?.resume_intervention) ok("seo_json.resume_intervention persisté")
    else ko("seo_json.resume_intervention", "absent")
  }

  console.log(`\n${"═".repeat(52)}`)
  console.log(`  ${pass} ✅   ${fail} ❌`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

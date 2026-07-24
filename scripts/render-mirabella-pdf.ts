/**
 * Génère le PDF Mirabella tronçon par tronçon puis fusionne.
 * (react-pdf plante si toutes les photos sont dans un seul Document)
 * Usage: npx tsx scripts/render-mirabella-pdf.ts
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import {
  InspectionDocument,
  type InspectionData,
  type TronconBloc,
  type ConclusionEtat,
} from "../components/InspectionCameraPDF"
import { PRECONISATIONS } from "../lib/camera-defauts"

const draftPath = path.resolve("public/recup/ITV-20260724-1513-mirabella.json")
const outPath = path.resolve("public/recup/ITV-20260724-1513-mirabella.pdf")
const partsDir = path.resolve("_tmp-pdf-preview/mira-parts")

type Draft = {
  numero: string
  dateInspection: string
  technicienNom: string
  clientNom: string
  clientAdresse: string
  clientCP: string
  clientVille: string
  clientEmail: string
  clientTel: string
  troncons: Array<{
    nom: string
    reseau: string
    materiau: string
    diametre: string
    longueurM: string
    regardAmont: string
    regardAval: string
    sensInspection: string
    materielUtilise: string
    conditionsMeteo: string
    observations: Array<{
      position: string
      code?: string
      description: string
      photoUrl?: string
      photoLegende?: string
    }>
    precoSelected: string[]
    precoCustom: { titre: string; detail: string }[]
    resume: string
    conclusionEtat: ConclusionEtat
  }>
}

function buildBlocs(draft: Draft): TronconBloc[] {
  return draft.troncons.map((t, i) => {
    const fromPresets = (t.precoSelected || [])
      .map(id => PRECONISATIONS.find(p => p.id === id))
      .filter((p): p is (typeof PRECONISATIONS)[number] => Boolean(p))
      .map(p => ({ titre: p.titre, detail: p.detail, urgence: p.urgence }))
    const custom = (t.precoCustom || []).map(p => ({
      titre: p.titre,
      detail: p.detail,
      urgence: undefined as string | undefined,
    }))
    return {
      nom: t.nom?.trim() || `Tronçon ${i + 1}`,
      caracteristiques: {
        reseau: t.reseau,
        materiau: t.materiau,
        diametre: t.diametre,
        longueurM: t.longueurM ? Number(t.longueurM) : undefined,
        regardAmont: t.regardAmont,
        regardAval: t.regardAval,
        sensInspection: t.sensInspection,
        materielUtilise: t.materielUtilise,
        conditionsMeteo: t.conditionsMeteo,
      },
      observations: (t.observations || [])
        .filter(o => o.position || o.description || o.photoUrl || o.code)
        .map(o => ({
          position: o.position,
          code: o.code || undefined,
          description: o.description,
          photoUrl: o.photoUrl,
          photoLegende: o.photoLegende,
        })),
      preconisations: [...fromPresets, ...custom],
      resume: t.resume || "",
      conclusionEtat: t.conclusionEtat || "bon",
    }
  })
}

function meta(draft: Draft, troncons: TronconBloc[]): InspectionData {
  return {
    numero: draft.numero,
    dateInspection: draft.dateInspection,
    technicienNom: draft.technicienNom,
    agence: "LTDB Toulon",
    client: {
      nom: draft.clientNom,
      adresse: draft.clientAdresse,
      codePostal: draft.clientCP,
      ville: draft.clientVille,
      email: draft.clientEmail || undefined,
      telephone: draft.clientTel || undefined,
    },
    troncons,
    conclusionEtat: "bon",
  }
}

async function renderOne(label: string, data: InspectionData, file: string) {
  const buf = await renderToBuffer(createElement(InspectionDocument, { data }))
  if (!buf || buf.length < 1500) throw new Error(`${label}: PDF trop petit (${buf?.length})`)
  fs.writeFileSync(file, buf)
  console.log(label, buf.length, "→", path.basename(file))
}

async function main() {
  const draft = JSON.parse(fs.readFileSync(draftPath, "utf8")) as Draft
  const blocs = buildBlocs(draft)
  fs.mkdirSync(partsDir, { recursive: true })
  for (const f of fs.readdirSync(partsDir)) {
    if (f.endsWith(".pdf")) fs.unlinkSync(path.join(partsDir, f))
  }

  const partFiles: string[] = []

  // Intro : identité + conclusion, sans photos
  const introPath = path.join(partsDir, "00-intro.pdf")
  await renderOne(
    "intro",
    meta(draft, [{
      nom: "Vue d'ensemble",
      caracteristiques: {},
      observations: [],
      preconisations: [],
      resume: `${blocs.length} tronçons inspectés — détail et photos aux pages suivantes.`,
      conclusionEtat: "bon",
    }]),
    introPath,
  )
  partFiles.push(introPath)

  for (let i = 0; i < blocs.length; i++) {
    const file = path.join(partsDir, `${String(i + 1).padStart(2, "0")}-troncon.pdf`)
    await renderOne(`tronçon ${i + 1}`, meta(draft, [blocs[i]]), file)
    partFiles.push(file)
  }

  const mergePy = `
from pypdf import PdfWriter
import sys
w = PdfWriter()
for f in sys.argv[1:-1]:
    w.append(f)
w.write(sys.argv[-1])
w.close()
print("merged", sys.argv[-1])
`
  const r = spawnSync("python3", ["-c", mergePy, ...partFiles, outPath], { encoding: "utf8" })
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr)
    throw new Error("merge failed")
  }
  console.log(r.stdout.trim())
  fs.copyFileSync(outPath, path.resolve("_recup-itv/inspection-camera-mirabella-ITV-20260724-1513-FIXED.pdf"))
  console.log("ok", fs.statSync(outPath).size, "bytes →", outPath)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

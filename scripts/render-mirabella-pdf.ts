/**
 * Génère le PDF Mirabella depuis le brouillon public/recup.
 * Usage: npx tsx scripts/render-mirabella-pdf.ts
 */
import fs from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { InspectionDocument, type InspectionData, type TronconBloc, type ConclusionEtat } from "../components/InspectionCameraPDF"
import { PRECONISATIONS } from "../lib/camera-defauts"

const draftPath = path.resolve("public/recup/ITV-20260724-1513-mirabella.json")
const outPath = path.resolve("public/recup/ITV-20260724-1513-mirabella.pdf")

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

function buildData(draft: Draft): InspectionData {
  const blocs: TronconBloc[] = draft.troncons.map((t, i) => {
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
    troncons: blocs,
    conclusionEtat: "bon",
  }
}

async function main() {
  const draft = JSON.parse(fs.readFileSync(draftPath, "utf8")) as Draft
  const data = buildData(draft)
  console.log("render", data.numero, "troncons", data.troncons.length)
  const t0 = Date.now()
  const buf = await renderToBuffer(createElement(InspectionDocument, { data }))
  if (!buf || buf.length < 2000) throw new Error(`PDF trop petit: ${buf?.length}`)
  fs.writeFileSync(outPath, buf)
  fs.copyFileSync(outPath, path.resolve("_recup-itv/inspection-camera-mirabella-ITV-20260724-1513-FIXED.pdf"))
  console.log("ok", buf.length, "bytes in", Date.now() - t0, "ms →", outPath)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

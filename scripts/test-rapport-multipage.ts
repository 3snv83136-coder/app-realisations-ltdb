import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { writeFileSync } from "fs"
import { RealisationDocument } from "../components/RealisationPDF"

async function main() {
  const longText =
    "L'inspection caméra a confirmé l'état du réseau sans cassure ni obstacle. ".repeat(40)

  const props = {
    clientNom: "Test Client",
    adresse: "1 rue Test",
    ville: "Toulon",
    codePostal: "83000",
    dateIntervention: "2026-07-01",
    typeIntervention: "Inspection caméra",
    technicienNom: "mondor",
    reference: "LTDB-20260701-0900",
    photos: [],
    rapport: {
      objet: "Inspection caméra réseau",
      contexte: longText,
      diagnostic: longText,
      travaux_realises: longText,
      phases: Array.from({ length: 8 }, (_, i) => ({
        titre: `Phase ${i + 1}`,
        description: longText.slice(0, 200),
      })),
      recommandations: longText,
      avis_technique: {
        diagnostic_final: longText,
        recommandation_urgente: longText,
      },
      commentaire_technicien: "RAS",
    },
  }

  const buf = await renderToBuffer(createElement(RealisationDocument, props))
  writeFileSync("/tmp/test-rapport-multipage.pdf", buf)
  console.log("written /tmp/test-rapport-multipage.pdf", buf.byteLength, "bytes")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

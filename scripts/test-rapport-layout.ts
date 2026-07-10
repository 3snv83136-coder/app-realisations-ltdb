import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { writeFileSync } from 'fs'
import { RealisationDocument } from '../components/RealisationPDF'

async function main() {
  const props = {
    clientNom: 'Lachevre',
    adresse: '168 chemin de beaucours',
    ville: 'Sanary-sur-Mer',
    codePostal: '83110',
    dateIntervention: '2026-07-10',
    typeIntervention: 'Débouchage évier',
    technicienNom: 'mondor',
    technicienPhotoUrl: null,
    reference: 'LTDB-20260710-1330',
    photos: [],
    rapport: {
      objet: 'Débouchage et diagnostic réseau évacuation cuisine',
      contexte: 'Intervention demandée par le gestionnaire pour un problème évacuation évier cuisine professionnelle.',
      diagnostic: 'Réseau partiellement obstrué.',
      travaux_realises: 'Débouchage mécanique réalisé.',
      recommandations: 'Surveillance des écoulements.',
      commentaire_technicien: 'Intervention terminée.',
    },
  }

  const buf = await renderToBuffer(createElement(RealisationDocument, props))
  writeFileSync('/tmp/test-rapport-layout.pdf', buf)
  console.log('bytes', buf.byteLength)

  const raw = Buffer.from(buf).toString('latin1')
  const count = raw.match(/\/Count\s+(\d+)/)?.[1]
  console.log('page count hint', count)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

/** Texte SMS envoyé au technicien lors d'une nouvelle intervention assignée. */

function fmtDateFR(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

function fmtHeure(h?: string | null): string {
  if (!h) return ''
  const m = /^(\d{2}):(\d{2})/.exec(h)
  if (!m) return h
  return m[2] === '00' ? `${m[1]}h` : `${m[1]}h${m[2]}`
}

function buildAdresseLigne(parts: {
  adresseChantier?: string | null
  codePostal?: string | null
  ville?: string | null
}): string {
  const adr = (parts.adresseChantier || '').trim()
  const cpVille = [parts.codePostal, parts.ville].filter(Boolean).join(' ').trim()
  if (adr && cpVille) return `${adr}, ${cpVille}`
  return adr || cpVille
}

export function buildTechnicienInterventionSmsText(opts: {
  technicienNom?: string | null
  clientNom?: string | null
  clientTelephone?: string | null
  adresseChantier?: string | null
  ville?: string | null
  codePostal?: string | null
  datePrevue?: string | null
  heurePrevue?: string | null
  typeIntervention?: string | null
  urgence?: boolean
  lien?: string | null
}): string {
  const type = (opts.typeIntervention || 'Intervention').trim()
  const date = fmtDateFR(opts.datePrevue)
  const heure = fmtHeure(opts.heurePrevue)
  const client = (opts.clientNom || 'Client').trim()
  const tel = (opts.clientTelephone || '').trim()
  const adresse = buildAdresseLigne(opts)
  const salut = opts.technicienNom ? `Bonjour ${opts.technicienNom.split(/\s+/)[0]},` : 'Bonjour,'

  const lines: string[] = []
  if (opts.urgence) lines.push('URGENT - Nouvelle intervention LTDB')
  else lines.push('Nouvelle intervention LTDB')

  const quand = [date, heure].filter(Boolean).join(' a ')
  lines.push([type, quand].filter(Boolean).join(' | '))
  lines.push(tel ? `${client} - ${tel}` : client)
  if (adresse) lines.push(adresse)
  if (opts.lien) lines.push(opts.lien.replace(/^https?:\/\//, ''))

  return `${salut}\n${lines.join('\n')}`
}

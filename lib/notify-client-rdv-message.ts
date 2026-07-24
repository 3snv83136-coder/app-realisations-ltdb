import { labelModePaiement } from "@/lib/mode-paiement"

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

/** SMS commercial de confirmation de RDV au client. */
export function buildClientRdvSmsText(opts: {
  clientNom?: string | null
  typeIntervention?: string | null
  datePrevue?: string | null
  heurePrevue?: string | null
  modePaiement?: string | null
  telEntreprise?: string | null
}): string {
  const prenom = (opts.clientNom || '').trim().split(/\s+/)[0]
  const salut = prenom ? `Bonjour ${prenom},` : 'Bonjour,'
  const type = (opts.typeIntervention || 'intervention').trim()
  const date = fmtDateFR(opts.datePrevue)
  const heure = fmtHeure(opts.heurePrevue)
  const quand = [date, heure ? `a ${heure}` : ''].filter(Boolean).join(' ')
  const paiement = labelModePaiement(opts.modePaiement)
  const tel = (opts.telEntreprise || '').trim()

  const lines = [
    salut,
    `Nous avons bien pris en compte votre demande d'intervention (${type}).`,
    quand
      ? `Notre technicien interviendra le ${quand}.`
      : 'Notre technicien interviendra prochainement.',
  ]

  if (paiement) {
    lines.push(`Reglement accepte : ${paiement}.`)
  }

  lines.push('Merci de votre confiance.')
  lines.push('Les Techniciens du Debouchage')
  if (tel) lines.push(tel)

  return lines.join('\n')
}

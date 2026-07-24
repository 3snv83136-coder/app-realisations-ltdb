import { formatCreneau } from "@/lib/creneau"
import { labelModesPaiement } from "@/lib/mode-paiement"

function fmtDateFR(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** SMS commercial de confirmation de RDV au client. */
export function buildClientRdvSmsText(opts: {
  clientNom?: string | null
  typeIntervention?: string | null
  datePrevue?: string | null
  heurePrevue?: string | null
  heureFinPrevue?: string | null
  modePaiement?: string | null
  telEntreprise?: string | null
}): string {
  const prenom = (opts.clientNom || '').trim().split(/\s+/)[0]
  const salut = prenom ? `Bonjour ${prenom},` : 'Bonjour,'
  const type = (opts.typeIntervention || 'intervention').trim()
  const date = fmtDateFR(opts.datePrevue)
  const creneau = formatCreneau(opts.heurePrevue, opts.heureFinPrevue)
  const paiement = labelModesPaiement(opts.modePaiement)
  const tel = (opts.telEntreprise || '').trim()

  let quandLine = 'Notre technicien interviendra prochainement.'
  if (date && creneau) {
    quandLine = `Notre technicien interviendra le ${date} entre ${creneau.replace('–', ' et ')}.`
  } else if (date) {
    quandLine = `Notre technicien interviendra le ${date}.`
  }

  const lines = [
    salut,
    `Nous avons bien pris en compte votre demande d'intervention (${type}).`,
    quandLine,
  ]

  if (paiement) {
    lines.push(`Reglement accepte : ${paiement}.`)
  }

  lines.push('Merci de votre confiance.')
  lines.push('Les Techniciens du Debouchage')
  if (tel) lines.push(tel)

  return lines.join('\n')
}

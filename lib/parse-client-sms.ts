/**
 * Parse un SMS / texte libre client pour pré-remplir une fiche intervention.
 * Heuristiques locales (pas d'IA) — instantané et utilisable hors-ligne.
 */

export type ParsedClientSms = {
  nom: string
  telephone: string
  email: string
  adresse: string
  code_postal: string
  ville: string
  /** Champs effectivement détectés (pour feedback UI). */
  filled: Array<keyof Omit<ParsedClientSms, 'filled'>>
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
/** FR : 0X XX XX XX XX, +33…, 0033…, avec espaces / points / tirets */
const PHONE_RE = /(?:\+33|0033|0)\s*[1-9](?:[\s./-]?\d{2}){4}/g
const CP_RE = /\b((?:0[1-9]|[1-8]\d|9[0-5]|2[abAB]|97[1-6])\d{3})\b/
const STREET_RE =
  /\b(?:\d{1,4}\s*(?:bis|ter|quater)?\s+)?(?:rue|av(?:enue)?|bd|boulevard|all[ée]e|chemin|impasse|place|cours|route|quai|square|passage|mont[ée]e|traverse|lotissement|r[ée]sidence|domaine|hameau|voie|imp\.?|rte)\b[\wÀ-ÿ'’\s.-]{2,60}/i
const NAME_HINT_RE =
  /^(?:m(?:me|lle|\.?|onsieur)?|mr|mme|mlle|madame|monsieur)\s+[\wÀ-ÿ'’-]+(?:\s+[\wÀ-ÿ'’-]+){0,3}$/i
const LABEL_STRIP_RE =
  /^(?:nom|client|coordonn[ée]es?|adresse|adr\.?|tel(?:ephone)?|t[ée]l\.?|portable|mobile|email|mail|ville|cp|code\s*postal)\s*[:\-–]\s*/i

function formatPhoneFr(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('33') && digits.length >= 11) digits = `0${digits.slice(2)}`
  if (digits.startsWith('0033')) digits = `0${digits.slice(4)}`
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  }
  return raw.trim()
}

function cleanLine(line: string): string {
  return line.replace(LABEL_STRIP_RE, '').replace(/\s+/g, ' ').trim()
}

function looksLikeName(line: string): boolean {
  if (!line || line.length < 2 || line.length > 60) return false
  if (/\d{5}/.test(line)) return false
  if (EMAIL_RE.test(line)) return false
  if (PHONE_RE.test(line)) return false
  if (STREET_RE.test(line)) return false
  if (/^(bonjour|salut|hello|coucou|merci|cordialement|ok|voici|adresse)/i.test(line)) return false
  // Au moins une lettre, pas uniquement des symboles
  if (!/[A-Za-zÀ-ÿ]/.test(line)) return false
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length > 5) return false
  return NAME_HINT_RE.test(line) || words.every(w => /^[\wÀ-ÿ'’-]+$/i.test(w))
}

/**
 * Extrait nom / téléphone / email / adresse / CP / ville depuis un texto collé.
 */
export function parseClientSms(raw: string): ParsedClientSms {
  const empty: ParsedClientSms = {
    nom: '',
    telephone: '',
    email: '',
    adresse: '',
    code_postal: '',
    ville: '',
    filled: [],
  }
  const text = (raw || '').replace(/\r\n/g, '\n').trim()
  if (!text || text.length < 5) return empty

  let working = text

  // Email
  const emailMatch = working.match(EMAIL_RE)
  const email = emailMatch ? emailMatch[0] : ''
  if (email) working = working.replace(email, ' ')

  // Téléphone (premier numéro FR trouvé)
  const phoneMatches = working.match(PHONE_RE) || []
  const telephone = phoneMatches[0] ? formatPhoneFr(phoneMatches[0]) : ''
  for (const p of phoneMatches) working = working.replace(p, ' ')

  // Code postal (+ ville éventuelle sur la même ligne)
  let code_postal = ''
  let ville = ''
  let adresse = ''
  let nom = ''

  const lines = working
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)

  // Cherche "83000 Toulon" ou "Toulon 83000"
  for (const line of lines) {
    const cpMatch = line.match(CP_RE)
    if (!cpMatch) continue
    code_postal = cpMatch[1]
    const beforeCp = line.slice(0, line.indexOf(cpMatch[0])).replace(/[,;]\s*$/, '').trim()
    const afterCp = line.slice(line.indexOf(cpMatch[0]) + cpMatch[0].length).replace(/^[,;.\-\s]+/, '').trim()

    // Après le CP → ville (ex. "83000 Toulon")
    if (!ville && afterCp) {
      let villeCandidate = afterCp
        .replace(/\b(?:tel(?:ephone)?|t[ée]l\.?|portable|mobile|email|mail)\b.*$/i, '')
        .split(/[,;]/)[0]
        .replace(/\s+/g, ' ')
        .trim()
      // Garde au plus 4 mots (évite "Toulon tel Jean Martin")
      const words = villeCandidate.split(/\s+/).filter(Boolean)
      if (words.length > 3) villeCandidate = words.slice(0, 3).join(' ')
      if (
        villeCandidate.length >= 2
        && villeCandidate.length <= 40
        && !STREET_RE.test(villeCandidate)
        && !/\d{3,}/.test(villeCandidate)
      ) {
        ville = villeCandidate
      }
    }
    // Avant le CP : soit ville ("Toulon 83000"), soit adresse
    if (beforeCp) {
      const streetInBefore = beforeCp.match(STREET_RE)
      if (streetInBefore) {
        if (!adresse) adresse = streetInBefore[0].replace(/[,;]\s*$/, '').trim()
      } else if (/^\d{1,4}\s+\S+/.test(beforeCp)) {
        if (!adresse) adresse = beforeCp
      } else if (!ville && beforeCp.length >= 2 && beforeCp.length <= 40 && !/\d{3,}/.test(beforeCp)) {
        ville = beforeCp.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '')
      }
    }
  }

  // Adresse : ligne avec type de voie, ou ligne numérique seule
  if (!adresse) {
    for (const line of lines) {
      const cleaned = line.replace(CP_RE, '').replace(/\s+/g, ' ').trim()
      // Ignore le préambule type "Bonjour mon adresse …"
      const streetMatch = cleaned.match(STREET_RE)
      if (streetMatch) {
        adresse = streetMatch[0].replace(/[,;]\s*$/, '').trim()
        break
      }
    }
  }
  if (!adresse) {
    // Fallback : "12 rue xxx" même sans mot-clé reconnu (numéro + texte)
    for (const line of lines) {
      if (/^\d{1,4}\s+\S+/.test(line) && !CP_RE.test(line) && line.length > 5) {
        adresse = line.replace(CP_RE, '').trim()
        break
      }
    }
  }

  // Ville seule sur une ligne (si pas déjà trouvée via CP)
  if (!ville) {
    for (const line of lines) {
      if (line === adresse || line === nom) continue
      if (STREET_RE.test(line) || CP_RE.test(line)) continue
      if (looksLikeName(line) && NAME_HINT_RE.test(line)) continue
      // Ligne courte sans chiffre = candidate ville
      if (/^[A-Za-zÀ-ÿ'’\-\s]{2,40}$/.test(line) && !/^(mme?|mr|monsieur|madame)\b/i.test(line)) {
        // Préférer les lignes qui ne sont pas le nom (nom souvent en 1ère ligne)
        if (lines.indexOf(line) > 0 || lines.length === 1) {
          ville = line
          break
        }
      }
    }
  }

  // Nom : première ligne plausible, ou ligne M./Mme
  for (const line of lines) {
    if (line === adresse || line === ville) continue
    if (CP_RE.test(line) || STREET_RE.test(line)) continue
    if (looksLikeName(line)) {
      nom = line
      break
    }
  }
  // SMS monoligne type "…, Martin Sophie, 04…" → segment avant le 1er téléphone / adresse
  if (!nom) {
    const firstSeg = text
      .split(/[,;\n]/)[0]
      ?.replace(LABEL_STRIP_RE, '')
      .replace(/^(bonjour|salut|hello|coucou|voici|coordonn[ée]es?)\s*/i, '')
      .trim()
    if (firstSeg && looksLikeName(firstSeg) && !STREET_RE.test(firstSeg)) {
      nom = firstSeg
    }
  }
  // Si rien : première ligne courte non-adresse
  if (!nom) {
    for (const line of lines) {
      if (line === adresse || line === ville) continue
      if (STREET_RE.test(line) || CP_RE.test(line)) continue
      if (line.length >= 2 && line.length <= 50 && /[A-Za-zÀ-ÿ]/.test(line)) {
        // Évite de prendre "Bonjour mon adresse …" comme nom
        if (/^(bonjour|salut|hello|coucou|merci|voici|adresse)/i.test(line)) continue
        nom = line
        break
      }
    }
  }

  // Aussi chercher dans le texte monoligne (SMS sans retours)
  if (!code_postal) {
    const m = text.match(CP_RE)
    if (m) code_postal = m[1]
  }
  if (!adresse) {
    const m = text.match(STREET_RE)
    if (m) adresse = m[0].replace(/\s+/g, ' ').trim()
  }

  const result: ParsedClientSms = {
    nom: nom.trim(),
    telephone: telephone.trim(),
    email: email.trim(),
    adresse: adresse.trim(),
    code_postal: code_postal.trim(),
    ville: ville.trim(),
    filled: [],
  }
  ;(Object.keys(result) as Array<keyof ParsedClientSms>).forEach(k => {
    if (k === 'filled') return
    if (result[k]) result.filled.push(k)
  })
  return result
}

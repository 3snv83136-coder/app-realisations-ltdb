/**
 * Parsing tolérant du JSON renvoyé par un LLM.
 *
 * Les LLM produisent régulièrement du JSON "presque valide" : fences markdown,
 * texte d'introduction, caractères de contrôle littéraux dans les chaînes,
 * virgules traînantes, guillemets typographiques, réponses tronquées.
 * `parseAiJson` enchaîne plusieurs stratégies de réparation, de la plus sûre
 * à la plus agressive, et lève seulement si tout échoue.
 */

/**
 * Échappe les caractères de contrôle littéraux (\n \t \r etc.) présents
 * À L'INTÉRIEUR des chaînes JSON. C'est le mode d'échec n°1 des LLM :
 * ils insèrent de vrais retours à la ligne dans les valeurs de chaîne,
 * que JSON.parse rejette ("Bad control character in string literal").
 */
export function escapeControlCharsInStrings(s: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const code = c.charCodeAt(0)
    if (escaped) { out += c; escaped = false; continue }
    if (c === '\\') { out += c; escaped = true; continue }
    if (c === '"') { inString = !inString; out += c; continue }
    if (inString && code < 0x20) {
      if (code === 0x0a) out += '\\n'
      else if (code === 0x09) out += '\\t'
      else if (code === 0x0d) out += '\\r'
      else if (code === 0x08) out += '\\b'
      else if (code === 0x0c) out += '\\f'
      else out += '\\u' + code.toString(16).padStart(4, '0')
      continue
    }
    out += c
  }
  return out
}

/** Retire les virgules traînantes (`,}` / `,]`) hors des chaînes. */
export function stripTrailingCommas(s: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escaped) { out += c; escaped = false; continue }
    if (c === '\\') { out += c; escaped = true; continue }
    if (c === '"') { inString = !inString; out += c; continue }
    if (!inString && c === ',') {
      let j = i + 1
      while (j < s.length && /\s/.test(s[j])) j++
      if (s[j] === '}' || s[j] === ']') continue
    }
    out += c
  }
  return out
}

/** Ferme les chaînes / objets / tableaux ouverts en fin de réponse tronquée. */
export function repairJson(s: string): string {
  let result = s
  let inString = false
  let escaped = false
  for (let i = 0; i < result.length; i++) {
    const c = result[i]
    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }
    if (c === '"') inString = !inString
  }
  if (inString) result = result + '"'
  let opens = 0, closes = 0, bOpens = 0, bCloses = 0
  inString = false; escaped = false
  for (const c of result) {
    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') opens++
    if (c === '}') closes++
    if (c === '[') bOpens++
    if (c === ']') bCloses++
  }
  while (bCloses < bOpens) { result += ']'; bCloses++ }
  while (closes < opens) { result += '}'; closes++ }
  return result
}

/**
 * Parse le JSON d'une réponse LLM en enchaînant les stratégies de réparation.
 * Lève `Error('JSON invalide et irréparable')` si aucune ne fonctionne.
 */
export function parseAiJson(raw: string): any {
  // 1. Retire fences markdown + normalise les guillemets typographiques
  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
  // 2. Retire le texte parasite avant/après le bloc JSON
  const firstBrace = cleaned.indexOf('{')
  const lastBraceIdx = cleaned.lastIndexOf('}')
  if (firstBrace >= 0 && lastBraceIdx > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBraceIdx + 1)
  }

  // Essai 1 — tel quel
  try { return JSON.parse(cleaned) } catch {}
  // Essai 2 — échappe les caractères de contrôle littéraux (mode d'échec LLM n°1)
  const noCtrl = escapeControlCharsInStrings(cleaned)
  try { return JSON.parse(noCtrl) } catch {}
  // Essai 3 — + retire les virgules traînantes
  const noTrailing = stripTrailingCommas(noCtrl)
  try { return JSON.parse(noTrailing) } catch {}
  // Essai 4 — troncature : couper au dernier objet/tableau valide
  const lastBrace = Math.max(noTrailing.lastIndexOf('}'), noTrailing.lastIndexOf(']'))
  if (lastBrace > 0) {
    for (let i = lastBrace; i > 0; i--) {
      try { return JSON.parse(noTrailing.slice(0, i + 1)) } catch {}
    }
  }
  // Essai 5 — réparation agressive : fermer chaînes/objets/tableaux ouverts
  try { return JSON.parse(repairJson(noTrailing)) } catch {}
  throw new Error('JSON invalide et irréparable')
}

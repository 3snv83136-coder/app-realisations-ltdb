export type LigneReleve = {
  date_operation: string
  date_valeur?: string
  libelle: string
  debit: number
  credit: number
  reference_brute: string
}

function normHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/** Parse montant FR/EU : 1.234,56 € / -123,45 / 123.45 */
function parseMontant(raw: string, keepSign = false): number {
  let s = (raw || "").trim()
  if (!s || s === "-") return 0

  s = s.replace(/[€$£\s\u00a0]/g, "")
  const negative = s.startsWith("-") || s.startsWith("(")
  s = s.replace(/^\(|\)$/g, "").replace(/^-/, "")

  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    s = s.replace(/,/g, "")
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  if (keepSign) return negative ? -Math.abs(n) : n
  return Math.abs(n)
}

function parseDateFr(raw: string): string | null {
  const s = raw.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s)
  if (fr) {
    const d = fr[1].padStart(2, "0")
    const m = fr[2].padStart(2, "0")
    return `${fr[3]}-${m}-${d}`
  }
  return null
}

function detectSeparator(line: string): ";" | "," | "\t" {
  const counts = { ";": 0, ",": 0, "\t": 0 }
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes) {
      if (ch === ";") counts[";"]++
      else if (ch === ",") counts[","]++
      else if (ch === "\t") counts["\t"]++
    }
  }
  if (counts["\t"] >= counts[";"] && counts["\t"] >= counts[","]) return "\t"
  if (counts[";"] >= counts[","]) return ";"
  return ","
}

/** Découpe CSV en respectant les guillemets (libellés avec ; ou ,). */
function splitLine(line: string, sep: ";" | "," | "\t"): string[] {
  if (sep === "\t") return line.split("\t").map(c => c.trim().replace(/^"|"$/g, ""))

  const result: string[] = []
  let cur = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim().replace(/^"|"$/g, ""))
      cur = ""
    } else {
      cur += ch
    }
  }
  result.push(cur.trim().replace(/^"|"$/g, ""))
  return result
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex(h => p.test(h))
    if (i >= 0) return i
  }
  return -1
}

function montantsFromCols(cols: string[], idxDebit: number, idxCredit: number, idxMontant: number): { debit: number; credit: number } {
  let debit = idxDebit >= 0 ? parseMontant(cols[idxDebit] || "") : 0
  let credit = idxCredit >= 0 ? parseMontant(cols[idxCredit] || "") : 0

  if (debit === 0 && credit === 0 && idxMontant >= 0) {
    const raw = cols[idxMontant] || ""
    const signed = parseMontant(raw, true)
    if (signed < 0) debit = Math.abs(signed)
    else if (signed > 0) credit = signed
    else {
      const abs = parseMontant(raw)
      const neg = raw.includes("-") || raw.includes("(")
      if (abs > 0) {
        if (neg) debit = abs
        else credit = abs
      }
    }
  }

  return { debit, credit }
}

/** Dernier recours : plus grande valeur numérique de la ligne (hors date). */
function montantFallback(cols: string[], skipIndexes: Set<number>): { debit: number; credit: number } {
  let best = 0
  let bestSigned = 0
  for (let i = 0; i < cols.length; i++) {
    if (skipIndexes.has(i)) continue
    const raw = cols[i]
    if (!raw || parseDateFr(raw)) continue
    const signed = parseMontant(raw, true)
    const abs = Math.abs(signed)
    if (abs > best && abs < 1_000_000_000) {
      best = abs
      bestSigned = signed
    }
  }
  if (best === 0) return { debit: 0, credit: 0 }
  if (bestSigned < 0) return { debit: best, credit: 0 }
  return { debit: 0, credit: best }
}

/**
 * Parse un export CSV/TSV (Qonto, banques FR).
 * Qonto simplifié : Date de règlement ; Nom de la contrepartie ; Montant (signé).
 * Qonto détaillé : Débit / Crédit ou Montant (TTC).
 */
export function parseReleveCsv(content: string): { lignes: LigneReleve[]; errors: string[] } {
  const errors: string[] = []
  const rawLines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  if (rawLines.length < 2) {
    return { lignes: [], errors: ["Fichier CSV vide ou sans données"] }
  }

  const sep = detectSeparator(rawLines[0])
  const headers = splitLine(rawLines[0], sep).map(normHeader)

  const idxDate = findColumn(headers, [
    /^date de reglement/,
    /^date reglement/,
    /^settlement date/,
    /^date$/,
    /date.*operation/,
    /^date /,
    /date/,
  ])
  const idxDateValeur = findColumn(headers, [/date.*valeur/, /^valeur$/])
  const idxLibelle = findColumn(headers, [
    /^libelle/,
    /^label/,
    /^description/,
    /^reference/,
    /^nom de la contrepartie/,
    /^nom du beneficiaire/,
    /^nom beneficiaire/,
    /^beneficiaire/,
    /^contrepartie/,
    /^counterparty/,
    /^operation/,
  ])
  const idxDebit = findColumn(headers, [/^debit/, /^sortant/])
  const idxCredit = findColumn(headers, [/^credit/, /^entrant/])
  const idxMontant = findColumn(headers, [/^montant/, /^amount/, /montant.*ttc/, /montant.*eur/])

  if (idxDate < 0) {
    return {
      lignes: [],
      errors: ["Colonne date introuvable. En-têtes : " + headers.join(" | ")],
    }
  }

  if (idxLibelle < 0 && idxMontant < 0 && idxDebit < 0) {
    return {
      lignes: [],
      errors: ["Colonne libellé/montant introuvable. En-têtes : " + headers.join(" | ")],
    }
  }

  const lignes: LigneReleve[] = []

  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitLine(rawLines[i], sep)
    const dateOp = parseDateFr(cols[idxDate] || "")
    if (!dateOp) {
      errors.push(`Ligne ${i + 1} : date invalide`)
      continue
    }

    let { debit, credit } = montantsFromCols(cols, idxDebit, idxCredit, idxMontant)

    if (debit === 0 && credit === 0) {
      const skip = new Set([idxDate, idxDateValeur].filter(j => j >= 0))
      const fb = montantFallback(cols, skip)
      debit = fb.debit
      credit = fb.credit
    }

    if (debit === 0 && credit === 0) {
      errors.push(`Ligne ${i + 1} : montant nul ou illisible`)
      continue
    }

    if (debit > 0 && credit > 0) {
      errors.push(`Ligne ${i + 1} : débit et crédit simultanés — ignorée`)
      continue
    }

    let libelle = idxLibelle >= 0 ? (cols[idxLibelle] || "").trim() : ""
    if (!libelle) {
      libelle = cols.find((c, j) => j !== idxDate && j !== idxDebit && j !== idxCredit && j !== idxMontant && c.trim().length > 2) || "Opération"
    }

    const dateValeur = idxDateValeur >= 0 ? parseDateFr(cols[idxDateValeur] || "") : null

    lignes.push({
      date_operation: dateOp,
      date_valeur: dateValeur || undefined,
      libelle,
      debit,
      credit,
      reference_brute: rawLines[i],
    })
  }

  return { lignes, errors }
}

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

function parseMontant(raw: string): number {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".")
  if (!s || s === "-") return 0
  const n = Number(s)
  return Number.isFinite(n) ? Math.abs(n) : 0
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
  for (const ch of line) {
    if (ch === ";") counts[";"]++
    else if (ch === ",") counts[","]++
    else if (ch === "\t") counts["\t"]++
  }
  if (counts["\t"] >= counts[";"] && counts["\t"] >= counts[","]) return "\t"
  if (counts[";"] >= counts[","]) return ";"
  return ","
}

function splitLine(line: string, sep: ";" | "," | "\t"): string[] {
  if (sep === "\t") return line.split("\t")
  return line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""))
}

/**
 * Parse un export CSV/TSV de relevé bancaire (formats courants FR).
 * Colonnes reconnues : date, libellé, débit, crédit (noms flexibles).
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

  const idxDate = headers.findIndex(h => /date/.test(h) && !/valeur/.test(h))
  const idxDateValeur = headers.findIndex(h => /date.*valeur|valeur/.test(h))
  const idxLibelle = headers.findIndex(h => /libelle|label|description|operation/.test(h))
  const idxDebit = headers.findIndex(h => /debit|sortant/.test(h))
  const idxCredit = headers.findIndex(h => /credit|entrant/.test(h))
  const idxMontant = headers.findIndex(h => /^montant$/.test(h))

  if (idxDate < 0 || idxLibelle < 0) {
    return {
      lignes: [],
      errors: ["Colonnes requises introuvables (date + libellé). En-têtes : " + headers.join(", ")],
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

    let debit = idxDebit >= 0 ? parseMontant(cols[idxDebit] || "") : 0
    let credit = idxCredit >= 0 ? parseMontant(cols[idxCredit] || "") : 0

    if (debit === 0 && credit === 0 && idxMontant >= 0) {
      const m = parseMontant(cols[idxMontant] || "")
      const sign = (cols[idxMontant] || "").includes("-")
      if (sign) debit = m
      else credit = m
    }

    if (debit > 0 && credit > 0) {
      errors.push(`Ligne ${i + 1} : débit et crédit simultanés — ignorée`)
      continue
    }

    const libelle = (cols[idxLibelle] || "Opération").trim() || "Opération"
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

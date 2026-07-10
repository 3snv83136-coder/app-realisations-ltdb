/**
 * Heuristique légère : vérifie qu'un buffer PDF contient du texte lisible.
 * Évite d'uploader / envoyer un rapport « vide » (bandeau seul).
 */
export function pdfBufferHasText(buf: Buffer, minChars = 60): boolean {
  if (buf.length < 1000) return false
  if (buf.subarray(0, 5).toString("utf8") !== "%PDF-") return false

  const latin = buf.toString("latin1")
  const literals = latin.match(/\((?:\\.|[^\\)])*\)/g) || []
  let text = ""
  for (const lit of literals) {
    text += lit.slice(1, -1).replace(/\\([nrtbf()\\])/g, (_, c) => {
      if (c === "n") return "\n"
      if (c === "r") return "\r"
      if (c === "t") return "\t"
      return c
    })
  }

  const meaningful = text
    .replace(/[^\w\s.,''"«»—\-€:/()%àâäéèêëïîôùûüçœæÀÂÄÉÈÊËÏÎÔÙÛÜÇŒÆ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return meaningful.length >= minChars
}

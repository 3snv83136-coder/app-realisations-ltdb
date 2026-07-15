/** Extrait un message lisible d'une erreur attrapée (catch en unknown). */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message?: unknown }).message ?? '')
  }
  return String(e ?? '')
}

/** Extrait un code HTTP d'une erreur SDK (Anthropic/OpenAI/fetch). */
export function errorStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object') {
    const obj = e as { status?: unknown; response?: { status?: unknown } }
    const s = obj.status ?? (obj.response && typeof obj.response === 'object' ? obj.response.status : undefined)
    return typeof s === 'number' ? s : undefined
  }
  return undefined
}

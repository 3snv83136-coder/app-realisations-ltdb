/**
 * @deprecated DeepSeek abandonné — utiliser `lib/llm.ts` (Anthropic).
 * Conservé uniquement pour d'anciens scripts de debug locaux.
 */
import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

/** @deprecated Utiliser llmChat() / ANTHROPIC_API_KEY */
export function getDeepseek(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY
    if (!key) throw new Error("ANTHROPIC_API_KEY manquante")
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

/** @deprecated Préférer llmChat() depuis lib/llm.ts */
export const deepseek = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return (getDeepseek() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

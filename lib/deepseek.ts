/**
 * @deprecated Utiliser `lib/llm.ts` (AI_PROVIDER=mistral|deepseek).
 * Conservé pour compat scripts/debug.
 */
import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

export function getDeepseek(): Anthropic {
  if (!_client) {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) throw new Error("DEEPSEEK_API_KEY manquante")
    _client = new Anthropic({
      baseURL: "https://api.deepseek.com/anthropic",
      apiKey: key,
    })
  }
  return _client
}

/** @deprecated Préférer llmChat() depuis lib/llm.ts */
export const deepseek = new Proxy({} as Anthropic, {
  get(_target, prop) {
    return (getDeepseek() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

import Anthropic from "@anthropic-ai/sdk"

export type AiProvider = "mistral" | "deepseek"
export type AiModelTier = "pro" | "flash"

const MISTRAL_BASE = "https://api.mistral.ai/v1"

export function getAiProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER || "mistral").toLowerCase().trim()
  return raw === "deepseek" ? "deepseek" : "mistral"
}

export function getAiModel(tier: AiModelTier = "pro"): string {
  if (getAiProvider() === "mistral") {
    if (tier === "flash") {
      return process.env.AI_FLASH_MODEL || "mistral-small-latest"
    }
    return process.env.AI_REPORT_MODEL || "mistral-large-latest"
  }
  return tier === "flash" ? "deepseek-v4-flash" : "deepseek-v4-pro"
}

export function llmIsConfigured(): boolean {
  return getAiProvider() === "mistral"
    ? !!process.env.MISTRAL_API_KEY
    : !!process.env.DEEPSEEK_API_KEY
}

export function llmConfigError(): string {
  return getAiProvider() === "mistral"
    ? "MISTRAL_API_KEY non configurée"
    : "DEEPSEEK_API_KEY non configurée"
}

let _deepseek: Anthropic | null = null
function getDeepseekClient(): Anthropic {
  if (!_deepseek) {
    const key = process.env.DEEPSEEK_API_KEY
    if (!key) throw new Error("DEEPSEEK_API_KEY non configurée")
    _deepseek = new Anthropic({
      baseURL: "https://api.deepseek.com/anthropic",
      apiKey: key,
    })
  }
  return _deepseek
}

export async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: unknown) {
      lastErr = e
      const err = e as { status?: number; response?: { status?: number }; message?: string }
      const status = err?.status || err?.response?.status
      const msg = String(err?.message || e)
      const retryable =
        status === 529 || status === 503 || status === 500 || status === 429 ||
        /529|overloaded|503|500|429|rate.?limit/i.test(msg)
      if (!retryable || attempt === maxAttempts) throw e
      const delay = Math.min(1500 * Math.pow(2, attempt - 1), 10000) + Math.random() * 800
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

export type LlmChatOptions = {
  model?: string
  maxTokens?: number
  /** Force le mode JSON (Mistral response_format + suffixe prompt DeepSeek) */
  jsonMode?: boolean
  retries?: number
}

async function mistralChat(prompt: string, opts: LlmChatOptions): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error("MISTRAL_API_KEY non configurée")

  const model = opts.model || getAiModel("pro")
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 8000,
    messages: [{ role: "user", content: prompt }],
  }
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" }
  }

  const res = await fetch(`${MISTRAL_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Mistral API ${res.status}${detail ? ` : ${detail.slice(0, 300)}` : ""}`)
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("Mistral : réponse vide")
  return text
}

async function deepseekChat(prompt: string, opts: LlmChatOptions): Promise<string> {
  const client = getDeepseekClient()
  const model = opts.model || getAiModel("pro")
  const content = opts.jsonMode
    ? `${prompt}\n\nRéponds UNIQUEMENT avec du JSON valide, sans markdown ni backticks.`
    : prompt

  const msg = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content }],
  })

  return (msg.content as { type: string; text?: string }[])
    .filter(block => block.type === "text")
    .map(block => block.text || "")
    .join("")
}

/** Appel LLM unifié — Mistral ou DeepSeek selon AI_PROVIDER */
export async function llmChat(prompt: string, opts: LlmChatOptions = {}): Promise<string> {
  const retries = opts.retries ?? 3
  return callWithRetry(
    () => getAiProvider() === "mistral"
      ? mistralChat(prompt, opts)
      : deepseekChat(prompt, opts),
    retries,
  )
}

/** Ping léger pour /api/health */
export async function llmHealthPing(): Promise<{ ok: boolean; detail?: string; latencyMs?: number }> {
  if (!llmIsConfigured()) {
    return { ok: false, detail: llmConfigError() }
  }
  const start = Date.now()
  try {
    await llmChat("Réponds exactement : ok", {
      model: getAiModel("flash"),
      maxTokens: 8,
      retries: 1,
    })
    return { ok: true, latencyMs: Date.now() - start, detail: `${getAiProvider()}/${getAiModel("flash")}` }
  } catch (e: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      detail: String(e instanceof Error ? e.message : e).slice(0, 240),
    }
  }
}

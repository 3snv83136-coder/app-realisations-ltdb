import Anthropic from "@anthropic-ai/sdk"
import { errorMessage } from "@/lib/error-message"

export type AiProvider = "anthropic" | "mistral"
export type AiModelTier = "pro" | "flash"

const MISTRAL_BASE = "https://api.mistral.ai/v1"

export function getAiProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER || "anthropic").toLowerCase().trim()
  return raw === "mistral" ? "mistral" : "anthropic"
}

export function getAiModel(tier: AiModelTier = "pro", provider: AiProvider = getAiProvider()): string {
  if (provider === "mistral") {
    if (tier === "flash") {
      return process.env.AI_FLASH_MODEL || "mistral-small-latest"
    }
    return process.env.AI_REPORT_MODEL || "mistral-large-latest"
  }
  if (tier === "flash") {
    return process.env.AI_FLASH_MODEL || "claude-haiku-4-5-20251001"
  }
  return process.env.ANTHROPIC_MODEL || process.env.AI_REPORT_MODEL || "claude-sonnet-4-5"
}

function providerConfigured(provider: AiProvider): boolean {
  return provider === "mistral"
    ? !!process.env.MISTRAL_API_KEY
    : !!process.env.ANTHROPIC_API_KEY
}

export function llmIsConfigured(): boolean {
  return providerConfigured("anthropic") || providerConfigured("mistral")
}

export function llmConfigError(): string {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.MISTRAL_API_KEY) {
    return "Aucune clé IA configurée (ANTHROPIC_API_KEY)"
  }
  return getAiProvider() === "mistral"
    ? "MISTRAL_API_KEY non configurée"
    : "ANTHROPIC_API_KEY non configurée"
}

export function isInsufficientBalanceError(e: unknown): boolean {
  const err = e as { status?: number; response?: { status?: number }; message?: string }
  const status = err?.status || err?.response?.status
  const msg = String(err?.message || e)
  return status === 402 || /insufficient.?balance|payment.?required|crédits?.?insuffis|credit.?balance/i.test(msg)
}

export function formatLlmUserError(e: unknown, provider: AiProvider = getAiProvider()): string {
  if (isInsufficientBalanceError(e)) {
    const name = provider === "mistral" ? "Mistral" : "Anthropic"
    return `Crédit IA épuisé sur ${name}. Vérifie le solde du compte API.`
  }
  return errorMessage(e)
}

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error("ANTHROPIC_API_KEY non configurée")
    _anthropic = new Anthropic({ apiKey: key })
  }
  return _anthropic
}

export async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: unknown) {
      lastErr = e
      if (isInsufficientBalanceError(e)) throw e
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
  /** Force le mode JSON (Mistral response_format + instruction Claude) */
  jsonMode?: boolean
  retries?: number
  provider?: AiProvider
}

async function mistralChat(prompt: string, opts: LlmChatOptions): Promise<string> {
  const key = process.env.MISTRAL_API_KEY
  if (!key) throw new Error("MISTRAL_API_KEY non configurée")

  const model = opts.model || getAiModel("pro", "mistral")
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
    const err = new Error(`Mistral API ${res.status}${detail ? ` : ${detail.slice(0, 300)}` : ""}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("Mistral : réponse vide")
  return text
}

async function anthropicChat(prompt: string, opts: LlmChatOptions): Promise<string> {
  const client = getAnthropicClient()
  const model = opts.model || getAiModel("pro", "anthropic")
  const content = opts.jsonMode
    ? `${prompt}\n\nRéponds UNIQUEMENT avec du JSON valide, sans markdown ni backticks.`
    : prompt

  const msg = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    messages: [{ role: "user", content }],
  })

  return (msg.content as { type: string; text?: string }[])
    .filter(block => block.type === "text")
    .map(block => block.text || "")
    .join("")
}

function chatForProvider(provider: AiProvider, prompt: string, opts: LlmChatOptions): Promise<string> {
  const nextOpts: LlmChatOptions = {
    ...opts,
    model: opts.model && opts.provider === provider ? opts.model : undefined,
    provider,
  }
  return provider === "mistral"
    ? mistralChat(prompt, nextOpts)
    : anthropicChat(prompt, nextOpts)
}

function fallbackProvider(primary: AiProvider): AiProvider | null {
  const other: AiProvider = primary === "anthropic" ? "mistral" : "anthropic"
  return providerConfigured(other) ? other : null
}

/** Appel LLM unifié — Anthropic (défaut) ou Mistral selon AI_PROVIDER. */
export async function llmChat(prompt: string, opts: LlmChatOptions = {}): Promise<string> {
  const retries = opts.retries ?? 3
  const primary = opts.provider || getAiProvider()
  if (!providerConfigured(primary)) {
    const fb = fallbackProvider(primary)
    if (!fb) throw new Error(llmConfigError())
    console.warn(`[llm] ${primary} non configuré → fallback ${fb}`)
    return callWithRetry(() => chatForProvider(fb, prompt, { ...opts, provider: fb }), retries)
  }

  try {
    return await callWithRetry(
      () => chatForProvider(primary, prompt, { ...opts, provider: primary }),
      retries,
    )
  } catch (e) {
    if (!isInsufficientBalanceError(e)) throw e
    const fb = fallbackProvider(primary)
    if (!fb) throw new Error(formatLlmUserError(e, primary))
    console.warn(`[llm] ${primary} crédit épuisé → fallback ${fb}`)
    try {
      return await callWithRetry(
        () => chatForProvider(fb, prompt, { ...opts, provider: fb, model: undefined }),
        retries,
      )
    } catch (e2) {
      if (isInsufficientBalanceError(e2)) {
        throw new Error(formatLlmUserError(e2, fb))
      }
      throw e2
    }
  }
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

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

type Check = { ok: boolean; latencyMs?: number; detail?: string }

async function checkAnthropic(): Promise<Check> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, detail: 'ANTHROPIC_API_KEY missing' }
  const start = Date.now()
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ok' }],
    })
    return { ok: true, latencyMs: Date.now() - start }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: String(e?.message || e).slice(0, 240) }
  }
}

async function checkBackend(): Promise<Check> {
  const url = process.env.LTDB_API_URL
  if (!url) return { ok: false, detail: 'LTDB_API_URL missing' }
  const start = Date.now()
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) })
    if (res.status >= 500) return { ok: false, latencyMs: Date.now() - start, detail: `HTTP ${res.status}` }
    return { ok: true, latencyMs: Date.now() - start, detail: `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, latencyMs: Date.now() - start, detail: String(e?.message || e).slice(0, 240) }
  }
}

export async function GET() {
  const [anthropic, backend] = await Promise.all([checkAnthropic(), checkBackend()])

  const checks = {
    env_anthropic_key: { ok: !!process.env.ANTHROPIC_API_KEY } as Check,
    env_ltdb_api_url: { ok: !!process.env.LTDB_API_URL } as Check,
    env_nextauth_secret: { ok: !!process.env.NEXTAUTH_SECRET } as Check,
    anthropic_api: anthropic,
    backend_api: backend,
  }

  const failures: string[] = []
  for (const [name, r] of Object.entries(checks)) {
    if (!r.ok) failures.push(`${name}: ${r.detail || 'failed'}`)
  }

  const ok = failures.length === 0
  return NextResponse.json(
    {
      ok,
      service: 'app-realisations-ltdb',
      timestamp: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown',
      checks,
      failures,
    },
    { status: ok ? 200 : 503 },
  )
}

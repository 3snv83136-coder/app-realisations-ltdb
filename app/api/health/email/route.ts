import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { initResend } from "@/lib/email-utils"

export const dynamic = 'force-dynamic'

/**
 * Endpoint de diagnostic Resend.
 * Usage : /api/health/email?to=mondornaji@gmail.com
 * Renvoie le détail de la config (sans exposer la clé) et le résultat de l'envoi
 * d'un mail-test minimal — utile pour valider la configuration domaine.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const to = url.searchParams.get('to') || ''

  const config = {
    has_api_key: !!process.env.RESEND_API_KEY,
    from_email: process.env.RESEND_FROM_EMAIL || '(défaut: contact@lestechniciensdudebouchage.fr)',
    test_redirect: process.env.RESEND_TEST_EMAIL || null,
  }

  // Liste les domaines visibles par la clé API (utile pour diagnostiquer
  // un mismatch de workspace entre la clé Vercel et le domaine vérifié sur Resend).
  let domainsVisible: any = null
  let domainsError: string | null = null
  if (process.env.RESEND_API_KEY) {
    try {
      const r = new Resend(process.env.RESEND_API_KEY)
      const list = await r.domains.list()
      domainsVisible = (list as any)?.data?.data || (list as any)?.data || list
    } catch (e: any) {
      domainsError = e?.message || String(e)
    }
  }

  if (!to) {
    return NextResponse.json({
      config,
      domains_visible: domainsVisible,
      domains_error: domainsError,
      hint: 'Ajoute ?to=ton-email pour envoyer un message-test',
    })
  }

  const ctx = initResend(to)
  if ('error' in ctx) {
    return NextResponse.json({ config, sent: false, error: ctx.error }, { status: ctx.status })
  }

  const { data, error } = await ctx.resend.emails.send({
    from: ctx.fromEmail,
    to: ctx.recipient,
    subject: 'LTDB — test Resend',
    html: '<p>Si tu lis ce message, la configuration Resend fonctionne.</p>',
  })

  if (error) {
    return NextResponse.json({
      config,
      sent: false,
      error: error.message || String(error),
      effective_from: ctx.fromEmail,
      effective_to: ctx.recipient,
    }, { status: 500 })
  }

  return NextResponse.json({
    config,
    sent: true,
    id: data?.id,
    effective_from: ctx.fromEmail,
    effective_to: ctx.recipient,
  })
}

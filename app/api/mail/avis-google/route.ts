import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"
import { AVIS_RELANCE_PLAN, parseAvisSmsPlan } from "@/lib/avis-relance-utils"
import { avisSmsProviderId, avisEmailProviderId, registerRelances } from "@/lib/relances-registry"
import { isBrevoSmsConfigured } from "@/lib/sms-brevo"

export const dynamic = "force-dynamic"

export type MailAvisGoogleItem = {
  id: string
  channel: "email" | "sms"
  status: "pending" | "sent" | "canceled" | "missing"
  label: string
  clientNom: string | null
  destinataire: string | null
  ville: string | null
  sendAt: string | null
  updatedAt: string | null
  interventionId: string | null
  href: string | null
  day: number | null
  manual: boolean
}

type SeptSummary = {
  dossiersMailEnvoye: number
  avecRelancesResend: number
  sansRelances: number
  idsResendStockes: number
  avisRecu: number
  brevoSmsRequests: number | null
  brevoSmsDelivered: number | null
  brevoSmsSoftBounces: number | null
  avisSmsPlanColumn: boolean
  registryCount: number
}

/**
 * Liste tous les envois avis Google (mail + SMS) pour l'onglet Mail → Google.
 * Reconstruit l'historique même si avis_sms_plan / registre sont incomplets.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 503 })
  }

  const avisSmsPlanColumn = await detectAvisSmsPlanColumn(sb)

  try {
    if (avisSmsPlanColumn) await backfillAvisFromInterventions(sb)
    await backfillFromAvisRelanceIds(sb)
  } catch (e) {
    console.error("[mail/avis-google] backfill", e)
  }

  const { data, error } = await sb
    .from("relances_planifiees")
    .select(
      "id, channel, status, label, client_nom, client_email, ville, send_at, updated_at, intervention_id, href, metadata",
    )
    .eq("kind", "avis")
    .order("send_at", { ascending: false, nullsFirst: false })
    .limit(800)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let items: MailAvisGoogleItem[] = (data || []).map(row => mapRegistryRow(row))

  // Enrichissement SMS Brevo (septembre + récents) si le registre est pauvre
  try {
    const brevoItems = await fetchBrevoSmsItems()
    items = mergeById(items, brevoItems)
  } catch (e) {
    console.error("[mail/avis-google] brevo", e)
  }

  // Dossiers septembre sans aucune relance → lignes « missing »
  try {
    const gaps = await buildMissingSeptemberItems(sb, items)
    items = [...items, ...gaps]
  } catch (e) {
    console.error("[mail/avis-google] gaps", e)
  }

  items.sort((a, b) => (b.sendAt || "").localeCompare(a.sendAt || ""))

  const sentMail = items.filter(i => i.channel === "email" && i.status === "sent").length
  const sentSms = items.filter(i => i.channel === "sms" && i.status === "sent").length
  const pending = items.filter(i => i.status === "pending").length
  const canceled = items.filter(i => i.status === "canceled").length
  const missing = items.filter(i => i.status === "missing").length

  const september = await buildSeptemberSummary(sb, avisSmsPlanColumn, data?.length || 0)

  return NextResponse.json({
    ok: true,
    items,
    stats: {
      total: items.length,
      sentMail,
      sentSms,
      pending,
      canceled,
      missing,
    },
    september,
    diagnostics: {
      avisSmsPlanColumn,
      registryEmpty: (data?.length || 0) === 0,
      hint: !avisSmsPlanColumn
        ? "Colonne interventions.avis_sms_plan absente — exécute la migration SQL 021 dans Supabase."
        : null,
    },
  })
}

function mapRegistryRow(row: Record<string, unknown>): MailAvisGoogleItem {
  const meta = (row.metadata || {}) as Record<string, unknown>
  const channel = row.channel === "sms" ? "sms" : "email"
  const phone = typeof meta.phone === "string" ? meta.phone : null
  const emailMeta = typeof meta.email === "string" ? meta.email : null
  const destinataire =
    channel === "sms"
      ? phone || null
      : ((row.client_email as string) || emailMeta || null)

  const statusRaw = String(row.status || "pending")
  const status: MailAvisGoogleItem["status"] =
    statusRaw === "sent" || statusRaw === "canceled" || statusRaw === "missing"
      ? statusRaw
      : "pending"

  return {
    id: row.id as string,
    channel,
    status,
    label: (row.label as string) || "Avis Google",
    clientNom: (row.client_nom as string) || null,
    destinataire,
    ville: (row.ville as string) || null,
    sendAt: (row.send_at as string) || null,
    updatedAt: (row.updated_at as string) || null,
    interventionId: (row.intervention_id as string) || null,
    href: (row.href as string) || null,
    day: typeof meta.day === "number" ? meta.day : null,
    manual: meta.manual === true,
  }
}

function mergeById(base: MailAvisGoogleItem[], extra: MailAvisGoogleItem[]): MailAvisGoogleItem[] {
  const seen = new Set(base.map(i => i.id))
  const out = [...base]
  for (const e of extra) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e)
  }
  return out
}

async function detectAvisSmsPlanColumn(
  sb: NonNullable<ReturnType<typeof getSupabaseOrNull>>,
): Promise<boolean> {
  const { error } = await sb.from("interventions").select("id, avis_sms_plan").limit(1)
  return !error
}

async function backfillAvisFromInterventions(
  sb: NonNullable<ReturnType<typeof getSupabaseOrNull>>,
): Promise<void> {
  const { data: rows } = await sb
    .from("interventions")
    .select("id, ville, client_id, avis_sms_plan")
    .not("avis_sms_plan", "is", null)
    .order("created_at", { ascending: false })
    .limit(200)

  if (!rows?.length) return

  const clientById = await loadClients(sb, rows.map(r => r.client_id as string | null))
  const toRegister: Parameters<typeof registerRelances>[0] = []

  for (const row of rows) {
    const plan = parseAvisSmsPlan(row.avis_sms_plan)
    if (plan.length === 0) continue
    const client = row.client_id ? clientById.get(row.client_id as string) : undefined
    const href = `/intervention/${row.id}`

    for (const item of plan) {
      const channel = item.channel === "email" ? "email" : "sms"
      const providerId =
        channel === "email"
          ? (item.resend_id || avisEmailProviderId(row.id as string, item.day, item.send_at))
          : avisSmsProviderId(row.id as string, item.day, item.send_at)

      let status: "pending" | "sent" | "canceled" = "pending"
      if (item.canceled) status = "canceled"
      else if (item.sent) status = "sent"

      const phone = item.phone || client?.telephone || null
      const email = item.email || client?.email || null

      toRegister.push({
        kind: "avis",
        sourceType: "intervention_avis",
        sourceId: row.id as string,
        providerId,
        channel,
        sendAt: item.sent_at || item.send_at,
        status,
        clientId: (row.client_id as string) || null,
        clientNom: client?.nom || null,
        clientEmail: channel === "email" ? email : null,
        ville: (row.ville as string) || null,
        label:
          channel === "email"
            ? `Avis Google — mail J+${item.day}`
            : `Avis Google — SMS J+${item.day}`,
        interventionId: row.id as string,
        href,
        metadata: {
          day: item.day,
          phone: channel === "sms" ? phone : null,
          email: channel === "email" ? email : null,
          manual: item.day === 0,
          backfill: true,
        },
      })
    }
  }

  if (toRegister.length > 0) await registerRelances(toRegister)
}

/** Reconstruit des lignes à partir de avis_relance_ids (quand avis_sms_plan absente). */
async function backfillFromAvisRelanceIds(
  sb: NonNullable<ReturnType<typeof getSupabaseOrNull>>,
): Promise<void> {
  const { data: rows } = await sb
    .from("interventions")
    .select("id, ville, client_id, avis_relance_ids, mail_envoye_at, avis_recu")
    .not("avis_relance_ids", "is", null)
    .order("mail_envoye_at", { ascending: false, nullsFirst: false })
    .limit(200)

  if (!rows?.length) return

  const clientById = await loadClients(sb, rows.map(r => r.client_id as string | null))
  const emailDays = AVIS_RELANCE_PLAN.filter(s => s.channel === "email").map(s => s.day)
  const toRegister: Parameters<typeof registerRelances>[0] = []
  const now = Date.now()

  for (const row of rows) {
    const ids = Array.isArray(row.avis_relance_ids)
      ? (row.avis_relance_ids as string[]).filter(Boolean)
      : []
    if (ids.length === 0) continue
    const client = row.client_id ? clientById.get(row.client_id as string) : undefined
    const anchor = row.mail_envoye_at ? new Date(row.mail_envoye_at as string) : new Date()
    const stopped = row.avis_recu === true

    ids.forEach((resendId, idx) => {
      const day = emailDays[idx] ?? emailDays[emailDays.length - 1] ?? 1
      const sendAt = new Date(anchor.getTime() + day * 24 * 60 * 60 * 1000)
      let status: "pending" | "sent" | "canceled" = "pending"
      if (stopped) status = "canceled"
      else if (sendAt.getTime() <= now) status = "sent"

      toRegister.push({
        kind: "avis",
        sourceType: "intervention_avis",
        sourceId: row.id as string,
        providerId: resendId,
        channel: "email",
        sendAt: sendAt.toISOString(),
        status,
        clientId: (row.client_id as string) || null,
        clientNom: client?.nom || null,
        clientEmail: client?.email || null,
        ville: (row.ville as string) || null,
        label: `Avis Google — mail J+${day}`,
        interventionId: row.id as string,
        href: `/intervention/${row.id}`,
        metadata: {
          day,
          email: client?.email || null,
          backfill: true,
          fromAvisRelanceIds: true,
        },
      })
    })
  }

  if (toRegister.length > 0) await registerRelances(toRegister)
}

async function loadClients(
  sb: NonNullable<ReturnType<typeof getSupabaseOrNull>>,
  clientIdsRaw: Array<string | null | undefined>,
) {
  const clientIds = Array.from(new Set(clientIdsRaw.filter(Boolean) as string[]))
  const map = new Map<string, { nom: string | null; email: string | null; telephone: string | null }>()
  if (clientIds.length === 0) return map
  const { data: clients } = await sb
    .from("clients")
    .select("id, nom, email, telephone")
    .in("id", clientIds)
  for (const c of clients || []) {
    map.set(c.id as string, {
      nom: (c.nom as string) || null,
      email: (c.email as string) || null,
      telephone: (c.telephone as string) || null,
    })
  }
  return map
}

async function fetchBrevoSmsItems(): Promise<MailAvisGoogleItem[]> {
  if (!isBrevoSmsConfigured()) return []
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return []

  const start = "2026-09-01"
  const end = new Date().toISOString().slice(0, 10)
  const res = await fetch(
    `https://api.brevo.com/v3/transactionalSMS/statistics/events?limit=100&startDate=${start}&endDate=${end}&event=delivered`,
    { headers: { "api-key": apiKey, accept: "application/json" }, cache: "no-store" },
  )
  if (!res.ok) return []
  const data = await res.json().catch(() => ({ events: [] }))
  const events = Array.isArray(data.events) ? data.events : []

  return events.map((e: { phoneNumber?: string; date?: string; messageId?: string }, idx: number) => {
    const phone = e.phoneNumber ? `+${e.phoneNumber}` : null
    return {
      id: `brevo-${e.messageId || idx}`,
      channel: "sms" as const,
      status: "sent" as const,
      label: "Avis Google — SMS Brevo (livré)",
      clientNom: null,
      destinataire: phone,
      ville: null,
      sendAt: e.date || null,
      updatedAt: e.date || null,
      interventionId: null,
      href: "/mail",
      day: null,
      manual: true,
    }
  })
}

async function buildMissingSeptemberItems(
  sb: NonNullable<ReturnType<typeof getSupabaseOrNull>>,
  existing: MailAvisGoogleItem[],
): Promise<MailAvisGoogleItem[]> {
  const { data: rows } = await sb
    .from("interventions")
    .select("id, reference, ville, client_id, mail_envoye_at, avis_relance_ids, avis_recu")
    .gte("mail_envoye_at", "2026-09-01T00:00:00")
    .lte("mail_envoye_at", "2026-09-30T23:59:59")
    .order("mail_envoye_at", { ascending: false })
    .limit(300)

  if (!rows?.length) return []

  const covered = new Set(
    existing.map(i => i.interventionId).filter(Boolean) as string[],
  )
  const clientById = await loadClients(sb, rows.map(r => r.client_id as string | null))
  const out: MailAvisGoogleItem[] = []

  for (const row of rows) {
    const ids = Array.isArray(row.avis_relance_ids)
      ? (row.avis_relance_ids as string[]).filter(Boolean)
      : []
    if (ids.length > 0 || covered.has(row.id as string)) continue
    if (row.avis_recu) continue

    const client = row.client_id ? clientById.get(row.client_id as string) : undefined
    out.push({
      id: `missing-${row.id}`,
      channel: "email",
      status: "missing",
      label: "Aucune relance avis planifiée",
      clientNom: client?.nom || (row.reference as string) || null,
      destinataire: client?.email || client?.telephone || null,
      ville: (row.ville as string) || null,
      sendAt: (row.mail_envoye_at as string) || null,
      updatedAt: null,
      interventionId: row.id as string,
      href: `/intervention/${row.id}`,
      day: null,
      manual: false,
    })
  }
  return out
}

async function buildSeptemberSummary(
  sb: NonNullable<ReturnType<typeof getSupabaseOrNull>>,
  avisSmsPlanColumn: boolean,
  registryCount: number,
): Promise<SeptSummary> {
  const { data: rows } = await sb
    .from("interventions")
    .select("id, avis_recu, avis_relance_ids")
    .gte("mail_envoye_at", "2026-09-01T00:00:00")
    .lte("mail_envoye_at", "2026-09-30T23:59:59")
    .limit(500)

  let avecRelancesResend = 0
  let sansRelances = 0
  let idsResendStockes = 0
  let avisRecu = 0
  for (const i of rows || []) {
    const ids = Array.isArray(i.avis_relance_ids)
      ? (i.avis_relance_ids as string[]).filter(Boolean)
      : []
    if (ids.length) {
      avecRelancesResend++
      idsResendStockes += ids.length
    } else sansRelances++
    if (i.avis_recu) avisRecu++
  }

  let brevoSmsRequests: number | null = null
  let brevoSmsDelivered: number | null = null
  let brevoSmsSoftBounces: number | null = null
  if (isBrevoSmsConfigured() && process.env.BREVO_API_KEY) {
    try {
      const end = new Date().toISOString().slice(0, 10)
      const res = await fetch(
        `https://api.brevo.com/v3/transactionalSMS/statistics/aggregatedReport?startDate=2026-09-01&endDate=${end}`,
        {
          headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
          cache: "no-store",
        },
      )
      if (res.ok) {
        const j = await res.json()
        brevoSmsRequests = typeof j.requests === "number" ? j.requests : null
        brevoSmsDelivered = typeof j.delivered === "number" ? j.delivered : null
        brevoSmsSoftBounces = typeof j.softBounces === "number" ? j.softBounces : null
      }
    } catch { /* ignore */ }
  }

  return {
    dossiersMailEnvoye: rows?.length || 0,
    avecRelancesResend,
    sansRelances,
    idsResendStockes,
    avisRecu,
    brevoSmsRequests,
    brevoSmsDelivered,
    brevoSmsSoftBounces,
    avisSmsPlanColumn,
    registryCount,
  }
}

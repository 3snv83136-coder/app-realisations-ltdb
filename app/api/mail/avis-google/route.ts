import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/intervention-access"
import { getSupabaseOrNull } from "@/lib/supabase"
import { parseAvisSmsPlan } from "@/lib/avis-relance-utils"
import { avisSmsProviderId, avisEmailProviderId, registerRelances } from "@/lib/relances-registry"

export const dynamic = "force-dynamic"

export type MailAvisGoogleItem = {
  id: string
  channel: "email" | "sms"
  status: "pending" | "sent" | "canceled"
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

/**
 * Liste tous les envois avis Google (mail + SMS) pour l'onglet Mail → Google.
 * Backfill depuis interventions.avis_sms_plan si le registre est incomplet.
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

  // Backfill best-effort : plans existants → registre
  try {
    await backfillAvisFromInterventions(sb)
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

  const items: MailAvisGoogleItem[] = (data || []).map(row => {
    const meta = (row.metadata || {}) as Record<string, unknown>
    const channel = row.channel === "sms" ? "sms" : "email"
    const phone = typeof meta.phone === "string" ? meta.phone : null
    const emailMeta = typeof meta.email === "string" ? meta.email : null
    const destinataire =
      channel === "sms"
        ? phone || null
        : (row.client_email as string) || emailMeta || null

    return {
      id: row.id as string,
      channel,
      status: (row.status as MailAvisGoogleItem["status"]) || "pending",
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
  })

  const sentMail = items.filter(i => i.channel === "email" && i.status === "sent").length
  const sentSms = items.filter(i => i.channel === "sms" && i.status === "sent").length
  const pending = items.filter(i => i.status === "pending").length
  const canceled = items.filter(i => i.status === "canceled").length

  return NextResponse.json({
    ok: true,
    items,
    stats: {
      total: items.length,
      sentMail,
      sentSms,
      pending,
      canceled,
    },
  })
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

  const clientIds = Array.from(
    new Set(rows.map(r => r.client_id).filter(Boolean) as string[]),
  )
  const clientById = new Map<string, { nom: string | null; email: string | null; telephone: string | null }>()
  if (clientIds.length > 0) {
    const { data: clients } = await sb
      .from("clients")
      .select("id, nom, email, telephone")
      .in("id", clientIds)
    for (const c of clients || []) {
      clientById.set(c.id as string, {
        nom: (c.nom as string) || null,
        email: (c.email as string) || null,
        telephone: (c.telephone as string) || null,
      })
    }
  }

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

  if (toRegister.length > 0) {
    await registerRelances(toRegister)
  }
}

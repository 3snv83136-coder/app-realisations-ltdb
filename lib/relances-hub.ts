import { Resend } from "resend"
import { countAvisRelancesPendantes } from "@/lib/avis-relance-utils"
import { annulerRelancesAvis } from "@/lib/avis-relance"
import {
  annulerRelancesFacture,
  isFacturePayeeOuReglee,
  relanceIdsFromPayload,
} from "@/lib/facture-relance"
import { getSupabaseOrNull } from "@/lib/supabase"

export type RelanceKind = "avis" | "devis" | "facture"

export type RelanceItem = {
  kind: RelanceKind
  /** interventionId (avis/devis lié) ou documentId (facture / devis seul) */
  id: string
  interventionId: string | null
  clientKey: string
  clientNom: string
  clientEmail: string | null
  ville: string | null
  label: string
  pendingCount: number
  href: string | null
}

export type ClientRelancesGroup = {
  clientKey: string
  clientNom: string
  clientEmail: string | null
  items: RelanceItem[]
  totalPending: number
}

export type RelancesHubSnapshot = {
  groups: ClientRelancesGroup[]
  totals: { avis: number; devis: number; facture: number; all: number }
}

const KIND_LABEL: Record<RelanceKind, string> = {
  avis: "Avis Google",
  devis: "Devis",
  facture: "Facture impayée",
}

export function relanceKindLabel(kind: RelanceKind): string {
  return KIND_LABEL[kind]
}

async function cancelResendIds(ids: string[]): Promise<number> {
  const list = ids.filter(Boolean)
  if (list.length === 0) return 0
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return 0
  const resend = new Resend(resendKey)
  let canceled = 0
  for (const id of list) {
    try {
      const r = await resend.emails.cancel(id)
      if (!r.error) canceled++
    } catch { /* ignore */ }
  }
  return canceled
}

/** Stoppe les relances devis d'une intervention (même logique que stop-relances). */
export async function annulerRelancesDevisIntervention(interventionId: string): Promise<number> {
  const sb = getSupabaseOrNull()
  if (!sb) return 0

  const { data: interv } = await sb
    .from("interventions")
    .select("devis_relance_ids")
    .eq("id", interventionId)
    .maybeSingle()

  const ids = Array.isArray(interv?.devis_relance_ids)
    ? (interv.devis_relance_ids as string[]).filter(Boolean)
    : []

  const canceled = await cancelResendIds(ids)

  await sb
    .from("interventions")
    .update({
      devis_relance_ids: [],
      devis_accepte_at: new Date().toISOString(),
    })
    .eq("id", interventionId)

  return canceled
}

/** Stoppe les relances d'un devis document (sans intervention liée). */
export async function annulerRelancesDevisDocument(documentId: string): Promise<number> {
  const sb = getSupabaseOrNull()
  if (!sb) return 0

  const { data: doc } = await sb
    .from("documents")
    .select("payload, type")
    .eq("id", documentId)
    .maybeSingle()

  if (!doc || doc.type !== "devis") return 0

  const payload = (doc.payload && typeof doc.payload === "object")
    ? { ...(doc.payload as Record<string, unknown>) }
    : {}

  const ids = Array.isArray(payload.relance_ids)
    ? (payload.relance_ids as string[]).filter(Boolean)
    : []

  const canceled = await cancelResendIds(ids)
  payload.relance_ids = []

  await sb
    .from("documents")
    .update({ statut: "accepte", payload })
    .eq("id", documentId)

  return canceled
}

export type StopRelanceTarget =
  | { scope: "item"; kind: RelanceKind; id: string }
  | { scope: "client"; clientKey: string }
  | { scope: "all" }

export async function stopRelances(
  target: StopRelanceTarget,
  snapshot?: RelancesHubSnapshot,
): Promise<{ stopped: number; details: string[] }> {
  const data = snapshot ?? await listPendingRelances(null)
  let items: RelanceItem[] = []

  if (target.scope === "all") {
    items = data.groups.flatMap(g => g.items)
  } else if (target.scope === "client") {
    const group = data.groups.find(g => g.clientKey === target.clientKey)
    items = group?.items ?? []
  } else {
    const found = data.groups.flatMap(g => g.items).find(i => i.kind === target.kind && i.id === target.id)
    if (found) items = [found]
  }

  let stopped = 0
  const details: string[] = []

  for (const item of items) {
    try {
      if (item.kind === "avis" && item.interventionId) {
        const r = await annulerRelancesAvis(item.interventionId)
        const n = r.emailsCanceled + r.smsCanceled
        stopped += n || item.pendingCount
        details.push(`${item.label} avis : ${n} annulée(s)`)
      } else if (item.kind === "devis") {
        let n = 0
        if (item.interventionId) {
          n = await annulerRelancesDevisIntervention(item.interventionId)
        } else {
          n = await annulerRelancesDevisDocument(item.id)
        }
        stopped += n || item.pendingCount
        details.push(`${item.label} devis : ${n} annulée(s)`)
      } else if (item.kind === "facture") {
        const n = await annulerRelancesFacture(item.id)
        stopped += n || item.pendingCount
        details.push(`${item.label} facture : ${n} annulée(s)`)
      }
    } catch (e) {
      details.push(`${item.label} : ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { stopped, details }
}

function clientKeyFrom(
  clientId: string | null | undefined,
  nom: string,
  email: string | null | undefined,
): string {
  if (clientId) return `c:${clientId}`
  const n = (nom || "").trim().toLowerCase()
  const e = (email || "").trim().toLowerCase()
  if (n || e) return `x:${n}|${e}`
  return "x:inconnu"
}

function buildGroups(items: RelanceItem[]): ClientRelancesGroup[] {
  const map = new Map<string, ClientRelancesGroup>()
  for (const item of items) {
    let g = map.get(item.clientKey)
    if (!g) {
      g = {
        clientKey: item.clientKey,
        clientNom: item.clientNom,
        clientEmail: item.clientEmail,
        items: [],
        totalPending: 0,
      }
      map.set(item.clientKey, g)
    }
    g.items.push(item)
    g.totalPending += item.pendingCount
  }
  return Array.from(map.values()).sort((a, b) =>
    a.clientNom.localeCompare(b.clientNom, "fr"),
  )
}

/** Liste toutes les relances encore actives, groupées par client. */
export async function listPendingRelances(
  technicienId: string | null,
): Promise<RelancesHubSnapshot> {
  const sb = getSupabaseOrNull()
  if (!sb) {
    return { groups: [], totals: { avis: 0, devis: 0, facture: 0, all: 0 } }
  }

  const items: RelanceItem[] = []

  let intervQuery = sb
    .from("interventions")
    .select(
      "id, reference, ville, client_id, technicien_id, avis_recu, devis_accepte_at, avis_relance_ids, devis_relance_ids, avis_sms_plan, mail_envoye_at",
    )

  if (technicienId) {
    intervQuery = intervQuery.eq("technicien_id", technicienId)
  }

  const { data: interventions } = await intervQuery

  const clientIds = new Set<string>()
  for (const row of interventions || []) {
    if (row.client_id) clientIds.add(row.client_id as string)
  }

  const clientMap = new Map<string, { nom: string; email: string | null }>()
  if (clientIds.size > 0) {
    const { data: clients } = await sb
      .from("clients")
      .select("id, nom, email")
      .in("id", Array.from(clientIds))
    for (const c of clients || []) {
      clientMap.set(c.id, { nom: c.nom || "Client", email: c.email || null })
    }
  }

  for (const row of interventions || []) {
    const client = row.client_id ? clientMap.get(row.client_id as string) : null
    const clientNom = client?.nom || "Client"
    const clientEmail = client?.email || null
    const ck = clientKeyFrom(row.client_id as string | null, clientNom, clientEmail)
    const ref = row.reference || row.id.slice(0, 8)
    const ville = row.ville || null

    if (!row.avis_recu) {
      const avisCount = countAvisRelancesPendantes(row.avis_relance_ids, row.avis_sms_plan)
      if (avisCount > 0 || row.mail_envoye_at) {
        if (avisCount > 0) {
          items.push({
            kind: "avis",
            id: row.id as string,
            interventionId: row.id as string,
            clientKey: ck,
            clientNom,
            clientEmail,
            ville,
            label: ref,
            pendingCount: avisCount,
            href: `/intervention/${row.id}`,
          })
        }
      }
    }

    if (!row.devis_accepte_at) {
      const devisIds = Array.isArray(row.devis_relance_ids)
        ? (row.devis_relance_ids as string[]).filter(Boolean)
        : []
      if (devisIds.length > 0) {
        items.push({
          kind: "devis",
          id: row.id as string,
          interventionId: row.id as string,
          clientKey: ck,
          clientNom,
          clientEmail,
          ville,
          label: ref,
          pendingCount: devisIds.length,
          href: `/intervention/${row.id}`,
        })
      }
    }
  }

  let docQuery = sb
    .from("documents")
    .select(
      "id, type, numero, statut, echeance, payload, intervention_id, client_id, clients(nom, email)",
    )
    .in("type", ["devis", "facture"])

  const { data: documents } = await docQuery

  const interventionTech = new Map<string, string | null>()
  for (const row of interventions || []) {
    interventionTech.set(row.id as string, (row.technicien_id as string) || null)
  }

  for (const doc of documents || []) {
    const intervId = doc.intervention_id as string | null
    if (technicienId && intervId) {
      const tech = interventionTech.get(intervId)
      if (tech && tech !== technicienId) continue
    }

    const cl = doc.clients as { nom?: string; email?: string | null } | null
    const clientNom = cl?.nom || "Client"
    const clientEmail = cl?.email || null
    const ck = clientKeyFrom(doc.client_id as string | null, clientNom, clientEmail)
    const numero = doc.numero || doc.id.slice(0, 8)

    if (doc.type === "devis" && doc.statut !== "accepte" && doc.statut !== "annule") {
      const payload = doc.payload as Record<string, unknown> | null
      const ids = Array.isArray(payload?.relance_ids)
        ? (payload.relance_ids as string[]).filter(Boolean)
        : []
      if (ids.length > 0 && !intervId) {
        items.push({
          kind: "devis",
          id: doc.id as string,
          interventionId: null,
          clientKey: ck,
          clientNom,
          clientEmail,
          ville: null,
          label: numero,
          pendingCount: ids.length,
          href: `/devis/tous`,
        })
      }
    }

    if (doc.type === "facture" && !isFacturePayeeOuReglee(doc.statut, doc.echeance)) {
      const ids = relanceIdsFromPayload(doc.payload)
      if (ids.length > 0) {
        items.push({
          kind: "facture",
          id: doc.id as string,
          interventionId: intervId,
          clientKey: ck,
          clientNom,
          clientEmail,
          ville: null,
          label: numero,
          pendingCount: ids.length,
          href: intervId ? `/intervention/${intervId}` : `/facture`,
        })
      }
    }
  }

  const groups = buildGroups(items)
  const totals = {
    avis: items.filter(i => i.kind === "avis").reduce((s, i) => s + i.pendingCount, 0),
    devis: items.filter(i => i.kind === "devis").reduce((s, i) => s + i.pendingCount, 0),
    facture: items.filter(i => i.kind === "facture").reduce((s, i) => s + i.pendingCount, 0),
    all: items.reduce((s, i) => s + i.pendingCount, 0),
  }

  return { groups, totals }
}

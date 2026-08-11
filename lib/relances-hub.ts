import { Resend } from "resend"
import { countAvisRelancesPendantes } from "@/lib/avis-relance-utils"
import { annulerRelancesAvis } from "@/lib/avis-relance"
import {
  annulerRelancesFacture,
  isFacturePayeeOuReglee,
  relanceIdsFromPayload,
} from "@/lib/facture-relance"
import {
  cancelRegisteredRelances,
  cancelRegisteredRelancesByProviderIds,
} from "@/lib/relances-registry"
import { getSupabaseOrNull } from "@/lib/supabase"

export type RelanceKind = "avis" | "devis" | "facture" | "devis_complementaire" | "autre"
export type RelanceSourceType = "intervention" | "document" | "registry" | "resend"

export type RelanceItem = {
  kind: RelanceKind
  sourceType: RelanceSourceType
  registrySourceType?: string
  providerIds?: string[]
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
  totals: { avis: number; devis: number; facture: number; autre: number; all: number }
}

const KIND_LABEL: Record<RelanceKind, string> = {
  avis: "Avis Google",
  devis: "Devis",
  facture: "Facture impayée",
  devis_complementaire: "Devis complémentaire",
  autre: "Autre relance",
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
      if (item.sourceType === "registry") {
        const n = await cancelRegisteredRelances(
          item.registrySourceType || item.kind,
          item.id,
        )
        stopped += n || item.pendingCount
        details.push(`${item.label} ${relanceKindLabel(item.kind).toLowerCase()} : ${n} annulée(s)`)
      } else if (item.sourceType === "resend") {
        const ids = item.providerIds || [item.id]
        const n = await cancelResendIds(ids)
        await cancelRegisteredRelancesByProviderIds(ids)
        stopped += n || item.pendingCount
        details.push(`${item.label} : ${n} annulée(s)`)
      } else if (item.kind === "avis" && item.interventionId) {
        const r = await annulerRelancesAvis(item.interventionId)
        const n = r.emailsCanceled + r.smsCanceled
        stopped += n || item.pendingCount
        details.push(`${item.label} avis : ${n} annulée(s)`)
      } else if (item.kind === "devis") {
        let n = 0
        if (item.sourceType === "intervention" && item.interventionId) {
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
    return { groups: [], totals: { avis: 0, devis: 0, facture: 0, autre: 0, all: 0 } }
  }

  const items: RelanceItem[] = []
  const trackedProviderIds = new Set<string>()

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
      if (Array.isArray(row.avis_relance_ids)) {
        for (const id of row.avis_relance_ids as string[]) {
          if (id) trackedProviderIds.add(id)
        }
      }
      const avisCount = countAvisRelancesPendantes(row.avis_relance_ids, row.avis_sms_plan)
      if (avisCount > 0 || row.mail_envoye_at) {
        if (avisCount > 0) {
          items.push({
            kind: "avis",
            sourceType: "intervention",
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
      for (const id of devisIds) trackedProviderIds.add(id)
      if (devisIds.length > 0) {
        items.push({
          kind: "devis",
          sourceType: "intervention",
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
      for (const id of ids) trackedProviderIds.add(id)
      const alreadyListedFromIntervention = !!intervId
        && items.some(item =>
          item.kind === "devis"
          && item.sourceType === "intervention"
          && item.interventionId === intervId
        )
      if (ids.length > 0 && !alreadyListedFromIntervention) {
        items.push({
          kind: "devis",
          sourceType: "document",
          id: doc.id as string,
          interventionId: intervId,
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
      for (const id of ids) trackedProviderIds.add(id)
      if (ids.length > 0) {
        items.push({
          kind: "facture",
          sourceType: "document",
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

  let registeredQuery = sb
    .from("relances_planifiees")
    .select(
      "kind, source_type, source_id, provider_id, channel, client_id, client_nom, client_email, ville, label, intervention_id, technicien_id, href",
    )
    .eq("status", "pending")
    .or(`send_at.is.null,send_at.gt.${new Date().toISOString()}`)

  if (technicienId) {
    registeredQuery = registeredQuery.or(`technicien_id.eq.${technicienId},technicien_id.is.null`)
  }

  const { data: registered, error: registeredError } = await registeredQuery
  if (registeredError) {
    // Compatibilité tant que la migration 033 n'est pas appliquée.
    if (registeredError.code !== "42P01" && registeredError.code !== "PGRST205") {
      console.error("[relances-hub] registered relances", registeredError.message)
    }
  } else {
    const campaigns = new Map<string, RelanceItem>()
    for (const row of registered || []) {
      if (row.provider_id) trackedProviderIds.add(row.provider_id)
      const rawKind = String(row.kind || "autre")
      const kind: RelanceKind = (
        ["avis", "devis", "facture", "devis_complementaire"].includes(rawKind)
          ? rawKind
          : "autre"
      ) as RelanceKind
      const sourceType = String(row.source_type || kind)
      const sourceId = String(row.source_id)
      const campaignKey = `${sourceType}:${sourceId}`
      const existing = campaigns.get(campaignKey)
      if (existing) {
        existing.pendingCount++
        continue
      }

      const clientNom = row.client_nom || "Client"
      const clientEmail = row.client_email || null
      campaigns.set(campaignKey, {
        kind,
        sourceType: "registry",
        registrySourceType: sourceType,
        id: sourceId,
        interventionId: row.intervention_id || null,
        clientKey: clientKeyFrom(row.client_id, clientNom, clientEmail),
        clientNom,
        clientEmail,
        ville: row.ville || null,
        label: row.label || sourceId,
        pendingCount: 1,
        href: row.href || null,
      })
    }
    items.push(...Array.from(campaigns.values()))
  }

  // Filet de sécurité admin : Resend reste la source de vérité pour les anciens
  // envois qui n'ont jamais été persistés (notamment les devis complémentaires).
  const resendKey = process.env.RESEND_API_KEY
  if (!technicienId && resendKey) {
    const resend = new Resend(resendKey)
    let after: string | undefined
    for (let page = 0; page < 10; page++) {
      try {
        const response = await resend.emails.list({ limit: 100, ...(after ? { after } : {}) })
        if (response.error) {
          console.error("[relances-hub] Resend list", response.error.message)
          break
        }
        const emails = response.data?.data || []
        for (const email of emails) {
          if (email.last_event !== "scheduled" || trackedProviderIds.has(email.id)) continue
          const searchable = `${email.subject} ${email.to.join(" ")}`.toLowerCase()
          if (!/(relance|rappel|devis|facture|avis)/i.test(searchable)) continue

          const kind: RelanceKind = searchable.includes("devis complémentaire")
            ? "devis_complementaire"
            : searchable.includes("devis")
              ? "devis"
              : searchable.includes("facture")
                ? "facture"
                : searchable.includes("avis")
                  ? "avis"
                  : "autre"
          const emailClient = email.to[0] || null
          items.push({
            kind,
            sourceType: "resend",
            providerIds: [email.id],
            id: email.id,
            interventionId: null,
            clientKey: clientKeyFrom(null, "", emailClient),
            clientNom: emailClient || "Destinataire inconnu",
            clientEmail: emailClient,
            ville: null,
            label: email.subject || `Relance ${email.id.slice(0, 8)}`,
            pendingCount: 1,
            href: null,
          })
          trackedProviderIds.add(email.id)
        }

        if (!response.data?.has_more || emails.length === 0) break
        after = emails[emails.length - 1]?.id
        if (!after) break
      } catch (error) {
        console.error("[relances-hub] Resend list", error)
        break
      }
    }
  }

  const groups = buildGroups(items)
  const totals = {
    avis: items.filter(i => i.kind === "avis").reduce((s, i) => s + i.pendingCount, 0),
    devis: items.filter(i => i.kind === "devis" || i.kind === "devis_complementaire").reduce((s, i) => s + i.pendingCount, 0),
    facture: items.filter(i => i.kind === "facture").reduce((s, i) => s + i.pendingCount, 0),
    autre: items.filter(i => i.kind === "autre").reduce((s, i) => s + i.pendingCount, 0),
    all: items.reduce((s, i) => s + i.pendingCount, 0),
  }

  return { groups, totals }
}

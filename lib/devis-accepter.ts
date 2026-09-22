import { Resend } from "resend"
import { getSupabaseOrNull } from "@/lib/supabase"
import { detectTypeIntervention } from "@/lib/types-intervention"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import { getTelPrincipal } from "@/lib/parametres"

/** Annule des emails Resend planifiés (relances). Best-effort. */
async function cancelResendEmails(ids: string[]): Promise<number> {
  const key = process.env.RESEND_API_KEY
  const list = (ids || []).filter((x): x is string => typeof x === "string" && x.length > 0)
  if (!key || list.length === 0) return 0
  const resend = new Resend(key)
  let n = 0
  for (const id of list) {
    try {
      const r = await resend.emails.cancel(id)
      if (!r.error) n++
    } catch {
      /* ignore */
    }
  }
  return n
}

function buildReference(): string {
  const now = new Date()
  const p = (x: number) => String(x).padStart(2, "0")
  return `LTDB-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
}

type ClientRow = {
  id: string
  nom: string | null
  telephone: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
}

export type AccepterDevisResult = {
  ok: true
  accepted: true
  canceled: number
  interventionId: string | null
  created: boolean
  smsSent: boolean
  warning?: string
}

/**
 * Marque un devis comme accepté, stoppe les relances, crée/met à jour l'intervention planning.
 * Idempotent : si déjà accepté sans fiche, crée la fiche.
 */
export async function accepterDevis(devisId: string): Promise<AccepterDevisResult | { ok: false; error: string; status: number }> {
  const id = (devisId || "").trim()
  if (!id) return { ok: false, error: "id manquant", status: 400 }

  const sb = getSupabaseOrNull()
  if (!sb) return { ok: false, error: "Supabase non configuré", status: 500 }

  const { data: doc, error } = await sb
    .from("documents")
    .select("id, type, statut, payload, intervention_id, client_id, montant_ttc, numero")
    .eq("id", id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message, status: 500 }
  if (!doc) return { ok: false, error: "Devis introuvable", status: 404 }
  if (doc.type !== "devis") {
    return { ok: false, error: "Ce document n'est pas un devis", status: 400 }
  }

  const payload: Record<string, unknown> =
    doc.payload && typeof doc.payload === "object" ? { ...(doc.payload as Record<string, unknown>) } : {}

  let canceled = 0
  const payloadIds = Array.isArray(payload.relance_ids) ? (payload.relance_ids as string[]) : []
  canceled += await cancelResendEmails(payloadIds)

  if (doc.intervention_id) {
    const { data: itv } = await sb
      .from("interventions")
      .select("devis_relance_ids, avis_relance_ids")
      .eq("id", doc.intervention_id)
      .maybeSingle()
    const devisIds = itv && Array.isArray((itv as { devis_relance_ids?: unknown }).devis_relance_ids)
      ? ((itv as { devis_relance_ids: string[] }).devis_relance_ids)
      : []
    canceled += await cancelResendEmails(devisIds)
    try {
      await sb
        .from("interventions")
        .update({ devis_relance_ids: [], devis_accepte_at: new Date().toISOString() })
        .eq("id", doc.intervention_id)
    } catch {
      /* migration absente */
    }
  }

  let client: ClientRow | null = null
  if (doc.client_id) {
    const { data: c } = await sb
      .from("clients")
      .select("id, nom, telephone, adresse, code_postal, ville")
      .eq("id", doc.client_id)
      .maybeSingle()
    if (c) client = c as ClientRow
  }

  // Adresse chantier éventuelle dans le payload devis
  const payloadAdresse =
    typeof payload.adresse_chantier === "string" ? payload.adresse_chantier.trim()
    : typeof payload.adresse === "string" ? (payload.adresse as string).trim()
    : ""
  const payloadVille = typeof payload.ville === "string" ? (payload.ville as string).trim() : ""
  const payloadCp = typeof payload.code_postal === "string" ? (payload.code_postal as string).trim() : ""

  const objet = typeof payload.objet === "string" ? (payload.objet as string) : ""
  const variant = typeof payload.variant === "string" ? payload.variant : ""
  const detected = detectTypeIntervention(objet)
  // Ne jamais créer une fiche type « Devis » (pas de mode terrain).
  let realType = "Travaux assainissement"
  if (variant === "travaux-assainissement") {
    realType = "Travaux assainissement"
  } else if (detected && detected !== "Devis") {
    realType = detected
  } else if (/pompe|relevage/i.test(objet)) {
    realType = "Pompe de relevage"
  } else if (/remplacement|canalisation|regard|pvc|terrass|assain/i.test(objet)) {
    realType = "Travaux assainissement"
  } else {
    realType = "Débouchage canalisation"
  }

  let interventionId: string | null = doc.intervention_id || null
  let created = false

  if (interventionId) {
    const { data: itv } = await sb
      .from("interventions")
      .select("id, type_intervention, adresse_chantier, ville, code_postal, prix_prevu")
      .eq("id", interventionId)
      .maybeSingle()
    if (itv) {
      const row = itv as {
        type_intervention: string | null
        adresse_chantier: string | null
        ville: string | null
        code_postal: string | null
        prix_prevu: number | null
      }
      const update: Record<string, unknown> = {
        devis_accepte_at: new Date().toISOString(),
      }
      if (!row.type_intervention || row.type_intervention === "Devis") {
        update.type_intervention = realType
        update.terrain_step = 0
        update.statut = "planifiee"
      }
      if (!row.adresse_chantier && (payloadAdresse || client?.adresse)) {
        update.adresse_chantier = payloadAdresse || client?.adresse
      }
      if (!row.ville && (payloadVille || client?.ville)) update.ville = payloadVille || client?.ville
      if (!row.code_postal && (payloadCp || client?.code_postal)) {
        update.code_postal = payloadCp || client?.code_postal
      }
      if (row.prix_prevu == null && typeof doc.montant_ttc === "number") update.prix_prevu = doc.montant_ttc
      await sb.from("interventions").update(update).eq("id", interventionId)
    } else {
      interventionId = null
    }
  }

  if (!interventionId) {
    if (!client) {
      payload.relance_ids = []
      payload.accepte_at = new Date().toISOString()
      await sb.from("documents").update({ statut: "accepte", payload }).eq("id", id)
      return {
        ok: true,
        accepted: true,
        canceled,
        interventionId: null,
        created: false,
        smsSent: false,
        warning: "Devis accepté, mais client introuvable : intervention non créée.",
      }
    }

    const baseRow = {
      client_id: client.id,
      type_intervention: realType,
      adresse_chantier: payloadAdresse || client.adresse,
      ville: payloadVille || client.ville,
      code_postal: payloadCp || client.code_postal,
      date_prevue: new Date().toISOString().slice(0, 10),
      statut: "planifiee" as const,
      prix_prevu: typeof doc.montant_ttc === "number" ? doc.montant_ttc : null,
      notes_internes: `Créée automatiquement depuis le devis accepté ${doc.numero || ""}`.trim(),
      devis_accepte_at: new Date().toISOString(),
      terrain_step: 0,
    }

    const baseRef = buildReference()
    let inserted: { id: string } | null = null
    let insertErr: { message?: string; code?: string } | null = null
    let currentRef = baseRef
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await sb
        .from("interventions")
        .insert({ reference: currentRef, ...baseRow })
        .select("id")
        .single()
      if (!res.error && res.data) {
        inserted = res.data as { id: string }
        insertErr = null
        break
      }
      insertErr = res.error
      if (res.error?.code === "23505") {
        currentRef = `${baseRef}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
        continue
      }
      break
    }

    if (!inserted) {
      // Ne marque PAS accepté si on ne peut pas créer la fiche (évite les orphelins)
      // Sauf si déjà accepté avant : on remonte l'erreur.
      if (doc.statut !== "accepte") {
        return {
          ok: false,
          error: `Création de l'intervention impossible : ${insertErr?.message || "erreur"}`,
          status: 500,
        }
      }
      return {
        ok: true,
        accepted: true,
        canceled,
        interventionId: null,
        created: false,
        smsSent: false,
        warning: `Devis déjà accepté, mais création de l'intervention impossible : ${insertErr?.message || "erreur"}`,
      }
    }

    interventionId = inserted.id
    created = true
  }

  // Statut accepté + lien document → après création réussie (ou mise à jour)
  payload.relance_ids = []
  payload.accepte_at = new Date().toISOString()
  await sb
    .from("documents")
    .update({ statut: "accepte", payload, intervention_id: interventionId })
    .eq("id", id)

  let smsSent = false
  // SMS seulement à la première acceptation (évite double SMS sur rattrapage)
  const wasAlreadyAccepted = doc.statut === "accepte"
  if (!wasAlreadyAccepted && isSmsConfigured() && client?.telephone) {
    try {
      const tel = await getTelPrincipal()
      const num = doc.numero ? ` ${doc.numero}` : ""
      const message =
        `Les Techniciens du Debouchage : votre devis${num} est bien valide. `
        + `Nous planifions votre intervention. Une question ? ${tel}`
      const r = await sendSms({ to: client.telephone, content: message })
      smsSent = r.ok
      if (!r.ok) console.error("[devis/accepter] SMS", r.error)
    } catch (e) {
      console.error("[devis/accepter] SMS", e)
    }
  }

  return { ok: true, accepted: true, canceled, interventionId, created, smsSent }
}

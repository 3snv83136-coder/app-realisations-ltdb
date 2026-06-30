import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { getSupabaseOrNull } from "@/lib/supabase"
import { detectTypeIntervention } from "@/lib/types-intervention"
import { isTwilioSmsConfigured, sendSmsTwilio } from "@/lib/sms-twilio"
import { getTelPrincipal } from "@/lib/parametres"

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Params = { params: { id: string } }

/** Annule des emails Resend planifiés (relances). Best-effort, jamais bloquant. */
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
      /* relance déjà partie ou id invalide : on ignore */
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

/**
 * Marque un devis comme accepté :
 *  1. stoppe toutes les relances (devis + avis) encore planifiées,
 *  2. passe le statut du document à "accepte",
 *  3. crée l'intervention correspondante (planning) si elle n'existe pas déjà.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const id = params.id
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 })

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const { data: doc, error } = await sb
    .from("documents")
    .select("id, type, statut, payload, intervention_id, client_id, montant_ttc, numero")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!doc) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 })
  if (doc.type !== "devis") {
    return NextResponse.json({ error: "Ce document n'est pas un devis" }, { status: 400 })
  }

  const payload: Record<string, unknown> =
    doc.payload && typeof doc.payload === "object" ? { ...(doc.payload as Record<string, unknown>) } : {}

  // 1. Annulation des relances --------------------------------------------------
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
      /* migration 018 non appliquée : on n'échoue pas l'acceptation */
    }
  }

  // 2. Statut accepté -----------------------------------------------------------
  payload.relance_ids = []
  payload.accepte_at = new Date().toISOString()
  await sb.from("documents").update({ statut: "accepte", payload }).eq("id", id)

  // Client (pour création d'intervention + éventuel SMS de confirmation).
  let client: ClientRow | null = null
  if (doc.client_id) {
    const { data: c } = await sb
      .from("clients")
      .select("id, nom, telephone, adresse, code_postal, ville")
      .eq("id", doc.client_id)
      .maybeSingle()
    if (c) client = c as ClientRow
  }

  // Type d'intervention « classique » déduit de l'objet du devis. On évite le
  // type "Devis" (= fiche sans mode terrain) : on veut une intervention normale
  // avec wizard Mode Terrain.
  const objet = typeof payload.objet === "string" ? (payload.objet as string) : ""
  const detected = detectTypeIntervention(objet)
  const realType = detected && detected !== "Devis" ? detected : "Débouchage canalisation"

  // 3. Intervention classique (avec Mode Terrain) -------------------------------
  let interventionId: string | null = doc.intervention_id || null
  let created = false

  if (interventionId) {
    // Une intervention est déjà liée. Si c'est une fiche "Devis" (sans mode
    // terrain) on la convertit en intervention classique pour débloquer le
    // wizard Mode Terrain. On complète aussi l'adresse / le prix si manquants.
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
      const update: Record<string, unknown> = {}
      if (!row.type_intervention || row.type_intervention === "Devis") {
        update.type_intervention = realType
        update.terrain_step = 0
        update.statut = "planifiee"
      }
      if (!row.adresse_chantier && client?.adresse) update.adresse_chantier = client.adresse
      if (!row.ville && client?.ville) update.ville = client.ville
      if (!row.code_postal && client?.code_postal) update.code_postal = client.code_postal
      if (row.prix_prevu == null && typeof doc.montant_ttc === "number") update.prix_prevu = doc.montant_ttc
      if (Object.keys(update).length) {
        await sb.from("interventions").update(update).eq("id", interventionId)
      }
    } else {
      // L'intervention liée n'existe plus : on en recrée une.
      interventionId = null
    }
  }

  if (!interventionId) {
    if (!client) {
      return NextResponse.json(
        { ok: true, accepted: true, canceled, interventionId: null, created: false,
          warning: "Devis accepté, mais client introuvable : intervention non créée." },
      )
    }

    const baseRow = {
      client_id: client.id,
      type_intervention: realType,
      adresse_chantier: client.adresse,
      ville: client.ville,
      code_postal: client.code_postal,
      date_prevue: new Date().toISOString().slice(0, 10),
      statut: "planifiee" as const,
      prix_prevu: typeof doc.montant_ttc === "number" ? doc.montant_ttc : null,
      notes_internes: `Créée automatiquement depuis le devis accepté ${doc.numero || ""}`.trim(),
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
      return NextResponse.json(
        { ok: true, accepted: true, canceled, interventionId: null, created: false,
          warning: `Devis accepté, mais création de l'intervention impossible : ${insertErr?.message || "erreur"}` },
      )
    }

    interventionId = inserted.id
    created = true
    await sb.from("documents").update({ intervention_id: interventionId }).eq("id", id)
  }

  // 4. SMS de confirmation au client (best-effort, uniquement si Twilio configuré) -
  let smsSent = false
  if (isTwilioSmsConfigured() && client?.telephone) {
    try {
      const tel = await getTelPrincipal()
      const num = doc.numero ? ` ${doc.numero}` : ""
      const message =
        `Les Techniciens du Debouchage : votre devis${num} est bien valide. `
        + `Nous planifions votre intervention. Une question ? ${tel}`
      const r = await sendSmsTwilio({ to: client.telephone, content: message })
      smsSent = r.ok
      if (!r.ok) console.error("[devis/accepter] SMS Twilio", r.error)
    } catch (e) {
      console.error("[devis/accepter] SMS", e)
    }
  }

  return NextResponse.json({ ok: true, accepted: true, canceled, interventionId, created, smsSent })
}

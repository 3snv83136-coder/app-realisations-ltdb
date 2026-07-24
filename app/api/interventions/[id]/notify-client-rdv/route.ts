import { NextRequest, NextResponse } from "next/server"
import { requireInterventionAccess } from "@/lib/intervention-access"
import { buildClientRdvSmsText } from "@/lib/notify-client-rdv-message"
import { getTelPrincipal } from "@/lib/parametres"
import { isSmsConfigured, sendSms } from "@/lib/sms-provider"
import { getSupabaseOrNull } from "@/lib/supabase"

export const maxDuration = 30

type Params = { params: { id: string } }

/** SMS commercial de confirmation RDV au client (manuel, après création). */
export async function POST(req: NextRequest, { params }: Params) {
  const access = await requireInterventionAccess(req, params.id)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  if (!isSmsConfigured()) {
    return NextResponse.json(
      { error: "SMS non configure : ajoute BREVO_API_KEY sur Vercel." },
      { status: 500 },
    )
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configure" }, { status: 500 })
  }

  let bodyOverride: {
    mode_paiement?: string | null
    heure_fin_prevue?: string | null
  } = {}
  try {
    bodyOverride = await req.json()
  } catch {
    /* body optionnel */
  }

  const { data: interv, error: intervErr } = await sb
    .from("interventions")
    .select("id, client_id, type_intervention, date_prevue, heure_prevue, heure_fin_prevue, statut")
    .eq("id", params.id)
    .maybeSingle()

  let intervRow: {
    id: string
    client_id: string | null
    type_intervention: string | null
    date_prevue: string | null
    heure_prevue: string | null
    heure_fin_prevue: string | null
    statut: string
  } | null = interv

  if (intervErr?.message?.includes("heure_fin_prevue") || (!interv && intervErr)) {
    const { data: fallback } = await sb
      .from("interventions")
      .select("id, client_id, type_intervention, date_prevue, heure_prevue, statut")
      .eq("id", params.id)
      .maybeSingle()
    if (fallback) {
      intervRow = { ...fallback, heure_fin_prevue: null }
    }
  }

  if (!intervRow) {
    return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
  }
  if (intervRow.statut === "annulee") {
    return NextResponse.json({ error: "Intervention annulee" }, { status: 400 })
  }
  if (!intervRow.client_id) {
    return NextResponse.json({ error: "Aucun client lie a cette intervention" }, { status: 400 })
  }

  const { data: client } = await sb
    .from("clients")
    .select("nom, telephone")
    .eq("id", intervRow.client_id)
    .maybeSingle()

  const phone = (client?.telephone || "").trim()
  if (!phone) {
    return NextResponse.json(
      { error: "Telephone client manquant — impossible d'envoyer le SMS." },
      { status: 400 },
    )
  }

  let modePaiement = bodyOverride.mode_paiement ?? null
  if (!modePaiement) {
    const { data: row } = await sb
      .from("interventions")
      .select("mode_paiement")
      .eq("id", params.id)
      .maybeSingle()
    modePaiement = (row as { mode_paiement?: string | null } | null)?.mode_paiement ?? null
  }

  const heureFin =
    bodyOverride.heure_fin_prevue
    || intervRow.heure_fin_prevue
    || null

  const telEntreprise = await getTelPrincipal()
  const message = buildClientRdvSmsText({
    clientNom: client?.nom,
    typeIntervention: intervRow.type_intervention,
    datePrevue: intervRow.date_prevue,
    heurePrevue: intervRow.heure_prevue,
    heureFinPrevue: heureFin,
    modePaiement,
    telEntreprise,
  })

  const result = await sendSms({ to: phone, content: message })
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Echec envoi SMS" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    messageId: result.messageId,
    preview: message,
  })
}

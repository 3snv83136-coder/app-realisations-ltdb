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

  const { data: interv } = await sb
    .from("interventions")
    .select("id, client_id, type_intervention, date_prevue, heure_prevue, statut")
    .eq("id", params.id)
    .maybeSingle()

  if (!interv) {
    return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
  }
  if (interv.statut === "annulee") {
    return NextResponse.json({ error: "Intervention annulee" }, { status: 400 })
  }
  if (!interv.client_id) {
    return NextResponse.json({ error: "Aucun client lie a cette intervention" }, { status: 400 })
  }

  const { data: client } = await sb
    .from("clients")
    .select("nom, telephone")
    .eq("id", interv.client_id)
    .maybeSingle()

  const phone = (client?.telephone || "").trim()
  if (!phone) {
    return NextResponse.json(
      { error: "Telephone client manquant — impossible d'envoyer le SMS." },
      { status: 400 },
    )
  }

  let bodyOverride: {
    mode_paiement?: string | null
  } = {}
  try {
    bodyOverride = await req.json()
  } catch {
    /* body optionnel */
  }

  // mode_paiement : body prioritaire (formulaire), sinon colonne DB si présente
  let modePaiement = bodyOverride.mode_paiement ?? null
  if (!modePaiement) {
    const { data: row } = await sb
      .from("interventions")
      .select("mode_paiement")
      .eq("id", params.id)
      .maybeSingle()
    modePaiement = (row as { mode_paiement?: string | null } | null)?.mode_paiement ?? null
  }
  const telEntreprise = await getTelPrincipal()
  const message = buildClientRdvSmsText({
    clientNom: client?.nom,
    typeIntervention: interv.type_intervention,
    datePrevue: interv.date_prevue,
    heurePrevue: interv.heure_prevue,
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

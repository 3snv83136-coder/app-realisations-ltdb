import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, assertInterventionAccess } from "@/lib/intervention-access"
import { buildRapportFacturePlainText } from "@/lib/rapport-facture-message"
import { getTelPrincipal } from "@/lib/parametres"
import { normalizePhoneForSmsUri } from "@/lib/sms"
import { getSupabaseOrNull } from "@/lib/supabase"

export const maxDuration = 60

/**
 * Prépare le texte SMS (messagerie native du téléphone).
 * Les PDF doivent déjà être uploadés (comme pour le mail).
 */
export async function POST(req: NextRequest) {
  let body: { interventionId?: string; clientPhone?: string; markSent?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const interventionId = (body.interventionId || "").trim()
  const clientPhone = (body.clientPhone || "").trim()
  if (!interventionId) {
    return NextResponse.json({ error: "interventionId requis" }, { status: 400 })
  }
  if (!clientPhone || !normalizePhoneForSmsUri(clientPhone)) {
    return NextResponse.json({ error: "Numéro de téléphone client invalide" }, { status: 400 })
  }

  const user = await getSessionUser()
  const access = await assertInterventionAccess(interventionId, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const { data: interv, error: intErr } = await sb
    .from("interventions")
    .select("id, reference, ville, date_realisee, date_prevue, client_id, technicien_id, pdf_rapport_url")
    .eq("id", interventionId)
    .single()
  if (intErr || !interv) {
    return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })
  }
  if (!interv.pdf_rapport_url) {
    return NextResponse.json({
      error: "Aucun PDF rapport en ligne — génère d'abord les documents (comme pour le mail).",
    }, { status: 400 })
  }

  const { data: factures } = await sb
    .from("documents")
    .select("id, numero, montant_ttc, pdf_url")
    .eq("intervention_id", interventionId)
    .eq("type", "facture")
    .order("created_at", { ascending: false })
    .range(0, 0)
  const facture = factures?.[0]
  if (!facture?.pdf_url) {
    return NextResponse.json({ error: "Facture PDF introuvable — crée la facture d'abord." }, { status: 400 })
  }

  let clientNom = ""
  if (interv.client_id) {
    const { data: cl } = await sb.from("clients").select("nom").eq("id", interv.client_id).single()
    if (cl?.nom) clientNom = cl.nom
  }

  let technicienNom = "votre technicien"
  if (interv.technicien_id) {
    const { data: t } = await sb.from("techniciens").select("nom").eq("id", interv.technicien_id).single()
    if (t?.nom) technicienNom = t.nom
  }

  let reviewUrl = process.env.GOOGLE_REVIEW_URL
    || "https://www.google.com/maps/place/Les+Techniciens+du+Débouchage"
  try {
    const { data: paramRow } = await sb
      .from("parametres")
      .select("valeur")
      .eq("cle", "google_review_url")
      .maybeSingle()
    if (paramRow?.valeur) reviewUrl = paramRow.valeur
  } catch { /* best-effort */ }

  const tel = await getTelPrincipal()
  const smsBody = buildRapportFacturePlainText({
    clientNom,
    technicienNom,
    ville: interv.ville || "",
    dateIntervention: interv.date_realisee || interv.date_prevue || "",
    reference: interv.reference || interv.id.slice(0, 8),
    factureNumero: facture.numero || "",
    totalTTC: typeof facture.montant_ttc === "number" ? facture.montant_ttc : null,
    reviewUrl,
    tel,
    rapportUrl: interv.pdf_rapport_url,
    factureUrl: facture.pdf_url,
  })

  if (body.markSent !== false) {
    try {
      await sb
        .from("interventions")
        .update({ sms_envoye_at: new Date().toISOString() })
        .eq("id", interventionId)
    } catch { /* best-effort */ }

    if (interv.client_id) {
      try {
        await sb.from("clients").update({
          telephone: normalizePhoneForSmsUri(clientPhone) || clientPhone,
        }).eq("id", interv.client_id)
      } catch { /* best-effort */ }
    }
  }

  return NextResponse.json({ ok: true, body: smsBody })
}

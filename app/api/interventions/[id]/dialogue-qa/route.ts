import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, assertInterventionAccess } from "@/lib/intervention-access"
import {
  applyPrixToDialogue,
  genererDialogueQa,
  normalizeDialogueQa,
  resolvePrixPlaceholdersForType,
} from "@/lib/generer-dialogue-qa"
import { getSupabaseOrNull } from "@/lib/supabase"
import type { DialogueQa, RapportData, SeoData } from "@/lib/types-documents"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Params = { params: { id: string } }

/**
 * POST — génère (ou régénère) le dialogue Q&A et le persiste dans seo_json.
 * Body optionnel : { force?: boolean }
 *
 * PATCH — édition manuelle du dialogue.
 * Body : { dialogue_qa: DialogueQa }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const user = await getSessionUser()
  const access = await assertInterventionAccess(params.id, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let force = false
  try {
    const body = await req.json()
    force = body?.force === true
  } catch {
    /* body optionnel */
  }

  const { data: interv, error } = await sb
    .from("interventions")
    .select("id, type_intervention, rapport_json, seo_json")
    .eq("id", params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const rapport = interv.rapport_json as Partial<RapportData> | null
  if (!rapport || Object.keys(rapport).length === 0) {
    return NextResponse.json({ error: "Rapport manquant — génère le rapport d'abord." }, { status: 400 })
  }

  const seoExisting = (interv.seo_json || {}) as SeoData
  if (!force && normalizeDialogueQa(seoExisting.dialogue_qa)) {
    return NextResponse.json({
      ok: true,
      dialogue_qa: seoExisting.dialogue_qa,
      reused: true,
    })
  }

  const generated = await genererDialogueQa(rapport, {
    typeIntervention: interv.type_intervention as string | null,
  })
  if (!generated) {
    return NextResponse.json(
      { error: "Génération du dialogue impossible (IA ou JSON invalide)." },
      { status: 502 },
    )
  }

  const prix = await resolvePrixPlaceholdersForType(interv.type_intervention as string | null)
  const dialogue_qa = applyPrixToDialogue(generated, prix)
  const seo_json: SeoData = { ...seoExisting, dialogue_qa }

  const { error: upErr } = await sb
    .from("interventions")
    .update({ seo_json })
    .eq("id", params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, dialogue_qa, reused: false })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const user = await getSessionUser()
  const access = await assertInterventionAccess(params.id, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  let body: { dialogue_qa?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const dialogue = normalizeDialogueQa(body.dialogue_qa)
  if (!dialogue) {
    return NextResponse.json({
      error: "dialogue_qa invalide — attendu { items: [{ role: 'client'|'technicien', texte }] } (min 4 tours).",
    }, { status: 400 })
  }

  const { data: interv, error } = await sb
    .from("interventions")
    .select("id, type_intervention, seo_json")
    .eq("id", params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const prix = await resolvePrixPlaceholdersForType(interv.type_intervention as string | null)
  const dialogue_qa: DialogueQa = applyPrixToDialogue(dialogue, prix)
  const seo_json: SeoData = {
    ...((interv.seo_json || {}) as SeoData),
    dialogue_qa,
  }

  const { error: upErr } = await sb
    .from("interventions")
    .update({ seo_json })
    .eq("id", params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, dialogue_qa })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const user = await getSessionUser()
  const access = await assertInterventionAccess(params.id, user)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const { data: interv, error } = await sb
    .from("interventions")
    .select("seo_json")
    .eq("id", params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!interv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 })

  const seo = (interv.seo_json || {}) as SeoData
  return NextResponse.json({
    dialogue_qa: normalizeDialogueQa(seo.dialogue_qa),
  })
}

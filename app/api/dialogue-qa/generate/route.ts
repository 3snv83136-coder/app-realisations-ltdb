import { NextRequest, NextResponse } from "next/server"
import {
  applyPrixToDialogue,
  genererDialogueQa,
  normalizeDialogueQa,
  resolvePrixPlaceholdersForType,
} from "@/lib/generer-dialogue-qa"
import type { RapportData, SeoData } from "@/lib/types-documents"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/dialogue-qa/generate
 * Génère un dialogue Q&A à partir d'un rapport (sans intervention_id).
 * Utilisé par rapport-externe / nouveau avant publication Django.
 *
 * Body: { rapport, type_intervention?, seo? }
 * Si seo.dialogue_qa est déjà valide → le renvoie (sauf force: true).
 */
export async function POST(req: NextRequest) {
  let body: {
    rapport?: Partial<RapportData>
    type_intervention?: string
    seo?: SeoData
    force?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const rapport = body.rapport
  if (!rapport || typeof rapport !== "object" || Object.keys(rapport).length === 0) {
    return NextResponse.json({ error: "rapport requis" }, { status: 400 })
  }

  const existing = normalizeDialogueQa(body.seo?.dialogue_qa)
  if (existing && body.force !== true) {
    return NextResponse.json({ ok: true, dialogue_qa: existing, reused: true })
  }

  const generated = await genererDialogueQa(rapport, {
    typeIntervention: body.type_intervention || null,
  })
  if (!generated) {
    return NextResponse.json(
      { error: "Génération du dialogue impossible (IA ou JSON invalide)." },
      { status: 502 },
    )
  }

  const prix = await resolvePrixPlaceholdersForType(body.type_intervention || null)
  const dialogue_qa = applyPrixToDialogue(generated, prix)
  return NextResponse.json({ ok: true, dialogue_qa, reused: false })
}

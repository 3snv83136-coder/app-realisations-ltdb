import { NextRequest, NextResponse } from "next/server"
import { upsertPreBilan } from "@/lib/compta-pre-bilan"
import { moisPrecedent } from "@/lib/compta-kpis"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const url = new URL(req.url)
  const anneeParam = url.searchParams.get("annee")
  const moisParam = url.searchParams.get("mois")

  const def = moisPrecedent()
  const annee = anneeParam ? Number(anneeParam) : def.annee

  const selectCols = "id, periode_annee, periode_mois, statut, snapshot, releve_id, comptable_email, envoye_at, valide_at, valide_par, created_at, updated_at"

  if (!moisParam) {
    const { data, error } = await sb
      .from("pre_bilans")
      .select(selectCols)
      .eq("periode_annee", annee)
      .order("periode_mois", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ pre_bilans: data || [], annee })
  }

  const mois = Number(moisParam)

  const { data, error } = await sb
    .from("pre_bilans")
    .select(selectCols)
    .eq("periode_annee", annee)
    .eq("periode_mois", mois)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pre_bilan: data || null, annee, mois })
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { annee?: number; mois?: number }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const def = moisPrecedent()
  const annee = body.annee || def.annee
  const mois = body.mois || def.mois

  try {
    const result = await upsertPreBilan(sb, annee, mois)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur génération pré-bilan" },
      { status: 500 },
    )
  }
}

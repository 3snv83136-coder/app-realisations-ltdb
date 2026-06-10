import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { valide_par?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const now = new Date().toISOString()
  const { data, error } = await sb
    .from("pre_bilans")
    .update({
      statut: "valide",
      valide_at: now,
      valide_par: body.valide_par || "Comptable",
      updated_at: now,
    })
    .eq("id", params.id)
    .select("id, statut, valide_at, valide_par")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, pre_bilan: data })
}

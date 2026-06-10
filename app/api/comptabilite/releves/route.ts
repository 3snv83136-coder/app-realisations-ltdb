import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré", releves: [] }, { status: 500 })

  const url = new URL(req.url)
  const annee = url.searchParams.get("annee")
  const mois = url.searchParams.get("mois")

  let q = sb
    .from("releves_bancaires")
    .select("id, compte_id, periode_annee, periode_mois, pdf_url, fichier_nom, nb_operations, solde_fin_mois, notes, uploaded_at")
    .order("periode_annee", { ascending: false })
    .order("periode_mois", { ascending: false })

  if (annee) q = q.eq("periode_annee", Number(annee))
  if (mois) q = q.eq("periode_mois", Number(mois))

  const { data, error } = await q.limit(36)
  if (error) return NextResponse.json({ error: error.message, releves: [] }, { status: 500 })

  return NextResponse.json({ releves: data || [] })
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { requireOwnerAdminApi } from "@/lib/require-owner-admin"
import { getSupabaseOrNull, type Tarif } from "@/lib/supabase"
import {
  isCustomTarifType,
  slugifyTarifType,
  tarifToCatalogItem,
} from "@/lib/tarifs-catalog"

export const dynamic = "force-dynamic"

/** Liste les tarifs / prestations (actifs par défaut). Auth requise. */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré", articles: [] }, { status: 500 })
  }

  const includeInactive = req.nextUrl.searchParams.get("all") === "1"
  let query = sb.from("tarifs").select("*").order("label", { ascending: true })
  if (!includeInactive) query = query.eq("actif", true)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message, articles: [] }, { status: 500 })
  }

  const articles = ((data as Tarif[]) || []).map(tarifToCatalogItem)
  return NextResponse.json({ articles, tarifs: data || [] })
}

/** Crée un article de prestation. Admin owner uniquement. */
export async function POST(req: NextRequest) {
  const gate = await requireOwnerAdminApi()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })
  }

  let body: {
    label?: string
    designation?: string
    pu_ht?: number
    prix?: number
    unite?: string
    type?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const label = (body.label || body.designation || "").trim()
  if (!label) {
    return NextResponse.json({ error: "Libellé requis" }, { status: 400 })
  }

  const prixRaw = body.pu_ht ?? body.prix
  const prix = typeof prixRaw === "number" ? prixRaw : Number(prixRaw)
  if (!Number.isFinite(prix) || prix < 0) {
    return NextResponse.json({ error: "Prix HT invalide" }, { status: 400 })
  }

  const unite = (body.unite || "forfait").trim() || "forfait"
  const slug = slugifyTarifType(body.type || label)
  const type = isCustomTarifType(slug)
    ? slug
    : `CUSTOM_${slug}_${Date.now().toString(36).toUpperCase().slice(-4)}`

  const { data, error } = await sb
    .from("tarifs")
    .insert({
      type,
      label,
      prix_min: prix,
      prix_max: prix,
      unite,
      actif: true,
    })
    .select("*")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Un article avec cette référence existe déjà" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    article: tarifToCatalogItem(data as Tarif),
    tarif: data,
  }, { status: 201 })
}

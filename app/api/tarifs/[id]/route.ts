import { NextRequest, NextResponse } from "next/server"
import { requireOwnerAdminApi } from "@/lib/require-owner-admin"
import { getSupabaseOrNull, type Tarif } from "@/lib/supabase"
import { tarifToCatalogItem } from "@/lib/tarifs-catalog"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

/** Met à jour un tarif (label, prix, unité, actif). */
export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireOwnerAdminApi()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })
  }

  const id = params.id
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 })

  let body: {
    label?: string
    designation?: string
    pu_ht?: number
    prix?: number
    unite?: string
    actif?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  const label = (body.label ?? body.designation)?.trim()
  if (label !== undefined) {
    if (!label) return NextResponse.json({ error: "Libellé vide" }, { status: 400 })
    update.label = label
  }

  const prixRaw = body.pu_ht ?? body.prix
  if (prixRaw !== undefined) {
    const prix = typeof prixRaw === "number" ? prixRaw : Number(prixRaw)
    if (!Number.isFinite(prix) || prix < 0) {
      return NextResponse.json({ error: "Prix HT invalide" }, { status: 400 })
    }
    update.prix_min = prix
    update.prix_max = prix
  }

  if (typeof body.unite === "string") {
    const u = body.unite.trim()
    if (!u) return NextResponse.json({ error: "Unité vide" }, { status: 400 })
    update.unite = u
  }

  if (typeof body.actif === "boolean") {
    update.actif = body.actif
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 })
  }

  const { data, error } = await sb
    .from("tarifs")
    .update(update)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Article introuvable" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    article: tarifToCatalogItem(data as Tarif),
    tarif: data,
  })
}

/** Désactive un article (soft-delete). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const gate = await requireOwnerAdminApi()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status })
  }

  const sb = getSupabaseOrNull()
  if (!sb) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })
  }

  const id = params.id
  if (!id) return NextResponse.json({ error: "id manquant" }, { status: 400 })

  const { data, error } = await sb
    .from("tarifs")
    .update({ actif: false })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Article introuvable" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    article: tarifToCatalogItem(data as Tarif),
  })
}

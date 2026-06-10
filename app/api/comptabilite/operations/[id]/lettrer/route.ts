import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const operationId = params.id
  if (!operationId) return NextResponse.json({ error: "ID opération manquant" }, { status: 400 })

  let body: {
    document_id?: string | null
    facture_fournisseur_id?: string | null
    lettre?: boolean
    categorie?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const lettre = body.lettre !== false
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    lettre,
    lettre_at: lettre ? now : null,
  }

  if (body.document_id !== undefined) patch.document_id = body.document_id
  if (body.facture_fournisseur_id !== undefined) patch.facture_fournisseur_id = body.facture_fournisseur_id
  if (body.categorie !== undefined) patch.categorie = body.categorie

  if (!lettre) {
    patch.document_id = null
    patch.facture_fournisseur_id = null
  }

  const { data, error } = await sb
    .from("operations_bancaires")
    .update(patch)
    .eq("id", operationId)
    .select("id, lettre, document_id, facture_fournisseur_id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (lettre && body.document_id) {
    await sb.from("documents").update({ statut: "paye", updated_at: now }).eq("id", body.document_id)
  }

  return NextResponse.json({ ok: true, operation: data })
}

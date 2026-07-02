import { NextRequest, NextResponse } from "next/server"
import { libelleEcriture, resoudreAffectation } from "@/lib/compta-affectation"
import { marquerFacturePayee } from "@/lib/facture-relance"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const operationId = params.id
  if (!operationId) return NextResponse.json({ error: "ID opération manquant" }, { status: 400 })

  const { data: opRow, error: opErr } = await sb
    .from("operations_bancaires")
    .select("id, debit, credit")
    .eq("id", operationId)
    .single()

  if (opErr || !opRow) {
    return NextResponse.json({ error: "Opération introuvable" }, { status: 404 })
  }

  let body: {
    document_id?: string | null
    facture_fournisseur_id?: string | null
    lettre?: boolean
    categorie?: string | null
    compte_num?: string | null
    compte_lib?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const lettre = body.lettre !== false
  const now = new Date().toISOString()
  const debit = Number(opRow.debit) || 0
  const credit = Number(opRow.credit) || 0

  let categorie = body.categorie ?? null
  if (body.facture_fournisseur_id) {
    const { data: ff } = await sb
      .from("factures_fournisseurs")
      .select("categorie")
      .eq("id", body.facture_fournisseur_id)
      .maybeSingle()
    if (!categorie && ff?.categorie) categorie = ff.categorie as string
  }

  const patch: Record<string, unknown> = {
    lettre,
    lettre_at: lettre ? now : null,
  }

  if (body.document_id !== undefined) patch.document_id = body.document_id
  if (body.facture_fournisseur_id !== undefined) patch.facture_fournisseur_id = body.facture_fournisseur_id
  if (categorie !== undefined) patch.categorie = categorie

  if (!lettre) {
    patch.document_id = null
    patch.facture_fournisseur_id = null
    patch.compte_num = null
    patch.compte_lib = null
    patch.categorie = null
  } else {
    const resolved = resoudreAffectation({
      debit,
      credit,
      document_id: body.document_id,
      facture_fournisseur_id: body.facture_fournisseur_id,
      categorie,
      compte_num: body.compte_num,
      compte_lib: body.compte_lib,
    })

    if (!resolved.ok) {
      return NextResponse.json(
        { error: resolved.error, needs_compte: resolved.needs_compte },
        { status: 400 },
      )
    }

    patch.compte_num = resolved.affectation.compte_num
    patch.compte_lib = resolved.affectation.compte_lib
  }

  const { data, error } = await sb
    .from("operations_bancaires")
    .update(patch)
    .eq("id", operationId)
    .select("id, lettre, document_id, facture_fournisseur_id, compte_num, compte_lib, categorie")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (lettre && body.document_id) {
    await marquerFacturePayee(body.document_id)
  }

  const montant = credit > 0 ? credit : debit
  const ecriture = lettre && data?.compte_num
    ? libelleEcriture(
        {
          compte_num: data.compte_num as string,
          compte_lib: (data.compte_lib as string) || "",
          compte_contrepartie: { num: data.compte_num as string, lib: (data.compte_lib as string) || "", groupe: "autre" },
          sens: credit > 0 ? "encaissement" : "decaissement",
        },
        montant,
      )
    : null

  return NextResponse.json({ ok: true, operation: data, ecriture })
}

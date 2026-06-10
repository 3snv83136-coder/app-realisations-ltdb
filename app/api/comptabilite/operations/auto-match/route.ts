import { NextRequest, NextResponse } from "next/server"
import { bornesMois } from "@/lib/compta-kpis"
import { suggererRapprochements } from "@/lib/compta-rapprochement"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let body: { annee?: number; mois?: number; from?: string; to?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  let dateFrom = body.from || ""
  let dateTo = body.to || ""
  if (body.annee && body.mois) {
    const b = bornesMois(body.annee, body.mois)
    dateFrom = b.from
    dateTo = b.to
  }

  let opsQ = sb
    .from("operations_bancaires")
    .select("id, date_operation, libelle, debit, credit, lettre")
    .eq("lettre", false)

  if (dateFrom) opsQ = opsQ.gte("date_operation", dateFrom)
  if (dateTo) opsQ = opsQ.lte("date_operation", dateTo)

  const { data: ops, error: opsErr } = await opsQ
  if (opsErr) return NextResponse.json({ error: opsErr.message }, { status: 500 })

  let recQ = sb.from("documents").select("id, numero, date_emission, montant_ttc, statut, client_id").eq("type", "facture").neq("statut", "annule")
  let depQ = sb.from("factures_fournisseurs").select("id, fournisseur, date_facture, montant_ttc")
  if (dateFrom) {
    recQ = recQ.gte("date_emission", dateFrom)
    depQ = depQ.gte("date_facture", dateFrom)
  }
  if (dateTo) {
    recQ = recQ.lte("date_emission", dateTo)
    depQ = depQ.lte("date_facture", dateTo)
  }

  const [{ data: recRows }, { data: depRows }] = await Promise.all([recQ, depQ])

  const suggestions = suggererRapprochements(
    (ops || []).map(o => ({
      id: o.id as string,
      date_operation: o.date_operation as string,
      libelle: (o.libelle as string) || "",
      debit: Number(o.debit) || 0,
      credit: Number(o.credit) || 0,
      lettre: false,
    })),
    (recRows || []).map(r => ({
      id: r.id as string,
      numero: (r.numero as string | null) ?? null,
      date_emission: r.date_emission as string,
      montant_ttc: (r.montant_ttc as number | null) ?? null,
      statut: (r.statut as string) || "",
    })),
    (depRows || []).map(d => ({
      id: d.id as string,
      fournisseur: (d.fournisseur as string) || "",
      date_facture: d.date_facture as string,
      montant_ttc: Number(d.montant_ttc) || 0,
    })),
  )

  let matched = 0
  const errors: string[] = []
  const now = new Date().toISOString()

  for (const s of suggestions) {
    const patch: Record<string, unknown> = {
      lettre: true,
      lettre_at: now,
      document_id: s.type === "recette" ? s.cible_id : null,
      facture_fournisseur_id: s.type === "depense" ? s.cible_id : null,
    }

    const { error } = await sb.from("operations_bancaires").update(patch).eq("id", s.operation_id)
    if (error) {
      errors.push(`${s.operation_id}: ${error.message}`)
      continue
    }

    if (s.type === "recette") {
      await sb.from("documents").update({ statut: "paye", updated_at: now }).eq("id", s.cible_id)
    }
    matched++
  }

  return NextResponse.json({
    ok: true,
    matched,
    suggestions_total: suggestions.length,
    ...(errors.length ? { errors } : {}),
  })
}

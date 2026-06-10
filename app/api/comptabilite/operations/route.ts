import { NextRequest, NextResponse } from "next/server"
import { bornesMois } from "@/lib/compta-kpis"
import { suggererRapprochements } from "@/lib/compta-rapprochement"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const url = new URL(req.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const annee = url.searchParams.get("annee")
  const mois = url.searchParams.get("mois")
  const lettreOnly = url.searchParams.get("lettre") === "true"
  const nonLettreOnly = url.searchParams.get("non_lettre") === "true"

  let dateFrom = from || ""
  let dateTo = to || ""
  if (annee && mois) {
    const b = bornesMois(Number(annee), Number(mois))
    dateFrom = b.from
    dateTo = b.to
  }

  let q = sb
    .from("operations_bancaires")
    .select("id, compte_id, date_operation, date_valeur, libelle, debit, credit, lettre, lettre_at, document_id, facture_fournisseur_id, categorie, import_batch_id")
    .order("date_operation", { ascending: false })

  if (dateFrom) q = q.gte("date_operation", dateFrom)
  if (dateTo) q = q.lte("date_operation", dateTo)
  if (lettreOnly) q = q.eq("lettre", true)
  if (nonLettreOnly) q = q.eq("lettre", false)

  const { data: operations, error } = await q.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ops = operations || []

  let recettesQ = sb
    .from("documents")
    .select("id, numero, date_emission, montant_ttc, statut, client_id")
    .eq("type", "facture")
    .neq("statut", "annule")

  let depensesQ = sb
    .from("factures_fournisseurs")
    .select("id, fournisseur, date_facture, montant_ttc")

  if (dateFrom) {
    recettesQ = recettesQ.gte("date_emission", dateFrom)
    depensesQ = depensesQ.gte("date_facture", dateFrom)
  }
  if (dateTo) {
    recettesQ = recettesQ.lte("date_emission", dateTo)
    depensesQ = depensesQ.lte("date_facture", dateTo)
  }

  const [{ data: recRows }, { data: depRows }] = await Promise.all([recettesQ, depensesQ])

  const clientIds = Array.from(new Set((recRows || []).map(r => r.client_id).filter(Boolean))) as string[]
  let clientsMap: Record<string, string> = {}
  if (clientIds.length > 0) {
    const { data: cls } = await sb.from("clients").select("id, nom").in("id", clientIds)
    if (cls) clientsMap = Object.fromEntries(cls.map(c => [c.id as string, (c.nom as string) || ""]))
  }

  const recettes = (recRows || []).map(r => ({
    id: r.id as string,
    numero: (r.numero as string | null) ?? null,
    date_emission: r.date_emission as string,
    montant_ttc: (r.montant_ttc as number | null) ?? null,
    statut: (r.statut as string) || "",
    client_nom: r.client_id ? clientsMap[r.client_id as string] || null : null,
  }))

  const depenses = (depRows || []).map(d => ({
    id: d.id as string,
    fournisseur: (d.fournisseur as string) || "",
    date_facture: d.date_facture as string,
    montant_ttc: Number(d.montant_ttc) || 0,
  }))

  const suggestions = suggererRapprochements(
    ops.map(o => ({
      id: o.id as string,
      date_operation: o.date_operation as string,
      libelle: (o.libelle as string) || "",
      debit: Number(o.debit) || 0,
      credit: Number(o.credit) || 0,
      lettre: !!o.lettre,
    })),
    recettes,
    depenses,
  )

  const lettrees = ops.filter(o => o.lettre).length
  const total = ops.length

  return NextResponse.json({
    operations: ops,
    recettes,
    depenses,
    suggestions,
    stats: {
      total,
      lettrees,
      non_lettrees: total - lettrees,
      taux_rapprochement: total > 0 ? Math.round((lettrees / total) * 1000) / 10 : 0,
    },
  })
}

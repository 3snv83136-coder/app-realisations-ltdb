import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { parseReleveCsv } from "@/lib/csv-releve-parser"
import { ensureCompteBancairePrincipal } from "@/lib/compta-compte"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || "intervention-pdfs"

export async function POST(req: NextRequest) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Multipart/form-data attendu" }, { status: 400 })
  }

  const annee = Number(formData.get("periode_annee"))
  const mois = Number(formData.get("periode_mois"))
  if (!Number.isInteger(annee) || annee < 2020 || !Number.isInteger(mois) || mois < 1 || mois > 12) {
    return NextResponse.json({ error: "Période invalide (periode_annee, periode_mois)" }, { status: 400 })
  }

  const pdf = formData.get("pdf")
  if (!(pdf instanceof File) || pdf.size === 0) {
    return NextResponse.json({ error: "PDF du relevé requis" }, { status: 400 })
  }
  if (pdf.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF trop lourd (max 15 Mo)" }, { status: 413 })
  }

  const soldeRaw = String(formData.get("solde_fin_mois") || "").trim().replace(",", ".")
  const solde_fin_mois = soldeRaw ? Number(soldeRaw) : null
  const notes = String(formData.get("notes") || "").trim()

  const compteId = await ensureCompteBancairePrincipal(sb)
  const importBatchId = crypto.randomUUID()

  const nonce = crypto.randomBytes(3).toString("hex")
  const pdfPath = `releves/${annee}-${String(mois).padStart(2, "0")}/releve-${Date.now()}-${nonce}.pdf`
  const pdfBuf = Buffer.from(await pdf.arrayBuffer())

  const { error: upErr } = await sb.storage
    .from(PDFS_BUCKET)
    .upload(pdfPath, pdfBuf, { contentType: "application/pdf", upsert: true })

  if (upErr) {
    return NextResponse.json({ error: `Upload Storage : ${upErr.message}` }, { status: 502 })
  }

  const { data: pub } = sb.storage.from(PDFS_BUCKET).getPublicUrl(pdfPath)
  const pdf_url = pub?.publicUrl || ""

  let nbOperations = 0
  const parseErrors: string[] = []

  const csv = formData.get("csv")
  if (csv instanceof File && csv.size > 0) {
    const text = await csv.text()
    const { lignes, errors } = parseReleveCsv(text)
    parseErrors.push(...errors)

    if (lignes.length > 0) {
      const rows = lignes.map(l => ({
        compte_id: compteId,
        date_operation: l.date_operation,
        date_valeur: l.date_valeur || null,
        libelle: l.libelle,
        reference_brute: l.reference_brute,
        debit: l.debit,
        credit: l.credit,
        source_import: "csv" as const,
        import_batch_id: importBatchId,
      }))

      const { error: insErr } = await sb.from("operations_bancaires").insert(rows)
      if (insErr) {
        return NextResponse.json({ error: `Import opérations : ${insErr.message}` }, { status: 500 })
      }
      nbOperations = rows.length
    }
  }

  const { data: releve, error: relErr } = await sb
    .from("releves_bancaires")
    .upsert(
      {
        compte_id: compteId,
        periode_annee: annee,
        periode_mois: mois,
        pdf_url,
        fichier_nom: pdf.name,
        import_batch_id: importBatchId,
        nb_operations: nbOperations,
        solde_fin_mois: Number.isFinite(solde_fin_mois) ? solde_fin_mois : null,
        notes: notes || null,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "compte_id,periode_annee,periode_mois" },
    )
    .select("id, periode_annee, periode_mois, pdf_url, nb_operations")
    .single()

  if (relErr) {
    return NextResponse.json({ error: relErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    releve,
    nb_operations: nbOperations,
    ...(parseErrors.length ? { parse_warnings: parseErrors } : {}),
    ...(nbOperations === 0 && !(csv instanceof File && csv.size > 0)
      ? { info: "Relevé PDF enregistré. Ajoutez un CSV pour importer les lignes bancaires." }
      : {}),
  })
}

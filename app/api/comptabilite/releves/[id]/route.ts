import { NextRequest, NextResponse } from "next/server"
import { getSupabaseOrNull } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || "intervention-pdfs"

type Params = { params: { id: string } }

function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  if (i < 0) return null
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0])
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  if (!sb) return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 })

  const id = params.id?.trim()
  if (!id) return NextResponse.json({ error: "ID relevé manquant" }, { status: 400 })

  const { data: releve, error: fetchErr } = await sb
    .from("releves_bancaires")
    .select("id, import_batch_id, pdf_url, periode_annee, periode_mois")
    .eq("id", id)
    .maybeSingle()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!releve) return NextResponse.json({ error: "Relevé introuvable" }, { status: 404 })

  let opsDeleted = 0
  if (releve.import_batch_id) {
    const { data: deleted, error: opsErr } = await sb
      .from("operations_bancaires")
      .delete()
      .eq("import_batch_id", releve.import_batch_id)
      .select("id")
    if (opsErr) return NextResponse.json({ error: `Suppression opérations : ${opsErr.message}` }, { status: 500 })
    opsDeleted = deleted?.length || 0
  }

  await sb.from("pre_bilans").update({ releve_id: null }).eq("releve_id", id)

  if (releve.pdf_url) {
    const path = storagePathFromPublicUrl(releve.pdf_url as string, PDFS_BUCKET)
    if (path) {
      try {
        await sb.storage.from(PDFS_BUCKET).remove([path])
      } catch {
        /* best-effort */
      }
    }
  }

  const { error: delErr } = await sb.from("releves_bancaires").delete().eq("id", id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    deleted_id: id,
    operations_deleted: opsDeleted,
    periode: `${releve.periode_annee}-${String(releve.periode_mois).padStart(2, "0")}`,
  })
}

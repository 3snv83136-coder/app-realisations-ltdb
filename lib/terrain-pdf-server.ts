import crypto from "crypto"
import { createElement, type ReactElement } from "react"
import { ltdbFactureEmetteur } from "@/lib/emetteur"
import { proxyImageUrlAbsolute } from "@/lib/proxyImageUrl"
import { getLtdbSignatureUrl } from "@/lib/rapport-signatures"
import type { SupabaseClient } from "@supabase/supabase-js"

const PDFS_BUCKET = process.env.SUPABASE_PDFS_BUCKET || "intervention-pdfs"

export type GenerateTerrainPdfsInput = {
  interventionId: string
  baseUrl: string
  clientNom: string
  sb: SupabaseClient
}

export type GenerateTerrainPdfsResult = {
  rapport_url: string
  facture_url: string
  rapport_bytes: number
  facture_bytes: number
}

async function uploadPdf(
  sb: SupabaseClient,
  interventionId: string,
  kind: "rapport" | "facture",
  buf: Buffer,
  factureId?: string,
): Promise<string> {
  if (buf.length < 1000) {
    throw new Error(`PDF ${kind} vide ou corrompu`)
  }
  if (buf.length > 12 * 1024 * 1024) {
    throw new Error(`PDF ${kind} trop lourd (max 12 Mo)`)
  }

  const folder = interventionId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80)
  const nonce = crypto.randomBytes(3).toString("hex")
  const path = `${folder}/${kind}-${Date.now()}-${nonce}.pdf`

  const { error: upErr } = await sb.storage
    .from(PDFS_BUCKET)
    .upload(path, buf, { contentType: "application/pdf", upsert: true })

  if (upErr) throw new Error(`Upload ${kind} : ${upErr.message}`)

  const { data: pub } = sb.storage.from(PDFS_BUCKET).getPublicUrl(path)
  const url = pub?.publicUrl
  if (!url) throw new Error(`URL publique ${kind} introuvable`)

  if (kind === "rapport") {
    const { error } = await sb.from("interventions").update({ pdf_rapport_url: url }).eq("id", interventionId)
    if (error) throw new Error(error.message)
  } else {
    if (!factureId) throw new Error("Facture introuvable")
    const { error } = await sb.from("documents").update({ pdf_url: url }).eq("id", factureId)
    if (error) throw new Error(error.message)
  }

  return url
}

export async function generateTerrainPdfsOnServer(input: GenerateTerrainPdfsInput): Promise<GenerateTerrainPdfsResult> {
  const { interventionId, baseUrl, clientNom, sb } = input

  const { data: interv, error: intErr } = await sb
    .from("interventions")
    .select("id, reference, type_intervention, adresse_chantier, ville, code_postal, date_realisee, date_prevue, agence, rapport_json, photos_urls, photos_legendes, pdf_rapport_url, technicien_id, client_id")
    .eq("id", interventionId)
    .single()

  if (intErr || !interv) throw new Error("Intervention introuvable")
  if (!interv.rapport_json || Object.keys(interv.rapport_json as object).length === 0) {
    throw new Error("Rapport non sauvegardé")
  }

  let technicienNom = "Technicien"
  if (interv.technicien_id) {
    const { data: t } = await sb.from("techniciens").select("nom").eq("id", interv.technicien_id).maybeSingle()
    if (t?.nom) technicienNom = t.nom as string
  }

  let clientRow: { adresse?: string; code_postal?: string; ville?: string } | null = null
  if (interv.client_id) {
    const { data: cl } = await sb.from("clients").select("adresse, code_postal, ville").eq("id", interv.client_id).maybeSingle()
    clientRow = cl
  }

  const { data: factures } = await sb
    .from("documents")
    .select("id, payload, pdf_url")
    .eq("intervention_id", interventionId)
    .eq("type", "facture")
    .order("created_at", { ascending: false })
    .range(0, 0)

  const facture = factures?.[0]
  if (!facture?.payload) throw new Error("Facture introuvable")

  const { data: accord } = await sb
    .from("accords_intervention")
    .select("signature_image, valide_at, statut")
    .eq("intervention_id", interventionId)
    .eq("statut", "VALIDE")
    .maybeSingle()

  const photos = ((interv.photos_urls as string[]) || []).map((url, i) => ({
    url: proxyImageUrlAbsolute(url, baseUrl),
    legende: ((interv.photos_legendes as string[]) || [])[i] || `Photo ${i + 1}`,
  }))

  const [{ renderToBuffer }, { RealisationDocument }, { FactureDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/RealisationPDF"),
    import("@/components/FacturePDF"),
  ])

  const rapportBuf = await renderToBuffer(
    createElement(RealisationDocument, {
      clientNom,
      adresse: (interv.adresse_chantier as string) || "",
      ville: (interv.ville as string) || "",
      codePostal: (interv.code_postal as string) || "",
      dateIntervention: (interv.date_realisee as string) || (interv.date_prevue as string) || "",
      typeIntervention: (interv.type_intervention as string) || "",
      technicienNom,
      rapport: interv.rapport_json,
      reference: (interv.reference as string) || undefined,
      photos,
      signatureLtdbUrl: getLtdbSignatureUrl(baseUrl),
      signatureClientUrl: (accord?.signature_image as string) || null,
      signatureClientDate: (accord?.valide_at as string) || null,
    }) as ReactElement,
  )

  const adresseLine1 = clientRow?.adresse || (interv.adresse_chantier as string) || ""
  const adresseCP = clientRow?.code_postal || (interv.code_postal as string) || ""
  const adresseVille = clientRow?.ville || (interv.ville as string) || ""
  const clientAdresseLignes: string[] = []
  if (adresseLine1) clientAdresseLignes.push(adresseLine1)
  if (adresseCP || adresseVille) {
    clientAdresseLignes.push([adresseCP, adresseVille].filter(Boolean).join(" "))
  }

  const factureBuf = await renderToBuffer(
    createElement(FactureDocument, {
      emetteur: ltdbFactureEmetteur((interv.agence as string) || undefined),
      client: {
        nom: clientNom,
        adresseLignes: clientAdresseLignes.length > 0 ? clientAdresseLignes : ["—"],
      },
      facture: facture.payload,
    }) as ReactElement,
  )

  const rapport_url = await uploadPdf(sb, interventionId, "rapport", Buffer.from(rapportBuf))
  const facture_url = await uploadPdf(sb, interventionId, "facture", Buffer.from(factureBuf), facture.id as string)

  return {
    rapport_url,
    facture_url,
    rapport_bytes: rapportBuf.byteLength,
    facture_bytes: factureBuf.byteLength,
  }
}

export async function terrainPdfsReady(sb: SupabaseClient, interventionId: string): Promise<{
  ready: boolean
  rapport_url: string | null
  facture_url: string | null
}> {
  const { data: interv } = await sb
    .from("interventions")
    .select("pdf_rapport_url")
    .eq("id", interventionId)
    .maybeSingle()

  const { data: factures } = await sb
    .from("documents")
    .select("pdf_url")
    .eq("intervention_id", interventionId)
    .eq("type", "facture")
    .order("created_at", { ascending: false })
    .range(0, 0)

  const rapport_url = (interv?.pdf_rapport_url as string) || null
  const facture_url = (factures?.[0]?.pdf_url as string) || null

  return {
    ready: !!(rapport_url && facture_url),
    rapport_url,
    facture_url,
  }
}

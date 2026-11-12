import { getSupabaseOrNull } from "@/lib/supabase"
import { detectTypeIntervention } from "@/lib/types-intervention"
import type { FactureData } from "@/lib/types-documents"

const NOTE_PREFIX = "Créée depuis la facture"

export type FacturePlanningInput = {
  interventionId?: string | null
  clientId?: string | null
  clientAdresse?: string | null
  clientCP?: string | null
  ville?: string | null
  agence?: string | null
  numero?: string | null
  totalTTC?: number | null
  facture?: Partial<FactureData> | null
}

function isoDate(raw: string | null | undefined): string {
  const s = (raw || "").trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`
  return new Date().toISOString().slice(0, 10)
}

function chantierRue(factureAdresse: string | undefined, clientAdresse: string | null | undefined): string | null {
  const client = (clientAdresse || "").trim()
  if (client) return client
  const full = (factureAdresse || "").trim()
  if (!full) return null
  return full.split(",")[0]?.trim() || full
}

function typeFromFacture(facture: Partial<FactureData> | null | undefined): string {
  const lignes = (facture?.lignes || [])
    .map(l => (l.designation || "").trim())
    .filter(Boolean)
  const text = [facture?.objet || "", ...lignes].join(" ")
  return detectTypeIntervention(text) || lignes[0]?.slice(0, 80) || "Intervention"
}

function buildReference(date: string): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, "0")
  const mi = String(now.getMinutes()).padStart(2, "0")
  return `LTDB-${date.replace(/-/g, "")}-${hh}${mi}`
}

/**
 * Une facture créée hors mode terrain doit quand même apparaître au planning.
 * Si une intervention est déjà liée, on la réutilise.
 */
export async function ensureFactureOnPlanning(input: FacturePlanningInput): Promise<string | null> {
  if (input.interventionId) return input.interventionId
  const sb = getSupabaseOrNull()
  if (!sb) return null

  const numero = (input.numero || input.facture?.numero || "").trim()
  if (numero) {
    const { data: existing } = await sb
      .from("documents")
      .select("intervention_id")
      .eq("type", "facture")
      .eq("numero", numero)
      .limit(1)
      .maybeSingle()
    if (existing?.intervention_id) return existing.intervention_id as string
  }

  const clientId = input.clientId || null
  if (!clientId) return null

  const date = isoDate(input.facture?.date_facture)
  const note = `${NOTE_PREFIX} ${numero}`.trim()
  const row: Record<string, unknown> = {
    client_id: clientId,
    agence: input.agence || null,
    type_intervention: typeFromFacture(input.facture),
    adresse_chantier: chantierRue(input.facture?.adresse_chantier, input.clientAdresse),
    ville: (input.ville || "").trim() || null,
    code_postal: (input.clientCP || "").trim() || null,
    date_prevue: date,
    date_realisee: date,
    statut: "terminee",
    prix_prevu: typeof input.totalTTC === "number" ? input.totalTTC : null,
    notes_internes: note,
  }

  const baseRef = buildReference(date)
  let currentRef = baseRef
  let lastError = ""
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await sb
      .from("interventions")
      .insert({ reference: currentRef, ...row })
      .select("id")
      .single()
    if (!res.error && res.data?.id) return res.data.id as string
    lastError = res.error?.message || "insertion impossible"
    if (res.error?.code === "23505" || /duplicate key/i.test(lastError)) {
      currentRef = `${baseRef}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`
      continue
    }
    break
  }
  console.error("[facture-planning]", lastError)
  return null
}

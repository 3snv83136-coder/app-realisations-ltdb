/**
 * Génération du dialogue Q&A « podcast écrit » pour les pages réalisations.
 * Stocké dans seo_json.dialogue_qa — injecté en HTML SSR à la publication.
 */
import { llmChat, llmIsConfigured, llmConfigError } from "@/lib/llm"
import { getSupabaseOrNull } from "@/lib/supabase"
import type { DialogueQa, DialogueQaItem, RapportData } from "@/lib/types-documents"

const SYSTEM_RULES = `Tu es un rédacteur SEO pour Les Techniciens du Débouchage (débouchage / inspection caméra / hydrocurage, Var).

Génère un dialogue client ↔ technicien style « podcast écrit ».

RÈGLES STRICTES :
1. 5 à 7 échanges MAX, strictement alternés : client puis technicien (commence par client).
2. Le client est ANONYME et générique — jamais de nom réel, prénom, adresse, email, téléphone.
3. Questions client = vraies interrogations SEO : pourquoi ça s'est bouché, combien de temps, est-ce que ça peut revenir, comment l'éviter, quel matériel utilisé, etc.
4. Le technicien explique dans l'ordre : problème → diagnostic → méthode → résultat → prévention.
5. AUCUN prix en dur, AUCUN numéro de téléphone / adresse / NAP. Pour parler de budget, utilise UNIQUEMENT les placeholders littéraux {PRIX_MIN} et {PRIX_MAX} (ex. « à partir de {PRIX_MIN} € »).
6. Ton professionnel, clair, français, phrases courtes. Pas de jargon inutile.
7. Sortie = JSON STRICT uniquement, aucun texte hors JSON, aucun backtick, aucun markdown.
Format exact :
{"items":[{"role":"client","texte":"..."},{"role":"technicien","texte":"..."}]}`

export function isDialogueQa(raw: unknown): raw is DialogueQa {
  if (!raw || typeof raw !== "object") return false
  const items = (raw as { items?: unknown }).items
  if (!Array.isArray(items) || items.length < 4 || items.length > 14) return false
  for (const it of items) {
    if (!it || typeof it !== "object") return false
    const role = (it as { role?: unknown }).role
    const texte = (it as { texte?: unknown }).texte
    if (role !== "client" && role !== "technicien") return false
    if (typeof texte !== "string" || !texte.trim()) return false
  }
  return true
}

/** Valide l’alternance client→tech et normalise le texte. */
export function normalizeDialogueQa(raw: unknown): DialogueQa | null {
  if (!isDialogueQa(raw)) return null
  const items: DialogueQaItem[] = raw.items.map((it) => ({
    role: it.role,
    texte: it.texte.trim(),
  }))
  // Au moins 2 paires client/tech
  const clients = items.filter((i) => i.role === "client").length
  const techs = items.filter((i) => i.role === "technicien").length
  if (clients < 2 || techs < 2) return null
  if (items[0].role !== "client") return null
  return { items }
}

export function remplacerPlaceholdersPrix(
  texte: string,
  prix: { min: number; max: number },
): string {
  const min = String(Math.round(prix.min))
  const max = String(Math.round(prix.max))
  return texte
    .replace(/\{PRIX_MIN\}/g, min)
    .replace(/\{PRIX_MAX\}/g, max)
}

/** Extrait les paires question(client) → réponse(technicien) pour FAQPage. */
export function dialogueQaToFaqPairs(dialogue: DialogueQa): { question: string; reponse: string }[] {
  const pairs: { question: string; reponse: string }[] = []
  for (let i = 0; i < dialogue.items.length - 1; i++) {
    const a = dialogue.items[i]
    const b = dialogue.items[i + 1]
    if (a.role === "client" && b.role === "technicien") {
      pairs.push({ question: a.texte, reponse: b.texte })
    }
  }
  return pairs
}

function stripJsonFences(raw: string): string {
  let s = raw.trim()
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
  }
  return s.trim()
}

function anonymizeRapportSummary(rapport: Partial<RapportData>, typeIntervention?: string | null): string {
  const parts: string[] = []
  if (typeIntervention?.trim()) parts.push(`Type: ${typeIntervention.trim()}`)
  if (rapport.objet?.trim()) parts.push(`Objet: ${rapport.objet.trim()}`)
  if (rapport.diagnostic?.trim()) parts.push(`Diagnostic: ${rapport.diagnostic.trim()}`)
  if (rapport.travaux_realises?.trim()) parts.push(`Travaux: ${rapport.travaux_realises.trim()}`)
  if (rapport.recommandations?.trim()) parts.push(`Recommandations: ${rapport.recommandations.trim()}`)
  if (Array.isArray(rapport.materiel_utilise) && rapport.materiel_utilise.length) {
    parts.push(`Matériel: ${rapport.materiel_utilise.filter((m) => typeof m === "string").join(", ")}`)
  }
  if (rapport.duree_intervention?.trim()) parts.push(`Durée: ${rapport.duree_intervention.trim()}`)
  // Phases (sans noms)
  if (Array.isArray(rapport.phases)) {
    for (const p of rapport.phases.slice(0, 4)) {
      if (!p || typeof p !== "object") continue
      const titre = typeof p.titre === "string" ? p.titre : ""
      const action = typeof p.action === "string" ? p.action : ""
      const resultat = typeof p.resultat === "string" ? p.resultat : ""
      if (titre || action) parts.push(`Étape ${titre}: ${action} → ${resultat}`.trim())
    }
  }
  return parts.join("\n").slice(0, 3500)
}

function stripAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/** Lit min/max depuis la table `tarifs` (jamais de prix hardcodés). */
export async function resolvePrixPlaceholdersForType(
  typeIntervention?: string | null,
): Promise<{ min: number; max: number } | null> {
  const sb = getSupabaseOrNull()
  if (!sb) return null

  const { data } = await sb
    .from("tarifs")
    .select("label, type, prix_min, prix_max, actif")
    .eq("actif", true)
    .range(0, 99)

  const rows = (data || []) as {
    label: string
    type: string
    prix_min: number
    prix_max: number
  }[]
  if (rows.length === 0) return null

  const needle = stripAccents(typeIntervention || "")
  const match = rows.find((r) => {
    const label = stripAccents(r.label || "")
    const type = stripAccents(r.type || "")
    if (!needle) return false
    return label.includes(needle) || needle.includes(label) || (type && needle.includes(type))
  })

  if (match) {
    const min = Number(match.prix_min) || 0
    const max = Number(match.prix_max) || min
    if (min <= 0) return null
    return { min, max: Math.max(min, max) }
  }

  const mins = rows.map((r) => Number(r.prix_min) || 0).filter((n) => n > 0)
  const maxs = rows.map((r) => Number(r.prix_max) || 0).filter((n) => n > 0)
  if (mins.length === 0) return null
  return {
    min: Math.min(...mins),
    max: Math.max(...(maxs.length ? maxs : mins)),
  }
}

/** Remplace les placeholders ; si pas de tarif DB → « sur devis » (jamais de prix inventé). */
export function applyPrixToDialogue(
  dialogue: DialogueQa,
  prix: { min: number; max: number } | null,
): DialogueQa {
  return {
    items: dialogue.items.map((it) => ({
      role: it.role,
      texte: prix
        ? remplacerPlaceholdersPrix(it.texte, prix)
        : it.texte
            .replace(/à partir de \{PRIX_MIN\}\s*€?/gi, "sur devis")
            .replace(/entre \{PRIX_MIN\}\s*€?\s*et \{PRIX_MAX\}\s*€?/gi, "sur devis")
            .replace(/\{PRIX_MIN\}/g, "sur devis")
            .replace(/\{PRIX_MAX\}/g, "sur devis"),
    })),
  }
}

/**
 * Appelle le LLM et retourne un DialogueQa validé (placeholders prix encore présents).
 * Retourne null si l’IA échoue ou si le JSON est invalide.
 */
export async function genererDialogueQa(
  rapport: Partial<RapportData>,
  opts?: { typeIntervention?: string | null },
): Promise<DialogueQa | null> {
  if (!llmIsConfigured()) {
    console.warn("[dialogue-qa]", llmConfigError())
    return null
  }

  const summary = anonymizeRapportSummary(rapport, opts?.typeIntervention)
  if (summary.trim().length < 40) return null

  const prompt = `${SYSTEM_RULES}

RAPPORT D'INTERVENTION (anonymisé, base factuelle) :
${summary}

Génère maintenant le JSON du dialogue.`

  try {
    const raw = await llmChat(prompt, {
      jsonMode: true,
      maxTokens: 2500,
      retries: 2,
    })
    const parsed = JSON.parse(stripJsonFences(raw)) as unknown
    return normalizeDialogueQa(parsed)
  } catch (e) {
    console.error("[dialogue-qa] génération échouée", e)
    return null
  }
}

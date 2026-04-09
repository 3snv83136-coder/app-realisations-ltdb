import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { transcription, type_intervention, ville, code_postal } = await req.json()
  if (!transcription || !type_intervention || !ville) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Appel 1 — Rapport technique
  const rapportMsg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Tu es un expert en débouchage et plomberie. À partir de cette dictée d'un technicien, génère un rapport d'intervention structuré en JSON.

Dictée: "${transcription}"
Type d'intervention: ${type_intervention}
Ville: ${ville} (${code_postal || 'Var'})

Réponds UNIQUEMENT avec ce JSON (sans markdown):
{
  "diagnostic": "description technique du problème constaté (2-3 phrases)",
  "travaux_realises": "description précise des travaux effectués (2-3 phrases)",
  "recommandations": "conseils préventifs pour le client (1-2 phrases)",
  "commentaire_technicien": "note interne technicien (1 phrase)"
}`,
    }],
  })

  let rapport: Record<string, string>
  try {
    const raw = (rapportMsg.content[0] as { type: string; text: string }).text.trim()
    rapport = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Erreur parsing rapport Claude' }, { status: 500 })
  }

  // Appel 2 — Contenu SEO
  const seoMsg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Tu es un expert SEO local spécialisé plomberie. Génère le contenu SEO pour cette page de réalisation.

Intervention: ${type_intervention} à ${ville} (${code_postal || 'Var'})
Diagnostic: ${rapport.diagnostic}
Travaux: ${rapport.travaux_realises}

Règles:
- Les prix utilisent TOUJOURS les placeholders {PRIX_MIN} et {PRIX_MAX}
- Le titre H1 max 70 caractères, inclut la ville
- Meta description max 155 caractères
- Contenu HTML basique (p, strong), 300-400 mots
- 5 questions FAQ contextuelles sur l'intervention

Réponds UNIQUEMENT avec ce JSON (sans markdown):
{
  "titre_h1": "...",
  "meta_description": "...",
  "contenu_principal": "<p>...</p>",
  "faq": [
    {"question": "...", "reponse": "..."},
    {"question": "...", "reponse": "..."},
    {"question": "...", "reponse": "..."},
    {"question": "...", "reponse": "..."},
    {"question": "...", "reponse": "..."}
  ]
}`,
    }],
  })

  let seo: Record<string, unknown>
  try {
    const raw = (seoMsg.content[0] as { type: string; text: string }).text.trim()
    seo = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Erreur parsing SEO Claude' }, { status: 500 })
  }

  return NextResponse.json({ rapport, seo })
}

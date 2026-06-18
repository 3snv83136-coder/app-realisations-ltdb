import { NextRequest, NextResponse } from "next/server"
import { getAiModel, llmChat, llmConfigError, llmIsConfigured } from "@/lib/llm"
import { VILLES_VAR, findVilleByName, searchVilles } from "@/lib/villes-var"

const TYPES = [
  'Débouchage canalisation',
  'Débouchage WC',
  'Débouchage évier',
  'Débouchage douche',
  'Hydrocurage',
  'Inspection caméra',
  'Vidange fosse septique',
  'Curage canalisation',
]

function parseJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  try { return JSON.parse(cleaned) } catch {}
  const lastBrace = cleaned.lastIndexOf('}')
  if (lastBrace > 0) {
    try { return JSON.parse(cleaned.slice(0, lastBrace + 1)) } catch {}
  }
  throw new Error('JSON invalide')
}

export async function POST(req: NextRequest) {
  const { transcription } = await req.json()
  if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 10) {
    return NextResponse.json({ error: 'Dictée trop courte' }, { status: 400 })
  }
  if (!llmIsConfigured()) {
    return NextResponse.json({ error: llmConfigError() }, { status: 500 })
  }

  const prompt = `Tu es un assistant qui extrait des informations structurées depuis la dictée vocale d'un technicien plombier du Var (83).

Dictée : """
${transcription}
"""

Types d'intervention possibles (choisis LE PLUS proche) :
${TYPES.map(t => `- ${t}`).join('\n')}

Communes possibles (101 communes du Var) : ${VILLES_VAR.map(v => v.nom).slice(0, 40).join(', ')}, … (liste complète non affichée — utilise celle qui colle le mieux phonétiquement à ce que tu entends).

Extrait les champs suivants. Si une info est absente, renvoie "" (chaîne vide). N'INVENTE RIEN.

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "type_intervention": "un des types de la liste ci-dessus",
  "ville": "nom exact de la commune du Var (orthographe officielle)",
  "adresse": "rue/numéro si mentionné, sinon \\"\\"",
  "client_nom": "nom du client si mentionné (Mme X, M. Y, nom société), sinon \\"\\"",
  "client_email": "email si dicté (ex: 'arobase' → @, 'point' → .), sinon \\"\\""
}`

  // Fallback gracieux : si l'API est KO, on renvoie des champs vides pour ne pas bloquer le flow.
  let raw: string
  try {
    raw = await llmChat(prompt, {
      model: getAiModel("flash"),
      maxTokens: 1500,
      jsonMode: true,
      retries: 5,
    })
  } catch (e: any) {
    return NextResponse.json({
      type_intervention: 'Débouchage canalisation',
      ville: '',
      code_postal: '',
      adresse: '',
      client_nom: '',
      client_email: '',
      warning: `Extraction IA indisponible (${e?.status || ''} ${String(e?.message || '').slice(0, 120)}) — remplis les champs à la main.`,
    })
  }

  let data: any
  try {
    data = parseJson(raw)
  } catch {
    return NextResponse.json({
      type_intervention: 'Débouchage canalisation',
      ville: '', code_postal: '', adresse: '', client_nom: '', client_email: '',
      warning: `Réponse IA illisible — remplis à la main.`,
    })
  }

  // Normalisation ville + récupération CP
  let ville = ''
  let codePostal = ''
  if (data.ville) {
    const exact = findVilleByName(data.ville)
    if (exact) { ville = exact.nom; codePostal = exact.cp }
    else {
      const match = searchVilles(data.ville, 1)[0]
      if (match) { ville = match.nom; codePostal = match.cp }
    }
  }

  // Validation type
  const type = TYPES.includes(data.type_intervention) ? data.type_intervention : TYPES[0]

  return NextResponse.json({
    type_intervention: type,
    ville,
    code_postal: codePostal,
    adresse: typeof data.adresse === 'string' ? data.adresse : '',
    client_nom: typeof data.client_nom === 'string' ? data.client_nom : '',
    client_email: typeof data.client_email === 'string' ? data.client_email : '',
  })
}

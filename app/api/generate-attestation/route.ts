import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { errorMessage, errorStatus } from "@/lib/error-message"
import type { AttestationData } from "@/lib/types-documents"

/** Sortie LLM avant normalisation — forme espérée mais non garantie. */
type AiAttestation = Partial<AttestationData> & Record<string, unknown>

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5"

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      const status = errorStatus(e)
      const msg = errorMessage(e)
      const retryable =
        status === 529 || status === 503 || status === 500 || status === 429 ||
        /529|overloaded|503|500|429|rate.?limit/i.test(msg)
      if (!retryable || attempt === maxAttempts) throw e
      const delay = Math.min(1500 * Math.pow(2, attempt - 1), 10000) + Math.random() * 800
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function parseJson(raw: string) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  try { return JSON.parse(cleaned) } catch {}
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (lastBrace > 0) {
    for (let i = lastBrace; i > 0; i--) {
      const attempt = cleaned.slice(0, i + 1)
      try { return JSON.parse(attempt) } catch {}
    }
  }
  throw new Error('JSON invalide')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    transcription,
    variante,       // 'tout-a-legout' | 'fosse-septique' | 'non-conforme'
    nom, prenom, adresse, code_postal, ville,
    date,
    technicien_nom,
  } = body || {}

  if (!transcription || typeof transcription !== 'string' || transcription.trim().length < 15) {
    return NextResponse.json({ error: 'Dictée trop courte — décris l\'inspection, les constats et les conclusions.' }, { status: 400 })
  }
  if (!['tout-a-legout', 'fosse-septique', 'non-conforme', 'reseau-fonctionnel'].includes(variante)) {
    return NextResponse.json({ error: 'Variante invalide (attendu: tout-a-legout | fosse-septique | non-conforme | reseau-fonctionnel).' }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 })
  }

  const today = new Date()
  const dateFinal = date || today.toISOString().slice(0, 10)
  const seq = String(today.getHours()).padStart(2, '0') + String(today.getMinutes()).padStart(2, '0')
  const numero = `ATT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${seq}`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const varianteLibelle =
    variante === 'tout-a-legout' ? 'Raccordement au tout-à-l\'égout (réseau public d\'assainissement collectif)' :
    variante === 'fosse-septique' ? 'Raccordement à une fosse septique (assainissement non collectif)' :
    variante === 'reseau-fonctionnel' ? 'Bon fonctionnement du réseau d\'évacuation après inspection caméra (client professionnel)' :
    'Non-conformité du réseau d\'évacuation'

  const promptContext = variante === 'reseau-fonctionnel'
    ? `Tu es un rédacteur technique d'attestations d'inspection pour une société d'assainissement française (LTDB). À partir d'une dictée vocale du technicien, tu produis le contenu rédactionnel d'une attestation de BON FONCTIONNEMENT du réseau destinée à un client professionnel (syndic, entreprise, collectivité, gestionnaire de site).`
    : `Tu es un rédacteur technique d'attestations d'inspection pour une société d'assainissement française (LTDB). À partir d'une dictée vocale du technicien, tu produis le contenu rédactionnel d'une attestation de conformité destinée à être jointe à un dossier notarial (vente immobilière).`

  const prompt = `${promptContext}

Type d'attestation choisi manuellement : ${varianteLibelle}

Propriétaire / client : ${prenom || ''} ${nom || ''}
Adresse du bien / site : ${adresse || ''}, ${code_postal || ''} ${ville || ''}
Date de l'inspection : ${dateFinal}
Technicien intervenant : ${technicien_nom || '(non précisé)'}

Dictée technicien :
"""
${transcription}
"""

⛔ RÈGLES DE FIDÉLITÉ — ABSOLUES (document officiel)
- N'invente AUCUN fait, matériel, mesure, état, diamètre, profondeur, longueur.
- Reformule professionnellement, mais ne rajoute rien qui ne soit pas EXPRESSÉMENT dans la dictée.
- Si un champ ne peut pas être rempli → chaîne vide "" ou tableau vide [].
- Ne qualifie JAMAIS un élément de "conforme" / "fonctionnel" s'il n'est pas affirmé par le technicien.
- Le ton est sobre, technique, factuel. Pas de formule commerciale.

📋 STRUCTURATION
Produis un JSON avec :
- "objet" : paragraphe court (2-3 phrases) qui décrit la mission (inspection caméra, tronçons concernés, objectif).
- "methode" : paragraphe (3-5 phrases) sur la méthodologie. Mentionne les moyens cités dans la dictée (caméra endoscopique, regards, etc.).
- "observations" : tableau de 4 à 8 lignes { "label", "valeur", "statut": "ok" | "ko" | "info" }.
  • "ok" uniquement si le technicien confirme explicitement un bon état / bon écoulement
  • "ko" pour une anomalie explicite
  • "info" pour les relevés neutres
- "conclusion" : paragraphe (3-5 phrases) synthétisant les constats${variante === 'reseau-fonctionnel' ? ', en vue d\'attester le bon fonctionnement si la dictée le permet' : ''}.
- "reserves" : limites d'accès / inspection partielle si mentionnées, sinon "".

${variante === 'fosse-septique' ? `
🔶 VARIANTE "FOSSE SEPTIQUE" — champs supplémentaires
Ajoute aussi "fosse" = { "volume_m3": "xxx m³", "etat": "...", "acces": "...", "derniere_vidange": "..." }
Si une info n'est pas dans la dictée, mets une chaîne vide ("") ou "Non communiquée".
` : ''}

${variante === 'non-conforme' ? `
🔴 VARIANTE "NON-CONFORME" — champs supplémentaires
Ajoute :
- "anomalies" : tableau de 3 à 6 phrases listant les non-conformités (basé uniquement sur la dictée).
- "recommandations" : tableau de 3 à 5 actions correctives SANS les chiffrer.
` : ''}

${variante === 'reseau-fonctionnel' ? `
🟢 VARIANTE "RÉSEAU FONCTIONNEL"
Privilégie des observations orientées écoulement, absence d'obstruction, état intérieur des canalisations passées à la caméra, points de contrôle (regards).
La conclusion doit rester factuelle : ne déclare le réseau "fonctionnel" que si la dictée le permet clairement.
` : ''}

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans backticks) :
{
  "objet": "...",
  "methode": "...",
  "observations": [
    { "label": "Ex: Tronçon inspecté", "valeur": "Ex: Regard R1 → R2, PVC Ø100", "statut": "info" }
  ],
  "conclusion": "...",
  "reserves": ""${variante === 'fosse-septique' ? `,
  "fosse": { "volume_m3": "", "etat": "", "acces": "", "derniere_vidange": "" }` : ''}${variante === 'non-conforme' ? `,
  "anomalies": ["..."],
  "recommandations": ["..."]` : ''}
}`

  let msg
  try {
    msg = await callWithRetry(() => client.messages.create({
      model: MODEL,
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
    }))
  } catch (e) {
    return NextResponse.json({ error: `Anthropic API : ${errorMessage(e) || e?.toString()}` }, { status: 500 })
  }

  let data: AiAttestation
  try {
    data = parseJson(
      (msg.content as { type: string; text?: string }[])
        .filter(block => block.type === "text")
        .map(block => block.text || "")
        .join("")
    )
  } catch (e) {
    const rawText = (msg.content as { type: string; text?: string }[])
      .filter(block => block.type === "text")
      .map(block => block.text || "")
      .join("")
    return NextResponse.json({
      error: `Réponse IA illisible : ${errorMessage(e)}`,
      raw: rawText.slice(0, 500),
    }, { status: 500 })
  }

  // Normalisation
  if (!Array.isArray(data.observations)) data.observations = []
  data.observations = data.observations.map((o) => ({
    label: typeof o?.label === 'string' ? o.label : '',
    valeur: typeof o?.valeur === 'string' ? o.valeur : '',
    statut: o?.statut && ['ok', 'ko', 'info'].includes(o.statut) ? o.statut : 'info',
  })).filter((o) => o.label)

  if (variante === 'non-conforme') {
    if (!Array.isArray(data.anomalies)) data.anomalies = []
    if (!Array.isArray(data.recommandations)) data.recommandations = []
  }

  return NextResponse.json({
    numero,
    date: dateFinal,
    variante,
    nom: nom || '',
    prenom: prenom || '',
    adresse: adresse || '',
    codePostal: code_postal || '',
    ville: ville || '',
    technicienNom: technicien_nom || '',
    objet: typeof data.objet === 'string' ? data.objet : '',
    methode: typeof data.methode === 'string' ? data.methode : '',
    observations: data.observations,
    conclusion: typeof data.conclusion === 'string' ? data.conclusion : '',
    reserves: typeof data.reserves === 'string' ? data.reserves : '',
    ...(variante === 'fosse-septique' ? { fosse: data.fosse || {} } : {}),
    ...(variante === 'non-conforme' ? {
      anomalies: data.anomalies,
      recommandations: data.recommandations,
    } : {}),
  })
}

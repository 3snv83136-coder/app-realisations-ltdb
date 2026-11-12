import { getAiModel, getAiProvider, llmChat } from "@/lib/llm"
import type { RapportData } from "@/lib/types-documents"

export type ExplicationPage = {
  title: string
  excerpt: string
  metaTitle: string
  metaDescription: string
  contentHtml: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function stripUnsafe(text: string): string {
  return text
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/(?:\+33|0033|0)[\s().-]*[1-9](?:[\s().-]*\d){8}\b/g, "")
    .replace(/\bLTDB\b/g, "Les Techniciens du Débouchage")
    .replace(/\d+[\s ]?(?:€|euros?)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function clip(text: string, max: number): string {
  const clean = stripUnsafe(text)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
}

function parseJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("La page d'explication n'est pas au bon format")
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === "string" ? stripUnsafe(value) : ""
}

export async function generateExplicationPage(input: {
  type: string
  ville: string
  resume?: string
  rapport?: Partial<RapportData> | null
}): Promise<ExplicationPage> {
  const r = input.rapport
  const facts = r
    ? {
        objet: r.objet,
        contexte: r.contexte,
        diagnostic: r.diagnostic,
        travaux_realises: r.travaux_realises,
        resultat: r.resultat,
        recommandations: r.recommandations,
        phases: r.phases,
        avis_technique: r.avis_technique,
        preconisations: r.preconisations,
      }
    : { extrait: input.resume || "" }

  const prompt = `Tu rédiges une page d'explication et de conseils pour Les Techniciens du Débouchage.
Cette page n'est pas une fiche réalisation : ne raconte pas le chantier comme un reportage photo.
Explique le mécanisme, puis donne des conseils concrets qu'un particulier peut appliquer.
Les données sont des faits. N'invente aucun symptôme, aucune cause, aucun outil, aucune date.
N'écris aucun prix, aucun montant, aucun numéro de téléphone, aucune URL.
N'écris pas l'abréviation LTDB. Le nom complet est Les Techniciens du Débouchage.
Si un fait est absent, omets-le. Ne transforme pas une hypothèse en certitude.
Ville : ${input.ville}
Prestation : ${input.type}
Faits : ${JSON.stringify(facts)}

Réponds en JSON avec les clés :
title (une phrase, sans prix),
excerpt (2 phrases, 280 caractères maximum),
meta_title (60 caractères maximum, avec la ville),
meta_description (150 caractères maximum, avec la ville),
introduction (ce qui a été constaté, 2 à 4 phrases),
explication (pourquoi le réseau s'est comporté ainsi, 3 à 5 phrases),
conseils (2 à 4 objets {titre, texte}, chaque texte fait 2 phrases).`

  const provider = getAiProvider()
  const raw = await llmChat(prompt, {
    provider,
    model: getAiModel("flash", provider),
    maxTokens: 1400,
    retries: 1,
    jsonMode: true,
  })
  const data = parseJson(raw)
  const introduction = asText(data.introduction)
  const explication = asText(data.explication)
  const conseils = Array.isArray(data.conseils) ? data.conseils : []
  const conseilItems = conseils
    .map(item => {
      if (!item || typeof item !== "object") return null
      const row = item as { titre?: unknown; texte?: unknown }
      const titre = asText(row.titre)
      const texte = asText(row.texte)
      if (!titre || !texte) return null
      return { titre, texte }
    })
    .filter((item): item is { titre: string; texte: string } => item !== null)
    .slice(0, 4)

  if (!introduction || !explication || conseilItems.length === 0) {
    throw new Error("La page d'explication est incomplète")
  }

  const title = clip(asText(data.title) || `${input.type} à ${input.ville} : explication et conseils`, 180)
  const excerpt = clip(asText(data.excerpt) || introduction, 280)
  const metaTitle = clip(asText(data.meta_title) || title, 60)
  const metaDescription = clip(asText(data.meta_description) || excerpt, 155)
  const conseilsHtml = conseilItems
    .map(item => `<li><strong>${escapeHtml(item.titre)}</strong> ${escapeHtml(item.texte)}</li>`)
    .join("")
  const contentHtml = [
    "<h2>Ce qui a été constaté</h2>",
    `<p>${escapeHtml(introduction)}</p>`,
    "<h2>Pourquoi le réseau a réagi ainsi</h2>",
    `<p>${escapeHtml(explication)}</p>`,
    "<h2>Conseils pour la suite</h2>",
    `<ul>${conseilsHtml}</ul>`,
  ].join("")

  return { title, excerpt, metaTitle, metaDescription, contentHtml }
}

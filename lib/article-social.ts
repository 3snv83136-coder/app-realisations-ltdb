import { getTelPrincipal } from "@/lib/parametres"

/** Légende courte d'un brouillon. Le téléphone vient de Parametre, pas du texte. */
export async function buildArticleSocialCaption(input: { title: string; meta: string }): Promise<string> {
  const tel = await getTelPrincipal()
  const title = input.title.replace(/\s+/g, " ").trim()
  const meta = input.meta.replace(/\s+/g, " ").trim()
  return [
    title,
    "",
    meta,
    "",
    `Les Techniciens du Débouchage se déplacent à Toulon et dans le Var, dans un rayon d'environ 30 km. Appelez le ${tel}. Le tarif est annoncé avant le déplacement.`,
    "https://lestechniciensdudebouchage.fr",
  ].join("\n")
}

export type PublishedExplication = {
  slug: string
  url: string
  citySlug: string
  cityName: string
}

/**
 * Publie ou met à jour la page d'explication sur le site public.
 * Le lien vers la ville est ajouté côté site, pas dans le texte généré.
 */
export async function publishExplicationPage(input: {
  interventionId: string
  type: string
  ville: string
  codePostal?: string | null
  realisationSlug?: string | null
  title: string
  excerpt: string
  metaTitle: string
  metaDescription: string
  contentHtml: string
}): Promise<PublishedExplication> {
  const ltdbUrl = process.env.LTDB_API_URL
  const token = process.env.LTDB_PUBLISH_TOKEN
  if (!ltdbUrl || !token) {
    throw new Error("Config LTDB manquante (LTDB_API_URL / LTDB_PUBLISH_TOKEN)")
  }

  const res = await fetch(`${ltdbUrl}/api/blog/from-intervention/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intervention_id: input.interventionId,
      service_type: input.type,
      ville: input.ville,
      code_postal: input.codePostal || "",
      realisation_slug: input.realisationSlug || "",
      title: input.title,
      excerpt: input.excerpt,
      meta_title: input.metaTitle,
      meta_description: input.metaDescription,
      content_html: input.contentHtml,
    }),
  })
  const data = await res.json().catch(() => ({})) as {
    error?: string
    slug?: string
    url?: string
    city_slug?: string
    city_name?: string
  }
  if (!res.ok || !data.url || !data.slug) {
    throw new Error(data.error || `Page d'explication refusée (HTTP ${res.status})`)
  }
  const url = data.url.startsWith("http")
    ? data.url
    : `https://lestechniciensdudebouchage.fr${data.url}`
  return {
    slug: data.slug,
    url,
    citySlug: data.city_slug || "",
    cityName: data.city_name || input.ville,
  }
}

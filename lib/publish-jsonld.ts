import { buildCityPageUrl } from "@/lib/seo-normalize"

const SITE = "https://lestechniciensdudebouchage.fr"

type PhotoForJsonLd = { url: string; legende?: string; alt?: string }

export function buildPublishJsonLd(opts: {
  metaTitle: string
  titreH1: string
  metaDescription: string
  resumeSnippet: string
  pageUrl: string
  pageSlug: string
  ville: string
  codePostal?: string | null
  typeIntervention: string
  interventionDate: string
  technicienNom?: string | null
  technicienTitre?: string | null
  technicienPhotoUrl?: string | null
  faq: { question: string; reponse: string }[]
  photos?: PhotoForJsonLd[]
}): Record<string, unknown> {
  const cityUrl = buildCityPageUrl(opts.ville, opts.codePostal)
  const datePublished = opts.interventionDate.includes("T")
    ? opts.interventionDate
    : `${opts.interventionDate}T12:00:00+02:00`

  const imageObjects = (opts.photos || [])
    .filter((p) => p.url?.trim())
    .map((p, i) => ({
      "@type": "ImageObject",
      "@id": `${opts.pageUrl}#photo-${i + 1}`,
      contentUrl: p.url.trim(),
      name: p.alt || p.legende || `${opts.typeIntervention} à ${opts.ville}`,
      caption: p.legende || undefined,
    }))

  const faqEntities = opts.faq
    .filter((f) => f.question?.trim() && f.reponse?.trim())
    .map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.reponse },
    }))

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${SITE}/#business`,
        name: "Les Techniciens du Débouchage",
        image: `${SITE}/images/logo.png`,
        telephone: "+33783636835",
        url: SITE,
        priceRange: "€€",
        address: {
          "@type": "PostalAddress",
          streetAddress: "700 Avenue du 15ème Corps",
          addressLocality: "Toulon",
          postalCode: "83000",
          addressRegion: "Var",
          addressCountry: "FR",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 43.1284504,
          longitude: 5.9090923,
        },
        areaServed: [
          { "@type": "City", name: opts.ville },
          { "@type": "AdministrativeArea", name: "Var" },
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${opts.pageUrl}#webpage`,
        url: opts.pageUrl,
        name: opts.metaTitle,
        description: opts.metaDescription,
        isPartOf: { "@id": `${SITE}/#website` },
        about: { "@id": `${opts.pageUrl}#service` },
        primaryImageOfPage: imageObjects[0] ? { "@id": imageObjects[0]["@id"] } : undefined,
      },
      {
        "@type": "Service",
        "@id": `${opts.pageUrl}#service`,
        name: `${opts.typeIntervention} à ${opts.ville}`,
        serviceType: opts.typeIntervention,
        provider: { "@id": `${SITE}/#business` },
        areaServed: {
          "@type": "Place",
          name: opts.ville,
          address: {
            "@type": "PostalAddress",
            addressLocality: opts.ville,
            postalCode: opts.codePostal || undefined,
            addressRegion: "Var",
            addressCountry: "FR",
          },
        },
        url: cityUrl,
      },
      {
        "@type": "Article",
        "@id": `${opts.pageUrl}#article`,
        headline: opts.titreH1,
        alternativeHeadline: opts.metaTitle,
        description: opts.metaDescription,
        abstract: opts.resumeSnippet,
        datePublished,
        dateModified: datePublished,
        image: imageObjects.length ? imageObjects.map((img) => ({ "@id": img["@id"] })) : undefined,
        author: opts.technicienNom
          ? {
              "@type": "Person",
              name: opts.technicienNom,
              jobTitle: opts.technicienTitre || "Technicien déboucheur",
              ...(opts.technicienPhotoUrl
                ? { image: opts.technicienPhotoUrl }
                : {}),
            }
          : { "@type": "Organization", name: "Les Techniciens du Débouchage" },
        publisher: { "@id": `${SITE}/#business` },
        mainEntityOfPage: { "@id": `${opts.pageUrl}#webpage` },
        about: { "@id": `${opts.pageUrl}#service` },
      },
      ...imageObjects,
      ...(faqEntities.length
        ? [{
            "@type": "FAQPage",
            "@id": `${opts.pageUrl}#faq`,
            mainEntity: faqEntities,
          }]
        : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${opts.pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: SITE },
          { "@type": "ListItem", position: 2, name: "Nos réalisations", item: `${SITE}/nos-realisations` },
          { "@type": "ListItem", position: 3, name: opts.ville, item: cityUrl },
          { "@type": "ListItem", position: 4, name: opts.titreH1, item: opts.pageUrl },
        ],
      },
    ],
  }
}

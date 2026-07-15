/** Adresse chantier pour carte / GPS (chantier prioritaire, sinon fiche client). */
export function buildChantierAddress(parts: {
  adresseChantier?: string | null
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
}): string {
  const adresse = (parts.adresseChantier || parts.adresse || '').trim()
  const cpVille = [parts.codePostal, parts.ville].filter(Boolean).join(' ').trim()
  if (adresse && cpVille) return `${adresse}, ${cpVille}, France`
  if (adresse) return `${adresse}, France`
  if (cpVille) return `${cpVille}, France`
  return ''
}

export function googleMapsDirectionsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

export function wazeNavigateUrl(destination: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`
}

export function mappyItineraireUrl(destination: string): string {
  return `https://fr.mappy.com/itineraire?addresses=${encodeURIComponent(JSON.stringify([{ address: destination }]))}`
}

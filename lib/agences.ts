export const AGENCES = [
  "Agence d'Aubagne",
  "Agence de Marseille",
  "Agence de Fréjus",
  "Agence d'Aix-en-Provence",
  "Agence de Brignoles",
] as const

export type Agence = typeof AGENCES[number]

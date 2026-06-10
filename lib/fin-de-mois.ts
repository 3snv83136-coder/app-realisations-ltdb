/** Derniers 5 jours du mois calendaire — fenêtre « accord » pour les techniciens. */
export function isAccordFinDeMois(date = new Date()): boolean {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return date.getDate() >= lastDay - 4
}

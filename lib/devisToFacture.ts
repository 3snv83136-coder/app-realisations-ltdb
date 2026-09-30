import type { DevisData, DevisLineData } from "@/components/DevisPDF"
import type { FactureData } from "@/components/FacturePDF"
import { detectTypeIntervention } from "@/lib/types-intervention"
import type { RapportToFacturePrefill } from "@/lib/rapportToFacture"

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function nextNumeroFacture(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const seq = String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0")
  return `FA-${y}${m}${day}-${seq}`
}

export type DevisToFactureSource = {
  devis: Partial<DevisData> & { lignes?: DevisLineData[] }
  numero?: string | null
  client_nom?: string | null
  client_email?: string | null
  client_adresse?: string | null
  client_code_postal?: string | null
  client_ville?: string | null
  adresse_chantier?: string | null
  tva_taux?: number | null
}

/**
 * Payload sessionStorage `ltdb_devis_to_facture` — même forme que
 * la preview devis → /facture/nouvelle.
 */
export function buildFactureFromDevis(src: DevisToFactureSource): RapportToFacturePrefill {
  const devis = src.devis || {}
  const numeroDevis = src.numero || devis.numero || ""
  const lignesSrc = Array.isArray(devis.lignes) ? devis.lignes : []

  const objetCourt =
    detectTypeIntervention(devis.objet || "") ||
    detectTypeIntervention(lignesSrc.map((l) => l.designation || "").join(" ")) ||
    "Intervention"

  const lignes = lignesSrc.length
    ? lignesSrc.map((l) => ({
        designation:
          detectTypeIntervention(l.designation || "") ||
          detectTypeIntervention(l.section || "") ||
          objetCourt,
        description: "",
        qte: Number.isFinite(Number(l.qte)) ? Number(l.qte) : 1,
        unite: l.unite || "forfait",
        pu_ht: Number.isFinite(Number(l.pu_ht)) ? Number(l.pu_ht) : 0,
        inclus: false,
      }))
    : [
        {
          designation: objetCourt,
          description: "",
          qte: 1,
          unite: "forfait",
          pu_ht: 0,
          inclus: false,
        },
      ]

  const tva =
    typeof src.tva_taux === "number"
      ? src.tva_taux
      : typeof devis.tva_taux === "number"
        ? devis.tva_taux
        : 10

  const reference_dossier = numeroDevis ? `Devis ${numeroDevis}` : "Devis"

  const facture: FactureData = {
    numero: nextNumeroFacture(),
    date_facture: todayISO(),
    echeance: "À réception",
    objet: objetCourt,
    reference_dossier,
    lignes,
    tva_taux: tva,
    mode_reglement: "",
    observations: "",
    recommandation: "",
  }

  return {
    client_nom: src.client_nom || "",
    client_adresse: src.client_adresse || "",
    client_cp: src.client_code_postal || "",
    client_ville: src.client_ville || "",
    adresse_chantier: src.adresse_chantier || "idem",
    reference_dossier,
    client_email: src.client_email || "",
    facture,
  }
}

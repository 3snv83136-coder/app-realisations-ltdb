import { DEVIS_TRAVAUX_MENTIONS_LEGALES, DEVIS_TRAVAUX_SECTIONS } from '@/lib/devis-variant'

type PromptInput = {
  transcription: string
  client_nom?: string
  client_adresse?: string
  client_ville?: string
  client_code_postal?: string
  date_devis: string
  reference_dossier?: string
  numeroFallback: string
  validite_jours?: number
}

/**
 * Prompt IA dédié aux devis travaux : terrassement, regards, réseaux EU/EP,
 * assainissement non collectif, pompes de relevage.
 */
export function buildDevisTravauxPrompt(input: PromptInput): string {
  const sectionsGuide = DEVIS_TRAVAUX_SECTIONS.join('\n- ')
  const mentionsGuide = DEVIS_TRAVAUX_MENTIONS_LEGALES.map((m, i) => `${i + 1}. ${m}`).join('\n')

  return `Tu es un assistant expert en rédaction de devis pour travaux d'ASSAINISSEMENT, TERRASSEMENT, RÉSEAUX EU/EP, REGARDS et POMPES DE RELEVAGE (LTDB — Les Techniciens du Débouchage, Var).

À partir d'une dictée du chef d'équipe, tu structures un devis TRAVAUX (pas un simple débouchage/curage ponctuel).

DICTÉE :
"""
${input.transcription}
"""

INFOS CONNUES :
- Client : ${input.client_nom || '(non précisé — extrais de la dictée si possible)'}
- Adresse client : ${input.client_adresse || '(non précisée)'}
- Ville : ${input.client_ville || ''} ${input.client_code_postal || ''}
- Date du devis : ${input.date_devis}
- Référence dossier : ${input.reference_dossier || '(aucune)'}

🧱 VOCABULAIRE MÉTIER À UTILISER (selon ce qui est dans la dictée — n'invente rien)
Terrassement : fouille en tranchée, fouille ponctuelle, blindage de paroi, étaiement, évacuation des terres, remblaiement calcaire 0/31,5, compactage, réception de plateforme.
Réseaux : canalisation EU/EP, PVC CR8, PEHD, fonte, collecteur, branchement, raccordement tout-à-l'égout, mise en conformité, pente réglementaire, lit de pose, remblai autour de canalisation.
Regards : regard de visite, chambre de visite, tampon EU/EP, tampon béton ou polypropylène, cadre et tampon carrossable, rehausse, regard enterré, regard de branchement.
Assainissement : fosse septique, fosse toutes eaux, préfiltre, bac à graisse, drain, épandement, micro-station, contrôle SPANC, mise aux normes assainissement non collectif.
Pompe de relevage : pompe submersible, surpresseur, cuve de relevage, flotteur, alarme de niveau haut, armoire de commande, épreuve d'étanchéité, mise en service.
Sécurité / chantier : balisage, confinement, ventilation, port EPI, consignation électrique, DT-DICT, occupation voirie, benne gravats, traitement des déchets.

⛔ RÈGLES DE FIDÉLITÉ (ABSOLUES)
- N'invente AUCUN prix, dimension, quantité, matériau ou prestation absente de la dictée.
- Prix non cités → "pu_ht": 0.
- Reformule professionnellement sans ajouter de faits techniques.

📋 SECTIONS (utilise celles qui correspondent au chantier, 2 à 6 sections max) :
- ${sectionsGuide}

📊 CONSTATS (comme devis classique)
- "constats_conformes" : uniquement si explicitement dit conforme / OK.
- "constats_critiques" : dysfonctionnements graves cités (regard effondré, pompe HS, non-conformité SPANC…).
- "non_garantie" : paragraphe 5 à 7 phrases sur limites de garantie (réseaux non visibles, cause racine non traitée, parties hors périmètre).

⚖️ MENTIONS LÉGALES (OBLIGATOIRE)
- Remplis "mentions_legales" avec un tableau de chaînes : reprends et adapte les mentions ci-dessous au chantier (ne supprime pas les points juridiques essentiels ; ajoute les réserves dictées par le technicien).
Base réglementaire à intégrer / adapter :
${mentionsGuide}

📝 CHAMPS SPÉCIFIQUES
- "variant": "travaux-assainissement"
- "objet" : 2-4 phrases sur la nature des travaux (terrassement, regard, pompe, raccordement…).
- "conditions.garanties" : précise garantie décennale ouvrages enterrés + parfait achèvement 1 an + garantie fabricant équipements si citée.
- "conditions.particulieres" : DT-DICT, accès engin, autorisations, délais météo, SPANC, etc.
- "tva_taux" : 10 par défaut (rénovation habitation +2 ans), 20 si neuf ou autre.

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{
  "variant": "travaux-assainissement",
  "numero": "${input.numeroFallback}",
  "date_devis": "${input.date_devis}",
  "validite_jours": ${input.validite_jours || 30},
  "majoration_note": "",
  "objet": "",
  "reference_dossier": ${input.reference_dossier ? JSON.stringify(input.reference_dossier) : '""'},
  "lignes": [
    {
      "section": "1. Terrassement & fouilles",
      "designation": "",
      "description": "",
      "qte": 1,
      "unite": "forfait",
      "pu_ht": 0
    }
  ],
  "tva_taux": 10,
  "tva_reduite_attestation": true,
  "conditions": {
    "validite": "",
    "delai_execution": "",
    "duree_chantier": "",
    "garanties": "",
    "assurance": "",
    "particulieres": ""
  },
  "modalites": {
    "acompte_pct": 30,
    "modes_paiement": ["Chèque", "Virement bancaire", "Carte bancaire", "Espèces (dans la limite légale)"]
  },
  "mentions_legales": ["chaîne par mention légale"],
  "client_nom_detecte": "",
  "client_adresse_detectee": "",
  "constats_conformes": [],
  "constats_critiques": [],
  "non_garantie": ""
}`
}

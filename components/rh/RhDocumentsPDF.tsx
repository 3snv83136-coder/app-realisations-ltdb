import React from "react"
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"
import { LTDB_EMETTEUR } from "@/lib/emetteur"
import { LTDB_FORME_JURIDIQUE, LTDB_SIRET } from "@/lib/entreprise"
import type { RhDocumentGenereType, Salarie } from "@/lib/rh/types"
import { salarieAdresseComplete, salarieNomComplet } from "@/lib/rh/types"

const C = {
  navy: '#0e2a52',
  text: '#1a1f2e',
  muted: '#5a6270',
  border: '#c7cfdb',
  rowAlt: '#f4f6fa',
  warn: '#92400e',
}

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: C.text, lineHeight: 1.45 },
  header: { borderBottomWidth: 2, borderBottomColor: C.navy, paddingBottom: 10, marginBottom: 16 },
  firm: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.navy },
  sub: { fontSize: 8.5, color: C.muted, marginTop: 2 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.navy, textAlign: 'center', marginVertical: 12, textTransform: 'uppercase' },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.navy, marginTop: 10, marginBottom: 4 },
  p: { marginBottom: 6, textAlign: 'justify' },
  row: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, borderBottomWidth: 0 },
  rowLast: { borderBottomWidth: 1 },
  cellLabel: { width: '36%', padding: 6, fontFamily: 'Helvetica-Bold', backgroundColor: C.rowAlt, borderRightWidth: 1, borderRightColor: C.border },
  cellValue: { flex: 1, padding: 6 },
  disclaimer: { marginTop: 14, padding: 8, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', fontSize: 8, color: C.warn },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  signBox: { width: '45%', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, fontSize: 9 },
})

export type RhPdfContext = {
  salarie: Salarie
  dateDocument?: string
  lieuSignature?: string
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '………………'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtMoney(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '………………'
  return `${n.toFixed(2).replace('.', ',')} €`
}

function Header() {
  return (
    <View style={s.header}>
      <Text style={s.firm}>{LTDB_EMETTEUR.raisonSociale}</Text>
      <Text style={s.sub}>
        {LTDB_EMETTEUR.adresseLignes.join(' — ')} · SIRET {LTDB_SIRET} · {LTDB_FORME_JURIDIQUE}
      </Text>
      <Text style={s.sub}>Représenté par M. NAJI MONDOR, gérant</Text>
    </View>
  )
}

function Disclaimer() {
  return (
    <Text style={s.disclaimer}>
      Gabarit standard à valider par votre conseil juridique ou expert-comptable avant signature.
      Les Techniciens du Débouchage décline toute responsabilité en cas d&apos;usage sans relecture professionnelle.
    </Text>
  )
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last ? s.rowLast : {}]}>
      <Text style={s.cellLabel}>{label}</Text>
      <Text style={s.cellValue}>{value || '………………'}</Text>
    </View>
  )
}

function SalariesBlock({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <View>
      <Text style={s.h2}>Salarié</Text>
      <InfoRow label="Nom et prénom" value={salarieNomComplet(sal)} />
      <InfoRow label="Adresse" value={salarieAdresseComplete(sal)} />
      <InfoRow label="Date de naissance" value={fmtDate(sal.date_naissance)} />
      <InfoRow label="Lieu de naissance" value={sal.lieu_naissance || ''} />
      <InfoRow label="Nationalité" value={sal.nationalite || ''} />
      <InfoRow label="N° sécurité sociale" value={sal.numero_secu || ''} last />
    </View>
  )
}

const EMPLOYEUR_VILLE = 'Toulon'
const EMPLOYEUR_GERANT = 'M. NAJI MONDOR'
const EMPLOYEUR_QUALITE = 'gérant'

function Art({ n, titre }: { n: number; titre: string }) {
  return <Text style={s.h2}>Article {n} : {titre}</Text>
}

function ContratBody({ ctx, type }: { ctx: RhPdfContext; type: 'CDI' | 'CDD' }) {
  const sal = ctx.salarie
  const nom = salarieNomComplet(sal) || '………………'
  const titre = type === 'CDI'
    ? 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE'
    : 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE'
  const remunMensuelle = sal.salaire_brut_mensuel ?? null
  const remunAnnuelle = remunMensuelle != null ? remunMensuelle * 12 : null
  const treizieme = remunMensuelle != null ? remunMensuelle / 12 : null
  const periodeEssai = sal.periode_essai_mois ?? 2

  return (
    <Page size="A4" style={s.page} wrap>
      <Header />
      <Text style={s.title}>{titre}</Text>

      <Text style={s.p}>Entre les soussignés :</Text>
      <Text style={s.p}>
        La Société <Text style={{ fontFamily: 'Helvetica-Bold' }}>{LTDB_EMETTEUR.raisonSociale}</Text>, {LTDB_FORME_JURIDIQUE},
        située {LTDB_EMETTEUR.adresseLignes.join(', ')}, immatriculée au Registre du Commerce et des Sociétés de {EMPLOYEUR_VILLE}
        sous le numéro SIRET {LTDB_SIRET},{'\n'}
        représentée par {EMPLOYEUR_GERANT}, agissant en sa qualité de {EMPLOYEUR_QUALITE}, d&apos;une part,
      </Text>
      <Text style={s.p}>Et :</Text>
      <Text style={s.p}>
        <Text style={{ fontFamily: 'Helvetica-Bold' }}>{nom}</Text>
        {sal.nationalite ? ` de nationalité ${sal.nationalite},` : ','}{'\n'}
        Né(e) le {fmtDate(sal.date_naissance)}{sal.lieu_naissance ? ` à ${sal.lieu_naissance}` : ''}
        {sal.numero_secu ? ` — N° SS : ${sal.numero_secu}` : ''},{'\n'}
        Demeurant {salarieAdresseComplete(sal)}, d&apos;autre part.
      </Text>
      <Text style={s.p}>Il est arrêté et convenu ce qui suit :</Text>

      <Art n={1} titre="Engagement" />
      <Text style={s.p}>
        Vous êtes engagé(e) à compter du {fmtDate(sal.date_embauche)} au sein de la société en
        {type === 'CDI' ? ' contrat à durée indéterminée' : ' contrat à durée déterminée'}
        {type === 'CDD' && sal.date_fin_contrat ? `, jusqu'au ${fmtDate(sal.date_fin_contrat)}` : ''}
        {type === 'CDD' && sal.motif_cdd ? ` (motif : ${sal.motif_cdd})` : ''},
        sous réserve du résultat favorable de la visite médicale d&apos;embauche.
      </Text>
      <Text style={s.p}>
        Votre contrat est régi par les dispositions légales en vigueur et par la Convention collective nationale de
        l&apos;assainissement et de la maintenance industrielle.
      </Text>

      <Art n={2} titre="Emploi et Classification" />
      <Text style={s.p}>
        {nom} est recruté(e) en qualité de {sal.poste || '………………'}, classé(e) en catégorie {sal.qualification || 'ouvrier'}
        {sal.coefficient != null ? `, coefficient ${sal.coefficient}` : ''}. Étant entendu qu&apos;en fonction des nécessités
        d&apos;organisation du travail, il/elle pourra être affecté(e) aux divers postes correspondant à la nature de son emploi.
      </Text>
      <Text style={s.p}>
        Dans votre secteur d&apos;activité, vous réalisez l&apos;ensemble des missions en relation avec votre poste et vos
        fonctions au sein de la société (cf. Annexe 1 — Fiche de poste).
      </Text>

      <Art n={3} titre="Lieu de travail et clause de mobilité" />
      <Text style={s.p}>
        {nom} exercera ses fonctions depuis le siège de la société, actuellement situé {LTDB_EMETTEUR.adresseLignes.join(', ')}.
        Ce lieu de travail ou le service auquel vous êtes affecté(e) pourra être modifié en fonction des évolutions internes de
        l&apos;entreprise, dans le respect des délais de prévenance légaux. À ce titre, vous acceptez tout changement de lieu de travail.
      </Text>

      <Art n={4} titre="Exploitation de zone" />
      <Text style={s.p}>
        L&apos;exploitation de zone est assujettie aux décisions stratégiques de l&apos;entreprise. Des aménagements peuvent
        être décidés à tout moment en fonction de l&apos;évolution économique de l&apos;entreprise et du chiffre d&apos;affaires
        réalisé par zone géographique. {nom} réalisera ses déplacements quotidiens d&apos;intervention d&apos;assainissement sur
        le secteur Var / Provence-Alpes-Côte d&apos;Azur et les régions limitrophes.
      </Text>

      <Art n={5} titre="Durée du contrat et période d'essai" />
      <Text style={s.p}>
        {type === 'CDI'
          ? "Le présent contrat est conclu pour une durée indéterminée. En conséquence, chacune des parties aura la faculté d'y mettre fin à tout moment, à charge de respecter les règles de procédures légales et conventionnelles."
          : `Le présent contrat est conclu pour une durée déterminée${sal.date_fin_contrat ? ` jusqu'au ${fmtDate(sal.date_fin_contrat)}` : ''}.`}
        {' '}Les {periodeEssai} premiers mois de son exécution constituent une période d&apos;essai, au cours de laquelle chacune
        des parties pourra mettre fin au contrat sans indemnité d&apos;aucune sorte, à charge de respecter les dispositions
        légales et conventionnelles. Cette période d&apos;essai pourra être renouvelée exceptionnellement d&apos;une période de même durée.
      </Text>

      <Art n={6} titre="Durée du travail" />
      <Text style={s.p}>
        Vous vous conformerez aux horaires de travail définis d&apos;un commun accord, à savoir {sal.temps_travail || '151,67 heures par mois'}
        en moyenne, réparties du lundi matin au vendredi soir.
      </Text>

      <Art n={7} titre="Congés payés" />
      <Text style={s.p}>
        Vous bénéficierez des congés payés conformément aux dispositions en vigueur dans l&apos;entreprise. La période des congés
        sera déterminée par décision de l&apos;employeur et portée à la connaissance du personnel conformément aux dispositions
        légales. Compte tenu du caractère cyclique de notre activité, toute demande de congés doit être réalisée au minimum trois
        mois avant sa prise en compte, pour acceptation ou refus par la direction.
      </Text>

      <Art n={8} titre="Permis de conduire" />
      <Text style={s.p}>
        Le fait que {nom} soit possesseur d&apos;un permis de conduire a été déterminant dans la conclusion de votre contrat de
        travail. {nom} remettra une photocopie de ce document à l&apos;employeur. Vous devrez tenir informée immédiatement la
        société en cas de suspension ou de retrait de points pouvant avoir des conséquences sur le maintien de votre emploi,
        celui-ci étant directement lié à l&apos;usage d&apos;un véhicule de service et d&apos;intervention.
      </Text>

      <Art n={9} titre="Protection sociale" />
      <Text style={s.p}>
        Vous cotiserez aux différents régimes de retraite et de prévoyance en vigueur au sein de notre société.
      </Text>

      <Art n={10} titre="Rémunération" />
      <Text style={s.p}>
        Votre rémunération annuelle brute est fixée à {fmtMoney(remunAnnuelle)}, soit une rémunération versée en douze
        mensualités d&apos;un montant forfaitaire brut de {fmtMoney(remunMensuelle)}.
      </Text>
      <Text style={s.p}>
        Cette rémunération revêt un caractère forfaitaire et prend en considération tout dépassement que vous serez amené(e)
        à réaliser à votre initiative. À votre rémunération s&apos;ajoutent :
      </Text>
      <Text style={s.p}>
        — un treizième mois versé au prorata 1/12 d&apos;un salaire mensuel, soit {fmtMoney(treizieme)} par mois ;{'\n'}
        — une indemnité liée à votre service d&apos;astreinte pendant le repos hebdomadaire (samedi-dimanche), selon les termes
        de la convention collective ;{'\n'}
        — une rémunération variable incitative définie selon l&apos;Annexe 2 — Prime variable.
      </Text>

      <Art n={11} titre="Astreinte" />
      <Text style={s.p}>
        Dans le cadre de vos fonctions, vous êtes soumis(e) à un service d&apos;astreinte un week-end sur deux (samedi-dimanche).
        Un planning prévisionnel annuel vous sera remis. Pendant sa durée, vous êtes libre de vaquer à vos occupations, à
        condition de rester disponible et de pouvoir, grâce aux moyens mis à votre disposition par l&apos;entreprise (véhicule
        d&apos;astreinte, téléphone), répondre au premier appel et rejoindre dans les plus brefs délais le lieu de travail indiqué.
        Le temps travaillé durant les interventions d&apos;astreinte sera récupéré la semaine suivante en accord avec votre responsable hiérarchique.
      </Text>

      <Art n={12} titre="Équipements & véhicule d'intervention" />
      <Text style={s.p}>
        {nom} s&apos;engage à utiliser avec précaution et soin l&apos;ensemble des équipements que lui remettra la société lors
        de l&apos;embauche, et en est responsable du bon usage et de la bonne tenue. Tout manquement lié à un mauvais usage et
        causant la détérioration des équipements lui sera imputable. L&apos;entreprise se réserve le droit, le cas échéant,
        d&apos;exiger son remboursement et de dégrever tout ou partie des frais de réparation sur sa rémunération.
      </Text>

      <Art n={13} titre="Usage du véhicule de service" />
      <Text style={s.p}>
        Pour les besoins du service, la société met à la disposition de {nom} un véhicule de service et d&apos;intervention
        réservé à un usage strictement professionnel. {nom} est seul(e) autorisé(e) à conduire le véhicule qui lui est confié.
        En cas d&apos;accident, le salarié doit alerter la société au plus tôt et, en tout cas, dans les 48 heures. Le véhicule
        reste la propriété de la société et devra lui être restitué en cas de rupture du contrat. {nom} s&apos;engage à respecter
        le code de la route et à prendre en charge ses contraventions, ainsi qu&apos;à veiller au bon entretien du véhicule.
      </Text>

      <Art n={14} titre="Géolocalisation des véhicules d'intervention" />
      <Text style={s.p}>
        Afin d&apos;optimiser la flotte de véhicules et les temps de déplacement sur les interventions d&apos;urgence, l&apos;entreprise
        a mis en place un service de géolocalisation des véhicules. {nom} est informé(e) par la présente de la mise en place de ce système.
      </Text>

      <Art n={15} titre="Remboursement de frais" />
      <Text style={s.p}>
        La société remboursera au salarié les frais engagés dans le cadre de l&apos;exercice de ses fonctions, sur présentation
        des justificatifs et conformément à la procédure de remboursement de frais applicable dans l&apos;entreprise. Avant
        d&apos;engager des frais, le salarié devra demander l&apos;accord de son supérieur hiérarchique.
      </Text>

      <Art n={16} titre="Règlement intérieur et charte informatique" />
      <Text style={s.p}>
        Les parties s&apos;engagent à respecter les dispositions légales, réglementaires et conventionnelles en vigueur dans
        l&apos;entreprise. Le salarié déclare avoir pris connaissance du règlement intérieur et accepte les modalités de la charte informatique.
      </Text>

      <Art n={17} titre="Obligation de fidélité" />
      <Text style={s.p}>
        Vous vous engagez à consacrer professionnellement toute votre activité à la bonne marche de l&apos;entreprise, dans le
        cadre de vos attributions, et à ne participer à aucune autre activité professionnelle pendant la durée du présent contrat.
        Vous vous engagez à n&apos;effectuer aucune prestation d&apos;assainissement à titre personnel, directement ou indirectement,
        à la demande ou pour le compte d&apos;un particulier, professionnel ou client de la société, sans en informer préalablement
        votre direction. Tout travail dissimulé ou détourné pour votre propre compte fera l&apos;objet d&apos;une procédure de
        licenciement pour faute grave ainsi que de poursuites.
      </Text>

      <Art n={18} titre="Clause de confidentialité" />
      <Text style={s.p}>
        Vous vous engagez à observer la discrétion la plus stricte sur les informations se rapportant aux activités de la société
        auxquelles vous aurez accès dans le cadre de vos fonctions (méthodes, devis, études, projets, savoir-faire, fichier client…).
        Cette obligation de confidentialité se prolongera après la cessation du contrat de travail, quelle qu&apos;en soit la cause.
      </Text>

      <Art n={19} titre="Propriété intellectuelle" />
      <Text style={s.p}>
        Les droits de propriété intellectuelle afférents aux œuvres et logiciels que vous pourriez être amené(e) à créer dans le
        cadre de votre activité professionnelle seront dévolus à la Société {LTDB_EMETTEUR.raisonSociale}, conformément aux articles
        L.113-2 et suivants et L.113-9 du Code de la propriété intellectuelle.
      </Text>

      <Art n={20} titre="Droit à l'image" />
      <Text style={s.p}>
        Vous autorisez la société {LTDB_EMETTEUR.raisonSociale} à utiliser votre photographie pour un usage strictement interne.
      </Text>

      <Art n={21} titre="Résiliation" />
      <Text style={s.p}>
        Sauf licenciement pour faute grave ou lourde, le contrat pourra être résilié par l&apos;une ou l&apos;autre des parties,
        moyennant un délai-congé dont la durée est fixée par la convention collective en fonction du statut et de l&apos;ancienneté dans l&apos;entreprise.
      </Text>

      <Art n={22} titre="Modifications des informations personnelles" />
      <Text style={s.p}>
        Vous vous engagez à informer la société dans les meilleurs délais de tout changement de votre situation personnelle
        (adresse, nombre de personnes à charge…). Votre accord implique que vous n&apos;êtes lié(e) à aucune autre entreprise et
        que vous avez quitté votre précédent employeur libre de tout engagement.
      </Text>

      <Text style={s.p}>
        Vous voudrez bien nous confirmer votre accord en apposant votre signature précédée de la mention manuscrite « lu et
        approuvé » sur la dernière page, les pages précédentes étant également à parapher.
      </Text>
      <Text style={s.p}>
        Fait à {ctx.lieuSignature || EMPLOYEUR_VILLE}, le {fmtDate(ctx.dateDocument || new Date().toISOString())}, en deux exemplaires originaux.
      </Text>
      <View style={s.signRow}>
        <Text style={s.signBox}>{EMPLOYEUR_GERANT}{'\n'}{EMPLOYEUR_QUALITE}</Text>
        <Text style={s.signBox}>Le salarié{'\n'}(signature précédée de la mention « lu et approuvé »){'\n'}{nom}</Text>
      </View>

      <Disclaimer />
    </Page>
  )
}

function DueDocument({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Text style={s.title}>DÉCLARATION UNIQUE D&apos;EMBAUCHE (DUE)</Text>
      <Text style={s.p}>Document pré-rempli à titre indicatif — à reporter sur le téléservice URSSAF Net-Entreprises.</Text>
      <Text style={s.h2}>Employeur</Text>
      <InfoRow label="Raison sociale" value={LTDB_EMETTEUR.raisonSociale} />
      <InfoRow label="SIRET" value={LTDB_SIRET} />
      <InfoRow label="Adresse" value={LTDB_EMETTEUR.adresseLignes.join(', ')} last />
      <Text style={s.h2}>Salarié</Text>
      <InfoRow label="Nom" value={sal.nom} />
      <InfoRow label="Prénom" value={sal.prenom} />
      <InfoRow label="Date de naissance" value={fmtDate(sal.date_naissance)} />
      <InfoRow label="Lieu de naissance" value={sal.lieu_naissance || ''} />
      <InfoRow label="N° sécurité sociale" value={sal.numero_secu || ''} />
      <InfoRow label="Adresse" value={salarieAdresseComplete(sal)} last />
      <Text style={s.h2}>Embauche</Text>
      <InfoRow label="Date d'embauche" value={fmtDate(sal.date_embauche)} />
      <InfoRow label="Nature du contrat" value={sal.type_contrat || 'CDI'} />
      <InfoRow label="Emploi" value={sal.poste || ''} />
      <InfoRow label="Temps de travail" value={sal.temps_travail || ''} />
      <InfoRow label="Rémunération brute mensuelle" value={fmtMoney(sal.salaire_brut_mensuel)} last />
      <Disclaimer />
    </Page>
  )
}

function FinContratDocument({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Text style={s.title}>ATTESTATION EMPLOYEUR — FIN DE CONTRAT</Text>
      <Text style={s.p}>
        Je soussigné, M. NAJI MONDOR, représentant légal de {LTDB_EMETTEUR.raisonSociale}, certifie que :
      </Text>
      <SalariesBlock ctx={ctx} />
      <Text style={s.p}>
        A été employé(e) du {fmtDate(sal.date_embauche)} au {fmtDate(sal.date_fin_contrat || ctx.dateDocument)} en qualité de {sal.poste || '………………'}.
      </Text>
      <Text style={s.p}>
        Le contrat de travail a pris fin à la date indiquée ci-dessus. Le salarié a restitué les éléments remis par l&apos;employeur dans le cadre de ses fonctions.
      </Text>
      <Text style={s.p}>Cette attestation est délivrée pour servir et valoir ce que de droit.</Text>
      <Text style={s.p}>Fait à {ctx.lieuSignature || 'Toulon'}, le {fmtDate(ctx.dateDocument || new Date().toISOString())}.</Text>
      <View style={s.signRow}>
        <Text style={s.signBox}>L&apos;employeur (cachet et signature)</Text>
        <Text style={s.signBox} />
      </View>
      <Disclaimer />
    </Page>
  )
}

function RuptureConventionnelleDocument({ ctx }: { ctx: RhPdfContext }) {
  const sal = ctx.salarie
  return (
    <Page size="A4" style={s.page}>
      <Header />
      <Text style={s.title}>RUPTURE CONVENTIONNELLE</Text>
      <Text style={s.p}>
        Entre {LTDB_EMETTEUR.raisonSociale}, représentée par M. NAJI MONDOR, et {salarieNomComplet(sal)},
        il a été convenu d&apos;un commun accord de mettre fin au contrat de travail en cours.
      </Text>
      <SalariesBlock ctx={ctx} />
      <Text style={s.h2}>Conditions</Text>
      <Text style={s.p}>
        Date d&apos;embauche initiale : {fmtDate(sal.date_embauche)}.{'\n'}
        Emploi occupé : {sal.poste || '………………'}.{'\n'}
        Date envisagée de fin du contrat : {fmtDate(sal.date_fin_contrat || ctx.dateDocument)}.
      </Text>
      <Text style={s.p}>
        Les parties conviennent de saisir l&apos;administration conformément aux articles L.1237-11 et suivants du Code du travail.
        Le présent document constitue un projet à faire valider avant signature définitive et dépôt.
      </Text>
      <Text style={s.p}>Fait à {ctx.lieuSignature || 'Toulon'}, le {fmtDate(ctx.dateDocument || new Date().toISOString())}, en deux exemplaires.</Text>
      <View style={s.signRow}>
        <Text style={s.signBox}>L&apos;employeur</Text>
        <Text style={s.signBox}>Le salarié</Text>
      </View>
      <Disclaimer />
    </Page>
  )
}

export function RhDocumentPdf({ type, ctx }: { type: RhDocumentGenereType; ctx: RhPdfContext }) {
  switch (type) {
    case 'cdi':
      return <Document><ContratBody ctx={ctx} type="CDI" /></Document>
    case 'cdd':
      return <Document><ContratBody ctx={ctx} type="CDD" /></Document>
    case 'due':
      return <Document><DueDocument ctx={ctx} /></Document>
    case 'fin_contrat':
      return <Document><FinContratDocument ctx={ctx} /></Document>
    case 'rupture_conventionnelle':
      return <Document><RuptureConventionnelleDocument ctx={ctx} /></Document>
    default:
      return <Document><Page><Text>Type inconnu</Text></Page></Document>
  }
}

export function rhPdfFilename(type: RhDocumentGenereType, salarie: Salarie): string {
  const slug = `${salarie.prenom}-${salarie.nom}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `rh-${type}-${slug}.pdf`
}

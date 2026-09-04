# Politique de conservation des données

> **Nature du document.** Politique interne de l'éditeur, opposable et vérifiable. Elle fixe, pour
> chaque catégorie de données, une durée en base active, une durée d'archivage intermédiaire, et
> le sort final. Elle sert de spécification aux tâches de purge automatiques.
>
> **Avertissement.** Les durées légales citées doivent être confirmées par un juriste, en
> particulier sur le volet RH et le volet comptable. Elles reflètent l'état du droit français tel
> qu'établi dans le dossier `02-rgpd-conformite.md`.
>
> **Version : [1.0] — [JJ/MM/AAAA]**

---

## 1. Les trois états d'une donnée

| État | Définition | Accès |
|---|---|---|
| **Base active** | La donnée sert au quotidien | Utilisateurs habilités du client |
| **Archivage intermédiaire** | La donnée n'est plus utile au quotidien mais doit être conservée pour une obligation légale ou un contentieux possible | Accès restreint, sur justification, journalisé |
| **Suppression / anonymisation** | Fin de vie | Aucun |

Le passage en archivage n'est pas cosmétique : il suppose un accès réellement restreint. Dans
l'application, cela se traduit par un indicateur `archive_at` qui exclut la donnée des listes,
recherches et exports courants, et n'autorise sa lecture qu'aux rôles `proprietaire` et
`comptable`, avec journalisation systématique.

**L'anonymisation est préférable à la suppression** partout où une statistique doit survivre :
un chiffre d'affaires par ville reste exploitable sans le nom du client.

---

## 2. Tableau de conservation

### 2.1 Données des clients finaux

| Donnée | Base active | Archivage | Total | Fondement |
|---|---|---|---|---|
| Prospect sans suite (demande non convertie) | 3 ans après le dernier contact | — | 3 ans | Recommandation CNIL, prospection |
| Fiche client actif | Durée de la relation | 5 ans après la dernière intervention | ~ relation + 5 ans | Prescription civile, art. 2224 C. civ. |
| Intervention et rapport technique | 5 ans | 5 ans supplémentaires si garantie décennale engagée | 5 à 10 ans | Art. 2224 C. civ. ; art. 1792 C. civ. |
| **Facture et pièce comptable** | 3 ans | 7 ans | **10 ans** | Art. L123-22 C. com. |
| Devis accepté | Durée de la prestation | 5 ans | 5 ans | Contractuel |
| Devis refusé ou expiré | 1 an | — | 1 an | Minimisation |
| Photos de chantier — usage interne (preuve) | 5 ans | — | 5 ans | Intérêt légitime, aligné sur la prescription |
| **Photos publiées** (site, réseaux) | Jusqu'au retrait du consentement | — | Variable | Consentement, art. 6.1.a |
| Signature manuscrite numérisée | Durée de vie du document signé | Idem document | 5 à 10 ans | Valeur probante |
| SMS et e-mails transactionnels (contenu) | 1 an | — | 1 an | Minimisation |
| Preuve d'opposition / de désinscription | — | **3 ans** | 3 ans | Preuve du respect de l'opposition |

> **Attention au piège** : conserver la preuve qu'une personne s'est opposée est **nécessaire**,
> justement pour ne pas la recontacter. Cette liste-là ne se purge pas avec le reste.

### 2.2 Données RH (salariés du client artisan)

| Donnée | Durée | Fondement |
|---|---|---|
| Double du bulletin de paie conservé par l'employeur | **5 ans** | Art. L3243-4 C. trav. |
| Registre unique du personnel | 5 ans après le départ | Art. R1221-26 C. trav. |
| Contrat de travail, avenants, solde de tout compte | 5 ans après la fin du contrat | Art. L1471-1 C. trav. ; art. 2224 C. civ. |
| Charges sociales, justificatifs URSSAF | 3 ans | Art. L244-3 CSS |
| Comptage des horaires et heures supplémentaires | 1 an | Art. L3171-3 C. trav. |
| Déclarations d'accident du travail | 5 ans | Art. D4711-3 C. trav. |
| **Numéro de sécurité sociale (NIR)** | Durée du contrat, chiffré, cantonné à la paie et aux déclarations sociales | Art. 30 loi Informatique et Libertés ; décret 2019-341 |
| **Scan du permis de conduire** | **Ne pas conserver** le scan : garder la preuve de vérification (date, validité, catégories). Si conservé : suppression au départ | Minimisation, art. 5.1.c + doctrine CNIL |
| Attestation de mutuelle | Durée du contrat, suppression au départ sauf valeur probante | Minimisation |
| Candidature non retenue | 2 ans après le dernier contact | Recommandation CNIL |

> **Position produit à assumer** : l'application **n'est pas un coffre-fort numérique**. Elle ne
> s'engage donc pas sur les 50 ans de mise à disposition du bulletin électronique prévus par
> l'article D3243-8 du code du travail. Cette limite doit figurer explicitement dans le DPA et
> dans la documentation commerciale ; un client qui veut remettre les bulletins par voie
> électronique doit passer par un prestataire de coffre-fort dédié.

### 2.3 Données techniques et de la plateforme

| Donnée | Durée | Fondement |
|---|---|---|
| Journal de connexion (IP, ville, agent) | **6 mois** (12 mois maximum si un besoin de sécurité est documenté) | Recommandation CNIL, journaux d'accès |
| Journal d'accès aux données personnelles (traçabilité art. 32) | 12 mois | Sécurité |
| Journal applicatif d'erreurs | 90 jours | Exploitation |
| Sauvegardes complètes | 35 jours glissants | Continuité |
| Sauvegarde mensuelle de long terme | 12 mois | Continuité |
| Compte utilisateur désactivé | Suppression 6 mois après la désactivation | Minimisation |
| **Tenant résilié** | **Export remis, puis suppression complète à 30 jours**, sauf pièces sous obligation légale de 10 ans conservées en archivage chiffré | Contractuel (DPA) |
| Compte de démonstration | **14 jours**, purge automatique | Minimisation |

---

## 3. Résoudre le conflit effacement / obligation légale

C'est la question qui revient toujours. Une personne demande l'effacement, mais ses données
figurent sur une facture à conserver 10 ans.

**La règle** : l'article 17.3.b du RGPD écarte le droit à l'effacement lorsque le traitement est
nécessaire au respect d'une obligation légale. La facture reste donc en place. Mais cela ne vaut
**que** pour les données réellement nécessaires à cette obligation.

**En pratique, on découpe :**

| Donnée | Sort après demande d'effacement |
|---|---|
| Facture (identité, adresse de facturation, montant, date) | **Conservée** en archivage jusqu'à 10 ans, accès restreint |
| Fiche client, notes internes, historique commercial | **Supprimés** |
| Photos du chantier non publiées | **Supprimées** |
| Photos publiées | **Dépubliées et supprimées** sans délai |
| Numéro de téléphone et e-mail hors facture | **Supprimés** |
| Rapport technique | Conservé si garantie en cours, sinon supprimé |
| Inscription en liste d'opposition | **Créée** (pour ne plus jamais recontacter) |

La réponse à la personne doit expliquer ce découpage, pas se contenter d'un refus global. Un
refus global d'effacement au motif « on a une facture » est une non-conformité classique.

---

## 4. Mise en œuvre technique

Aucune de ces durées n'est aujourd'hui appliquée par le code : ni colonne d'archivage, ni tâche de
purge. Ce qu'il faut construire :

1. **Colonnes de cycle de vie** sur les tables concernées : `archive_at`, `purge_at`, `deleted_at`,
   calculées à l'écriture selon la présente politique.
2. **Une tâche quotidienne de purge**, par tenant, qui archive puis supprime, et **journalise ce
   qu'elle a fait** (le journal de purge est la preuve de conformité).
3. **Un mode simulation obligatoire** : la purge tourne d'abord en « ce que je supprimerais »
   pendant au moins un mois, avant toute suppression réelle. Une purge mal réglée est une perte de
   données irréversible pour tous les clients à la fois.
4. **Un rapport mensuel par tenant** : volumes archivés, supprimés, anonymisés — utile au client
   pour son propre registre.
5. **Un test automatisé** vérifiant qu'une donnée arrivée à échéance est bien traitée, et qu'une
   donnée sous obligation légale ne l'est **pas**.

## 5. Revue

Politique revue une fois par an, et à chaque ajout de traitement ou de catégorie de données. Toute
modification de durée est tracée ci-dessous et notifiée aux clients si elle les affecte.

| Version | Date | Modification |
|---|---|---|
| 1.0 | [JJ/MM/AAAA] | Version initiale |

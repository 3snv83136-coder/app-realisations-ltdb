# Politique de confidentialité de la plateforme [NOM DU SAAS]

> **AVERTISSEMENT — À FAIRE RELIRE PAR UN JURISTE.** Base de travail rédigée à partir de l'analyse technique de la plateforme. Ne constitue pas un conseil juridique. À relire, adapter et valider par un professionnel du droit avant publication. Compléter les champs `[…]`.

**Version** : 1.0 — projet
**Dernière mise à jour** : [JJ/MM/AAAA]
**Destinataires** : les utilisateurs de la plateforme (artisans abonnés, leurs techniciens et collaborateurs), ainsi que toute personne souhaitant comprendre comment nous traitons les données.

---

## 1. Qui sommes-nous et à quel titre agissons-nous

[RAISON SOCIALE], [forme juridique], immatriculée au RCS de [ville] sous le n° 484 791 546, siège social [adresse], édite et héberge la plateforme [NOM] (« la Plateforme »).

**Notre rôle varie selon les données concernées, et cette distinction est importante :**

**a) Nous sommes SOUS-TRAITANT** pour les données que vous saisissez dans la Plateforme au sujet de **vos** clients, de vos prospects et de vos salariés. Vous en êtes le **responsable de traitement** : c'est vous qui décidez pourquoi et comment ces données sont traitées. Nous ne les traitons que sur vos instructions, dans les conditions du contrat de sous-traitance (DPA) annexé à votre abonnement.

Concrètement : si l'un de vos clients souhaite exercer ses droits, **il doit s'adresser à vous**, pas à nous. Si une telle demande nous parvient, nous vous la transmettons sous 3 jours ouvrés sans y répondre nous-mêmes.

**b) Nous sommes RESPONSABLE DE TRAITEMENT** pour les données qui concernent **votre entreprise et vos utilisateurs en tant que clients de notre service** : votre compte, votre abonnement, notre facturation, notre support, la sécurité de la Plateforme et notre prospection commerciale. C'est l'objet de la présente politique.

**Contact protection des données** : [rgpd@…] — [adresse postale] — [téléphone]

---

## 2. Les traitements que nous mettons en œuvre en tant que responsable

| Finalité | Base légale | Données traitées | Conservation |
|---|---|---|---|
| Création et gestion de votre compte et de vos utilisateurs | Exécution du contrat (art. 6.1.b) | Raison sociale, SIREN/SIRET, nom et prénom du dirigeant et des utilisateurs, adresse électronique professionnelle, téléphone, identifiants, rôle | Durée du contrat + 3 ans |
| Gestion de l'abonnement, facturation, recouvrement | Exécution du contrat (6.1.b) et obligation légale (6.1.c) | Coordonnées, données de facturation, historique des paiements | Factures : 10 ans (art. L123-22 C. com.) |
| Assistance et support | Exécution du contrat (6.1.b) | Contenu de vos demandes, journaux techniques, captures que vous nous transmettez | 3 ans après la clôture du ticket |
| Sécurité de la Plateforme, prévention des abus, traçabilité des connexions | Intérêt légitime (6.1.f) et obligation de sécurité (art. 32) | Identifiant, rôle, adresse IP, ville, pays, agent utilisateur, horodatage des connexions | **6 mois** (12 mois en cas d'investigation de sécurité en cours) |
| Journalisation des accès aux données sensibles | Intérêt légitime (6.1.f) et art. 32 | Identité de l'utilisateur, action, entité consultée, horodatage | [12] mois |
| Amélioration de la Plateforme, mesures d'audience et statistiques d'usage | Intérêt légitime (6.1.f) | Données d'usage agrégées, sans contenu client | 25 mois |
| Prospection commerciale auprès des professionnels | Intérêt légitime (6.1.f) | Coordonnées professionnelles, historique des échanges | 3 ans après le dernier contact |
| Gestion des demandes d'exercice des droits | Obligation légale (6.1.c) | Identité du demandeur, objet et suite donnée | 3 ans (5 ans si contentieux) |

**Ce que nous ne faisons pas** : nous n'exploitons **jamais** les données de vos clients pour nos propres besoins. Nous ne les revendons pas, ne les utilisons pas à des fins de prospection, de statistiques commercialisables ni d'entraînement de modèles d'intelligence artificielle. Nous exerçons par ailleurs une activité artisanale : nos accès à vos données sont strictement limités aux cas d'assistance et d'incident, et intégralement journalisés — vous pouvez nous demander ce journal à tout moment.

---

## 3. Où sont hébergées les données

| Composant | Fournisseur | Localisation |
|---|---|---|
| Base de données et stockage de fichiers | Supabase | Union européenne — [Paris, eu-west-3] |
| Exécution applicative et diffusion | Vercel | Union européenne — [Paris, cdg1] |
| Sauvegardes | Supabase | Même région |

Nous privilégions systématiquement les fournisseurs et les régions situés dans l'Union européenne. Lorsque nous recourons à un prestataire susceptible d'accéder aux données depuis un pays tiers — pour son support ou son administration —, le transfert est encadré (voir §5).

---

## 4. Les fonctionnalités d'intelligence artificielle

La Plateforme utilise des modèles de langage pour transcrire les dictées vocales des techniciens, en extraire des informations structurées et rédiger les rapports d'intervention, les devis et les contenus de publication. Nous appliquons les règles suivantes :

- **Minimisation** : nous retirons ou remplaçons par des jetons les identifiants directs (nom, adresse précise, téléphone, adresse électronique) avant de transmettre un texte à un fournisseur de modèle. Ces éléments sont réinjectés localement dans le document final.
- **Pas d'entraînement** : nos contrats avec ces fournisseurs excluent l'utilisation des contenus transmis pour entraîner ou améliorer leurs modèles.
- **Rétention limitée** : les contenus transmis sont conservés au maximum [30] jours par le fournisseur à des fins de sécurité, ou ne sont pas conservés lorsque l'option de rétention nulle est activée.
- **Choix du fournisseur** : vous pouvez, dans les paramètres de votre espace, restreindre ces traitements à un fournisseur établi dans l'Union européenne, ou désactiver entièrement les fonctionnalités d'intelligence artificielle.
- **Pas de décision automatisée** : aucune de ces fonctionnalités ne produit de décision produisant des effets juridiques ou affectant significativement une personne au sens de l'article 22 du RGPD. Les contenus générés sont des propositions, revues et validées par un humain avant tout usage.

La liste des fournisseurs, leur pays d'établissement et le mécanisme d'encadrement des transferts figurent dans notre liste de sous-traitants ultérieurs.

**Transcription vocale** : l'enregistrement audio d'une dictée peut contenir des informations personnelles prononcées par le technicien. Nous ne pouvons pas les retirer avant transcription. Cet enregistrement n'est pas conservé par la Plateforme au-delà du traitement, et la transcription obtenue est purgée [12] mois après la validation du rapport.

---

## 5. Destinataires et sous-traitants ultérieurs

Vos données sont accessibles à notre personnel habilité, et sont traitées par des prestataires agissant pour notre compte : hébergement, exécution applicative, envoi d'emails et de SMS, fournisseurs de modèles de langage, publication sur les plateformes tierces que vous connectez, outils de facturation et de support.

La liste complète, tenue à jour, est publiée à l'adresse **[URL]**. Elle indique pour chacun : la finalité, la localisation du traitement et, pour les prestataires hors Union européenne, le mécanisme d'encadrement du transfert (décision d'adéquation, clauses contractuelles types adoptées par la Commission européenne).

Nous informons nos clients de tout ajout ou remplacement de prestataire **30 jours avant** sa mise en production, et un droit d'opposition est prévu au contrat.

Vos données peuvent également être communiquées aux autorités administratives ou judiciaires lorsque la loi l'exige. Nous vous en informons, sauf interdiction légale.

---

## 6. Sécurité

Nous mettons en œuvre les mesures suivantes : chiffrement des flux (TLS) et des données au repos ; cloisonnement logique strict entre les espaces des différents clients, vérifié par des tests automatisés à chaque livraison ; authentification à double facteur pour les rôles sensibles ; habilitations par rôle et principe du moindre privilège ; journalisation des connexions et des accès aux données sensibles ; sauvegardes chiffrées quotidiennes avec restauration à un instant donné et test de restauration semestriel ; supervision et procédure de gestion des incidents.

Le détail figure à l'annexe 2 du contrat de sous-traitance.

En cas de violation de données vous concernant, nous vous en informons dans les meilleurs délais et au plus tard **24 heures** après en avoir pris connaissance, avec les éléments vous permettant, le cas échéant, de procéder à votre propre notification à la CNIL.

---

## 7. Vos droits

Vous disposez des droits suivants sur les données que nous traitons en tant que responsable : **accès**, **rectification**, **effacement**, **limitation**, **opposition** (notamment à la prospection, à tout moment et sans motif), **portabilité**, et le droit de définir des directives relatives au sort de vos données après votre décès.

**Pour les exercer** : écrivez à [rgpd@…] ou à [adresse postale], en précisant l'objet de votre demande. Nous pouvons vous demander un justificatif d'identité en cas de doute raisonnable. Nous répondons dans un délai d'**un mois**, prolongeable de deux mois pour les demandes complexes, auquel cas nous vous en informons.

**Limite** : nous ne pouvons pas donner suite à une demande portant sur les données de **vos** clients ou salariés, dont vous êtes le responsable de traitement. Ces demandes doivent vous être adressées ; la Plateforme met à votre disposition les fonctionnalités pour y répondre.

**Réclamation** : vous pouvez introduire une réclamation auprès de la CNIL — 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 — ou sur www.cnil.fr.

---

## 8. Cookies et traceurs

La Plateforme utilise uniquement les traceurs **strictement nécessaires** à son fonctionnement, exemptés de consentement au titre de l'article 82 de la loi Informatique et Libertés :

| Traceur | Finalité | Durée |
|---|---|---|
| Cookie de session d'authentification | Vous maintenir connecté | [12 h / 7 jours] |
| Jeton anti-CSRF | Protéger contre la falsification de requêtes | Session |
| Préférences d'affichage | Mémoriser vos choix d'interface | 6 mois |

Nous n'utilisons **aucun cookie publicitaire ni de mesure d'audience tierce** dans l'application. [Si une mesure d'audience est ajoutée : la décrire, et prévoir soit une configuration exemptée de consentement conforme aux recommandations de la CNIL, soit une bannière de consentement.]

Le site vitrine [URL du site commercial] fait l'objet d'une politique de cookies distincte.

---

## 9. Modifications

Nous pouvons faire évoluer la présente politique. Toute modification substantielle est notifiée par courrier électronique et dans l'application, avec un préavis de 30 jours. La version en vigueur est toujours accessible à l'adresse [URL], avec sa date de mise à jour et son numéro de version.

**Historique des versions**

| Version | Date | Modifications |
|---|---|---|
| 1.0 | [date] | Version initiale |

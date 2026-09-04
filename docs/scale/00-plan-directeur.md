# Plan directeur — passage d'un logiciel mono-client à un produit multi-clients

**Document d'entrée du dossier.** Il fixe les décisions prises, l'ordre des chantiers et les
points de non-retour. Les quatre rapports détaillés et les six documents juridiques sont
référencés au §7.

---

## 1. Les quatre décisions prises

| Sujet | Décision | Conséquence directe |
|---|---|---|
| **Isolation des données** | Base unique, colonne `tenant_id`, isolation par RLS PostgreSQL | Une migration, un déploiement, tous les clients en bénéficient. En contrepartie, une erreur d'isolation touche tout le monde : les tests d'isolation deviennent non négociables |
| **Accès** | Un seul déploiement, un sous-domaine par client | Mise à jour instantanée pour tous. Le sous-domaine détermine l'organisation, avant toute requête |
| **Volume visé** | 10 à 50 clients sous 12-18 mois | Impose l'onboarding en libre-service, la supervision par client, et une préproduction réelle |
| **Existant** | Les Techniciens du Débouchage devient le client n°1 | Tu testes le produit sur ton propre métier, en conditions réelles. La migration de tes données existantes fait partie du chantier |

Ces quatre choix sont cohérents entre eux et correspondent à ce que recommande l'analyse
d'architecture. Le reste du dossier en découle.

---

## 2. Le constat qui commande l'ordre des travaux

Le produit ne peut pas être dupliqué en l'état, pour une raison simple : **l'application n'a pas
de notion d'utilisateur**. Les comptes sont des variables d'environnement Vercel
(`lib/auth-users.ts`), les administrateurs se connectent **sans mot de passe**, et aucun
utilisateur ne porte d'appartenance à une entreprise. Ajouter un client, aujourd'hui, ce serait
redéployer l'application.

Il en découle un ordre non négociable :

```
1. Réparer          →  2. Refonder l'identité  →  3. Cloisonner  →  4. Industrialiser  →  5. Vendre
   (failles)            (utilisateurs en base)     (tenant + RLS)   (tests + agents)      (RGPD + contrats)
```

**Ne pas inverser 1 et 3.** Dupliquer une application dont l'administrateur n'a pas de mot de
passe, c'est multiplier la faille par le nombre de clients — et transformer un incident isolé en
violation de données concernant plusieurs entreprises.

---

## 3. La séquence, phase par phase

### Phase 0 — Colmater (cette semaine)

Objectif : que l'application existante cesse d'être exposée. Aucun de ces points ne dépend du
multi-clients, tous sont détaillés dans `SECURITY_AUDIT_REPORT.md`.

1. Mot de passe obligatoire sur les comptes administrateurs.
2. Retrait du fichier de données personnelles dans `public/recup/` (dépôt **et** historique git).
3. Fermeture de l'accès des comptes démo à la paie et à la comptabilité.
4. Contrôle de propriété sur la suppression d'intervention.
5. Les quatre vérifications hors-code du §6.

### Phase 1 — Refonder l'identité (2 à 3 semaines)

Le cœur du chantier, et son point de non-retour.

- Bascule de NextAuth vers **Supabase Auth** : utilisateurs en base, rattachés à une organisation.
- Le jeton d'authentification porte `tenant_id`, `role` et `technicien_id`, lus directement par
  les politiques RLS de PostgreSQL.
- Mots de passe, réinitialisation, invitations, double authentification, révocation immédiate :
  tout cela devient du standard, plus du code maison.
- Rôles réels : propriétaire, administrateur, comptable, technicien, lecture seule — à la place
  des listes de préfixes d'URL actuelles.
- Les comptes de démonstration deviennent des **organisations éphémères** (14 jours), et non plus
  des administrateurs déguisés.

> C'est la phase la plus risquée : elle touche les 138 routes. Elle doit être faite **avant** le
> multi-tenant, jamais en même temps.

### Phase 2 — Cloisonner (3 à 4 semaines)

- Table `organisations`, colonne `tenant_id` sur chaque table, **clés étrangères composites**
  `(tenant_id, id)` — sans quoi une facture d'un client peut pointer vers l'intervention d'un
  autre.
- Activation de la RLS avec `force row level security`, policies en lecture **et** en écriture.
- Abandon de `service_role` comme client applicatif : un point d'entrée unique (`lib/db.ts`), et
  `service_role` réservé aux migrations, au provisioning et aux tâches système.
- Sortie de l'identité d'entreprise hors du code : nom, SIRET, TVA, logo, couleurs, téléphone,
  mentions légales, **tarifs**, catalogue de prestations, zones géographiques, modèles d'e-mail
  et de SMS — tout en base, par organisation.
- Numérotation des factures par organisation, sans trou ni doublon, et **suppression du repli
  non transactionnel** de `lib/numero.ts`.
- Cloisonnement du stockage : buckets privés, chemins préfixés par organisation, URL signées.
- Migration des données existantes vers l'organisation n°1.

### Phase 3 — Industrialiser (en parallèle dès la phase 1)

- Suite de tests, dont la **suite d'isolation** : deux organisations fictives, et la vérification
  systématique qu'aucune route ne laisse fuir l'une vers l'autre.
- Test qui parcourt les 138 routes et échoue si l'une d'elles n'appelle pas le garde-fou.
- Intégration continue GitHub Actions, préproduction, déploiement progressif, retour arrière.
- La flotte de 8 agents (§5).

### Phase 4 — Vendre (avant le premier client payant)

- Signature des contrats de sous-traitance avec les fournisseurs, publication de la liste des
  sous-traitants, DPA proposé aux clients.
- Bascule de l'hébergement en région européenne.
- Mise en œuvre des durées de conservation et des droits des personnes.
- Onboarding d'un client en moins d'une heure, sans intervention manuelle sur le code.

---

## 4. Ce qui coûte, et où ça dérape

| Clients | Coût mensuel estimé | Par client |
|---|---|---|
| 1 | ~75 $ | 75 $ |
| 10 | ~440 $ | 44 $ |
| 50 | ~1 470 $ | 29 $ |
| 200 | ~4 975 $ | 25 $ |

Le poste qui explose en premier n'est pas l'hébergement, c'est **l'intelligence artificielle**
(environ 2 300 $ à 200 clients), devant les SMS. Trois leviers : router les tâches simples vers
un modèle plus léger, mettre en cache les portions de prompt réutilisées, et plafonner par
organisation.

Un piège discret : le rendu vidéo Remotion (3 Go de mémoire, 300 secondes) passe de 2 $ à 400 $
entre 1 et 200 clients. À sortir de l'hébergement applicatif vers 50 clients.

**Recommandation d'hébergement** : rester sur Vercel + Supabase jusqu'à 200 clients, à deux
conditions — région européenne configurée et contrats de sous-traitance signés. N'envisager une
bascule vers un hébergeur français que si un client exige une certification particulière, ou si
la facture dépasse 30 % du revenu récurrent.

---

## 5. La flotte d'agents

Huit agents spécialisés, définis dans `docs/scale/agents/`, prêts à être copiés dans
`.claude/agents/` :

| Agent | Rôle |
|---|---|
| **Chef qualité** | Décide quels spécialistes réveiller selon la nature du changement |
| **Gardien multi-tenant** | Toute requête base doit être cloisonnée à une organisation |
| **Auditeur sécurité** | Routes, autorisations, secrets, uploads |
| **Gardien RGPD** | Repère toute nouvelle donnée personnelle, vérifie durée et journalisation |
| **Réviseur migrations** | Relit tout SQL avant fusion : réversibilité, impact multi-clients |
| **Contrôleur tests** | Vérifie que le nouveau code est couvert |
| **Veilleur performance** | Requêtes en cascade, index manquants, poids des pages |
| **Scribe cohérence** | La documentation et les types suivent le code |

**Un point à ne pas confondre**, et c'est le plus important de ce volet : les agents relèvent du
**jugement**, les tests de la **vérité**. Un agent qui approuve ne remplace jamais un test qui
échoue. On ne fusionne pas sur l'avis d'un agent seul — la chaîne d'intégration continue reste
l'autorité. Les agents servent à attraper ce qu'un test ne sait pas formuler : une donnée
personnelle introduite sans durée de conservation, une requête oubliée sans cloisonnement, une
migration non réversible.

---

## 6. À vérifier cette semaine — hors code

Quatre points ne se lisent pas dans le dépôt et conditionnent la gravité de plusieurs constats :

1. **Visibilité des buckets Supabase** (Storage → visibilité). Si `interventions-photos` est
   public, les permis de conduire et attestations de mutuelle des salariés y sont exposés par
   défaut — il s'agirait alors d'une violation de données en cours, à traiter selon la procédure
   `juridique/05-procedure-violation-donnees.md`.
2. **Région d'exécution Vercel.** `vercel.json` ne contient aucune clé `regions` : sans
   configuration explicite, les traitements — photos de domiciles, factures, bulletins de paie —
   s'exécutent sur des serveurs américains. À basculer sur `cdg1`.
3. **Présence de `CRON_SECRET`** dans les variables Vercel. Sans lui, les quatre tâches planifiées
   sont ouvertes.
4. **Le jeton de publication** présent dans `.env.local.example` : est-ce le secret de production ?
   Si oui, à révoquer immédiatement.

---

## 7. Index du dossier

| Document | Contenu |
|---|---|
| [`01-architecture-multitenant.md`](01-architecture-multitenant.md) | Obstacles dans le code, schéma cible, SQL et policies RLS, numérotation, plan de migration, onboarding |
| [`02-rgpd-conformite.md`](02-rgpd-conformite.md) | Qualification sous-traitant, registre des traitements, non-conformités relevées dans le code, droits des personnes, hébergement et transferts |
| [`03-infrastructure-securite.md`](03-infrastructure-securite.md) | Authentification, autorisations, secrets, sauvegardes et restauration ciblée, observabilité, coûts, choix d'hébergement |
| [`04-agents-qualite-cicd.md`](04-agents-qualite-cicd.md) | Pyramide de tests, tests d'isolation, intégration continue, stratégie de migration, flotte d'agents, plan en 4 paliers |
| [`agents/`](agents/) | Les 8 définitions d'agents, prêtes à l'emploi |
| [`juridique/`](juridique/) | DPA, politique de confidentialité de l'application, modèle pour les artisans, liste des sous-traitants, procédure de violation, politique de conservation |
| [`../../SECURITY_AUDIT_REPORT.md`](../../SECURITY_AUDIT_REPORT.md) | Audit de sécurité de l'application actuelle |

---

## 8. Réserves

- Les documents juridiques sont une **base de travail solide, pas un conseil juridique**. Ils
  doivent être relus par un juriste avant tout usage commercial. Les durées de conservation RH et
  comptables, en particulier, engagent ta responsabilité.
- Les estimations de coûts sont des ordres de grandeur, à confirmer sur les grilles tarifaires en
  vigueur au moment de l'engagement.
- Rien de ce dossier n'a été appliqué au code : c'est un plan, pas une livraison.

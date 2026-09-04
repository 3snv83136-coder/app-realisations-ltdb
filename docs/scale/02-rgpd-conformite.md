# Dossier de conformité RGPD — passage du CRM LTDB en produit SaaS multi-clients

> **AVERTISSEMENT.** Ce dossier est une **base de travail technique et juridique**, rédigée à partir d'une lecture directe du code du dépôt `app-realisations-ltdb`. Il n'est **pas un conseil juridique** et ne dispense pas d'une relecture par un avocat ou un juriste spécialisé en données personnelles **avant toute commercialisation**. Les modèles contractuels du chapitre 6 doivent en particulier être relus, adaptés et datés avant signature.

| | |
|---|---|
| **Éditeur / hébergeur du service** | MONDOR — Les Techniciens du Débouchage (SIREN 484791546) |
| **Produit** | CRM métier artisans (interventions, devis/factures, RH, publication SEO) |
| **Modèle cible** | SaaS mutualisé, base de données unique partagée entre tous les clients |
| **Date d'analyse** | 4 septembre 2026 |
| **Périmètre** | `app/`, `lib/`, `components/`, `supabase/schema.sql`, `supabase/migrations/001` à `035`, `middleware.ts`, `vercel.json`, `next.config.mjs`, `package.json` |
| **Document connexe** | `SECURITY_AUDIT_REPORT.md` (audit sécurité applicatif — les failles y sont détaillées techniquement, ce dossier en tire les conséquences RGPD) |

---

## Sommaire

1. [Qualification juridique — le basculement responsable de traitement → sous-traitant](#1-qualification-juridique)
2. [Registre des traitements](#2-registre-des-traitements)
3. [Points de non-conformité critiques identifiés dans le code](#3-points-de-non-conformité-critiques-identifiés-dans-le-code)
4. [Droits des personnes — conception technique en multi-tenant](#4-droits-des-personnes--conception-technique-en-multi-tenant)
5. [Documents contractuels à produire](#5-documents-contractuels-à-produire)
6. [Mesures techniques exigibles (art. 32)](#6-mesures-techniques-exigibles-art-32)
7. [Hébergement, souveraineté et transferts hors UE](#7-hébergement-souveraineté-et-transferts-hors-ue)
8. [Plan d'action priorisé](#8-plan-daction-priorisé)

### Documents contractuels (fichiers séparés)

| Document | Chemin |
|---|---|
| DPA / contrat de sous-traitance art. 28 | [`docs/scale/juridique/01-dpa-sous-traitance-art28.md`](juridique/01-dpa-sous-traitance-art28.md) |
| Politique de confidentialité de l'application | [`docs/scale/juridique/02-politique-confidentialite-application.md`](juridique/02-politique-confidentialite-application.md) |
| Politique de confidentialité type (artisan → clients finaux) | [`docs/scale/juridique/03-politique-confidentialite-type-artisan.md`](juridique/03-politique-confidentialite-type-artisan.md) |
| Liste publique des sous-traitants ultérieurs | [`docs/scale/juridique/04-sous-traitants-ulterieurs.md`](juridique/04-sous-traitants-ulterieurs.md) |
| Procédure de violation de données (72 h) | [`docs/scale/juridique/05-procedure-violation-donnees.md`](juridique/05-procedure-violation-donnees.md) |
| Politique de conservation des données | [`docs/scale/juridique/06-politique-conservation.md`](juridique/06-politique-conservation.md) |

---

## 1. Qualification juridique

### 1.1 La situation d'aujourd'hui

Aujourd'hui, l'application sert **une seule entreprise** : LTDB. MONDOR décide seul des finalités (gérer ses interventions, facturer, relancer, publier son SEO) et des moyens (Next.js, Supabase, Anthropic, Resend…). Il est **responsable de traitement** au sens de l'article 4.7 du RGPD, pour :

- ses clients finaux (particuliers et syndics du Var),
- ses salariés (module RH),
- ses techniciens,
- ses prospects.

Vercel, Supabase, Resend, Brevo, Anthropic, OpenAI, Google, Meta, TikTok sont ses **sous-traitants** (art. 4.8). Il n'y a qu'un seul niveau de chaîne.

### 1.2 Ce qui change le jour où le logiciel est vendu

Le jour où un plombier de Draguignan s'abonne et saisit **ses** clients dans l'application, la qualification bascule :

| Rôle | Qui | Sur quelles données |
|---|---|---|
| **Responsable de traitement** | L'artisan abonné (le plombier, l'électricien, le serrurier…) | Ses clients finaux, ses salariés, ses prospects, ses interventions |
| **Sous-traitant (art. 28)** | MONDOR / LTDB, éditeur-hébergeur | Les mêmes données, traitées **pour le compte** de l'artisan |
| **Sous-traitants ultérieurs (art. 28.2 et 28.4)** | Vercel, Supabase, Anthropic, OpenAI, Mistral, Resend, Brevo, Twilio, Google, Meta, TikTok | Les mêmes données, en cascade |

Le critère n'est pas qui possède le serveur, c'est **qui décide de la finalité**. L'artisan décide qu'il veut facturer M. Dupont et lui envoyer une relance : c'est lui le responsable. MONDOR fournit l'outil et l'exécute : il est sous-traitant. Le fait que la base de données soit unique et hébergée par MONDOR ne change rien à cette qualification — cela ne change que le **niveau d'exigence sécurité** (voir §6.8, cloisonnement).

### 1.3 Ce que « devenir sous-traitant » implique concrètement pour MONDOR

Obligations directes, opposables par la CNIL **au sous-traitant lui-même** (art. 28, 30.2, 32, 33.2, 82.2) :

**a) Ne traiter que sur instruction documentée du client (art. 28.3.a).**
Interdiction absolue d'utiliser les données des clients d'un artisan pour une finalité propre à MONDOR. Trois pièges concrets déjà présents dans le code :

- `app/api/generate/route.ts:30` — `const SITE = 'https://lestechniciensdudebouchage.fr'` est **codé en dur**, de même que `LTDB_API_URL` / `LTDB_PUBLISH_TOKEN` (`.env.local.example:26-27`) et les coordonnées GPS de LTDB dans le JSON-LD (`lib/publish-jsonld.ts:68-69`, `app/api/generate/route.ts:440-441`). En l'état, publier la réalisation d'un client de l'électricien de Fréjus enverrait ses photos et sa ville sur **le site de LTDB**. Ce serait un traitement pour la finalité propre de MONDOR : requalification en **responsable de traitement** par l'article 28.10, et violation caractérisée.
- Toute statistique agrégée « inter-clients » (benchmark de prix, volumétrie du marché) revendue ou publiée est une finalité propre → nécessite une base légale distincte et un contrat qui l'autorise expressément, sinon art. 28.10.
- Tout usage des données clients pour entraîner un modèle, améliorer un prompt ou constituer un jeu de test : même analyse.

**b) Confidentialité des personnes autorisées (art. 28.3.b).** Engagement de confidentialité écrit pour MONDOR lui-même et pour tout futur salarié, stagiaire ou prestataire ayant accès à la production.

**c) Sécurité (art. 28.3.c → art. 32).** Voir §6. Le sous-traitant est directement sanctionnable sur ce fondement, indépendamment du client.

**d) Sous-traitance ultérieure (art. 28.2 et 28.4).** Deux régimes possibles ; retenir l'**autorisation générale écrite** avec information préalable et droit d'opposition (délai de 30 jours), c'est le seul praticable pour un SaaS. Conséquences opérationnelles :
- tenir une **liste publique et versionnée** des sous-traitants ultérieurs (document `04-sous-traitants-ulterieurs.md`) ;
- notifier tout ajout/remplacement **avant** la mise en production ;
- imposer contractuellement à chaque sous-traitant ultérieur **les mêmes obligations** que celles souscrites envers l'artisan (art. 28.4) → signer/accepter les DPA de Vercel, Supabase, Anthropic, OpenAI, Resend, Brevo, Google, Meta, TikTok, et les archiver ;
- **MONDOR reste pleinement responsable** devant l'artisan des manquements de ces sous-traitants (art. 28.4, dernière phrase). Si Anthropic ou Supabase fuite, c'est MONDOR qui répond devant son client.

**e) Assistance au responsable (art. 28.3.e et 28.3.f).** Fournir les moyens techniques permettant à l'artisan de répondre aux demandes d'exercice de droits (§4), de notifier une violation, de réaliser une AIPD, de consulter la CNIL.

**f) Sort des données en fin de contrat (art. 28.3.g).** Au choix du client : restitution (export complet) puis suppression, ou suppression pure. Délai contractuel recommandé : export disponible 30 jours, suppression définitive à 60 jours, y compris les sauvegardes (par expiration des cycles de rétention). **Rien de tel n'existe aujourd'hui** : il n'y a ni notion de compte client, ni `deleted_at`, ni procédure de sortie.

**g) Audit (art. 28.3.h).** Se tenir à disposition pour les audits du client, ou fournir un rapport d'audit / questionnaire sécurité standardisé (recommandé : une fiche sécurité annuelle, pour éviter les audits sur site).

**h) Registre du sous-traitant (art. 30.2).** MONDOR doit tenir **son propre registre**, distinct de celui de ses clients : catégories de traitements effectués pour le compte de chaque client, transferts hors UE, description des mesures de sécurité. C'est ce que fournit le §2, colonne « rôle ».

**i) Notification des violations au client (art. 33.2).** Sans délai injustifié, dès la prise de connaissance — pas 72 h : les 72 h sont le délai du **responsable** vers la CNIL, et il court à partir de la notification par le sous-traitant. En pratique : **24 h contractuelles** (voir `05-procedure-violation-donnees.md`).

**j) Responsabilité et sanctions.** Le sous-traitant est solidairement responsable du dommage (art. 82.4) et directement passible d'amendes administratives (art. 83.4, jusqu'à 10 M€ ou 2 % du CA pour les manquements aux art. 28 et 32).

### 1.4 Les traitements pour lesquels MONDOR reste responsable de traitement

Ce sont ceux où il décide lui-même de la finalité :

| Traitement | Personnes concernées | Base légale |
|---|---|---|
| Gestion des comptes et des abonnements SaaS | Artisans clients, leurs utilisateurs nommés | Contrat (art. 6.1.b) |
| Facturation de l'abonnement, comptabilité de MONDOR | Artisans clients | Obligation légale (art. 6.1.c) + contrat |
| Prospection commerciale du SaaS, gestion des leads | Prospects artisans (B2B) | Intérêt légitime (art. 6.1.f), avec opposition facile |
| Support client, tickets, logs applicatifs d'exploitation | Utilisateurs des artisans | Intérêt légitime (art. 6.1.f) — attention : dès que le support ouvre un dossier client, il redevient sous-traitant |
| Sécurité de la plateforme : `connexions_log` (migration 025), détection d'abus | Utilisateurs des artisans | Intérêt légitime (art. 6.1.f) / obligation de sécurité (art. 32) |
| Le site vitrine `lestechniciensdudebouchage.fr`, ses formulaires, ses cookies | Visiteurs, prospects LTDB | Consentement / intérêt légitime |
| **L'activité historique de plomberie de LTDB** | Clients finaux LTDB, salariés LTDB | Contrat, obligation légale |

**Point d'attention majeur** : LTDB sera à la fois **client de sa propre plateforme** (responsable) et **éditeur** (sous-traitant des autres). Ces deux casquettes doivent être séparées : un compte tenant `LTDB` comme les autres, aucun accès privilégié aux données des concurrents depuis l'interface applicative, et une traçabilité de tout accès administrateur aux données d'un tenant tiers (§6.3). C'est ce qui sera regardé en premier en cas de contrôle, parce que MONDOR vendra à des **concurrents directs** (plombiers du Var).

### 1.5 Formalités et gouvernance

- **DPO** : non obligatoire *a priori* (art. 37 — pas d'autorité publique, pas de suivi systématique à grande échelle, pas d'art. 9 à grande échelle). Désigner néanmoins un **référent RGPD** nommé au contrat, avec une adresse dédiée (`dpo@` ou `rgpd@`).
- **AIPD / DPIA (art. 35)** : **à considérer comme obligatoire** pour la plateforme SaaS. Plusieurs critères des lignes directrices EDPB WP248 sont réunis simultanément : traitement à grande échelle, données hautement personnelles (images de l'intérieur du domicile, données RH, NIR), usage innovant (IA générative), croisement de jeux de données, données de personnes vulnérables (salariés). Rédiger l'AIPD **avant** la première vente ; elle sert aussi de pièce commerciale.
- **Registre** : deux registres à maintenir — celui de responsable (§1.4) et celui de sous-traitant (art. 30.2).
- **Représentant UE** : sans objet (MONDOR est établi en France).

---

## 2. Registre des traitements

Colonne **rôle** : `RT` = MONDOR responsable de traitement ; `ST` = MONDOR sous-traitant pour le compte de l'artisan abonné (dans ce cas la base légale indiquée est celle que **l'artisan** devra retenir).

### T01 — Gestion des interventions (planification, terrain, rapport)

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Planifier, exécuter et documenter les interventions à domicile : prise de RDV, affectation technicien, dictée vocale, photos avant/après, vidéos, rapport technique, attestation de conformité |
| **Base légale (art. 6)** | Exécution du contrat / mesures précontractuelles (6.1.b) pour le client ; intérêt légitime (6.1.f) pour les notes internes et l'organisation |
| **Personnes concernées** | Clients finaux (particuliers, syndics, bailleurs), occupants du logement, techniciens |
| **Catégories de données** | Identité (nom, prénom), coordonnées (email, téléphone), adresse du domicile / du chantier, `type_intervention`, `date_prevue`, `urgence`, `notes_internes`, `transcription` (dictée brute, contient souvent le nom et l'adresse), `rapport_json`, `photos_urls`, `photos_legendes`, `video_uploads`, `canal_acquisition`. Tables `clients`, `interventions` (`supabase/schema.sql:12-100`), buckets `interventions-photos` / `intervention-videos` |
| **Destinataires** | Artisan et ses techniciens habilités ; MONDOR (exploitation) ; Supabase (hébergement DB + Storage) ; Vercel (calcul) ; Anthropic ou Mistral (génération du rapport) ; OpenAI (transcription) ; Nominatim/OpenStreetMap (géocodage de l'adresse, `app/api/static-map/route.ts:9`) ; Google (liens d'itinéraire ouverts par les techniciens) |
| **Transferts hors UE** | **Oui, actuellement** : Anthropic (US), OpenAI (US), Vercel (fonctions en région US par défaut — `vercel.json` ne fixe aucune `regions`). Voir §7 |
| **Conservation** | Base active : durée de la relation contractuelle + 3 ans après la dernière intervention. Puis archivage intermédiaire des seules pièces à valeur probante (voir T03). Photos/vidéos du domicile : 1 an après l'intervention sauf litige, 5 ans si support de garantie |
| **Mesures de sécurité** | HTTPS/TLS 1.2+ ; chiffrement au repos Supabase (AES-256) ; auth NextAuth + `middleware.ts` ; RLS **désactivée** sur `clients`/`interventions` (`supabase/schema.sql:183-187`) ; buckets Storage **présumés publics** ; **aucun cloisonnement multi-tenant** → voir §3 et §6 |

### T02 — Devis, accords d'intervention et signature électronique

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Établir un devis, recueillir l'accord préalable du client sur le terrain, conserver la preuve du consentement aux travaux (demande expresse, renonciation au délai de rétractation pour travaux urgents) |
| **Base légale** | Contrat / mesures précontractuelles (6.1.b) ; obligation légale (6.1.c) pour les mentions du Code de la consommation |
| **Personnes concernées** | Clients finaux signataires |
| **Catégories de données** | Identité et coordonnées gelées à la signature, adresse, montants, **image de la signature manuscrite** (`signature_image`), **adresse IP du client** (`ip_client`), **user-agent** (`user_agent`), horodatage `valide_at`, consentements booléens. Table `accords_intervention` (`supabase/migrations/005_accord_intervention.sql:73-127`), table `lignes_devis` |
| **Destinataires** | Artisan, MONDOR, Supabase, Vercel, Resend (envoi du PDF) |
| **Transferts hors UE** | Vercel (région à corriger) ; Resend (US) |
| **Conservation** | 10 ans à compter de la conclusion pour les contrats conclus par voie électronique d'un montant ≥ 120 € (art. L213-1 C. consommation) ; 5 ans sinon (art. 2224 C. civil). IP et user-agent : **13 mois maximum**, leur seule utilité est la preuve de la signature à court terme — les purger ensuite en conservant l'horodatage |
| **Mesures de sécurité** | HMAC-SHA256 sur les liens publics ; RLS activée sur `accords_intervention` et `lignes_devis` (migration 032) ; signature stockée dans un bucket **à rendre privé** |

### T03 — Facturation client et comptabilité

| | |
|---|---|
| **Rôle MONDOR** | ST (comptabilité de l'artisan) — RT pour sa propre facturation d'abonnement |
| **Finalité** | Émettre factures et avoirs, suivre les encaissements, rapprochement bancaire, pré-bilan, export FEC |
| **Base légale** | Obligation légale (6.1.c) — Code de commerce, CGI ; exécution du contrat (6.1.b) |
| **Personnes concernées** | Clients finaux, fournisseurs (personnes physiques), tiers apparaissant sur les relevés bancaires |
| **Catégories de données** | Identité, adresse de facturation et adresse de chantier, montants HT/TTC/TVA, mode de paiement, échéance, statut de paiement, `payload` complet de la facture, PDF, **libellés d'opérations bancaires** et relevés importés (tables `documents`, `factures_fournisseurs`, `operations_bancaires`, `releves_bancaires`, migrations 001 et 010) |
| **Destinataires** | Artisan, son expert-comptable, MONDOR, Supabase, Vercel, Resend |
| **Transferts hors UE** | Vercel, Resend |
| **Conservation** | **10 ans** à compter de la clôture de l'exercice pour les livres, registres et pièces justificatives (art. L123-22 C. com.) ; 6 ans au titre du contrôle fiscal (art. L102 B LPF). Ces données doivent passer en **archivage intermédiaire à accès restreint**, pas rester dans la base active |
| **Mesures de sécurité** | Auth applicative ; **RLS désactivée** sur `documents` et `factures_fournisseurs` ; PDF dans un bucket `intervention-pdfs` à visibilité à confirmer |

### T04 — Relances de paiement (email + SMS)

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Relancer une facture impayée, un devis sans réponse, un devis de travaux complémentaires |
| **Base légale** | Exécution du contrat (6.1.b) — ce n'est **pas** de la prospection : c'est le recouvrement d'une créance née d'un contrat. Aucun consentement requis, mais information obligatoire |
| **Personnes concernées** | Clients finaux débiteurs |
| **Catégories de données** | Identité, email, téléphone, montant dû, référence, historique des relances (`relances_planifiees`, migration 033 ; `relances_control`, migration 018) |
| **Destinataires** | Resend (email), Brevo (SMS, France), Twilio (SMS, repli US) |
| **Transferts hors UE** | Resend (US) ; Twilio (US) si repli actif ; Brevo = France, à privilégier |
| **Conservation** | Historique des envois : 1 an. Données de la créance : cf. T03 |
| **Mesures de sécurité** | Liens de désinscription signés HMAC-SHA256 avec expiration (`lib/facture-relance.ts:260`, `app/api/facture/stop-reminders/route.ts`) — mécanisme correct |

### T05 — Sollicitation d'avis Google (SMS et email post-intervention)

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Inviter le client à déposer un avis sur la fiche Google Business de l'artisan, avec un plan de relances J+2 / J+7 (`lib/avis-relance.ts`, `supabase/migrations/021_avis_sms_plan.sql`, cron `/api/cron/avis-sms-relances`) |
| **Base légale** | **Prospection directe** au sens de l'art. L34-5 CPCE. Vers un **client existant**, l'exception « produits ou services analogues » s'applique : intérêt légitime (6.1.f) est soutenable **à condition** que les coordonnées aient été recueillies lors de la vente, que le message concerne le même service, et que l'opposition soit possible **au moment du recueil et dans chaque message**. Vers un non-client : consentement préalable (6.1.a) obligatoire |
| **Personnes concernées** | Clients finaux ayant reçu une intervention |
| **Catégories de données** | Nom, téléphone mobile, email, référence d'intervention, ville, historique des relances |
| **Destinataires** | Brevo (SMS), Resend (email), Google (le client atterrit sur la fiche) |
| **Transferts hors UE** | Resend (US) ; Google (Google Ireland, transferts encadrés) |
| **Conservation** | 3 ans après le dernier contact pour la donnée de prospection ; plan de relances purgé à l'issue |
| **Mesures de sécurité** | Email : lien STOP signé présent (`lib/avis-relance.ts:29-41`). **SMS : aucun mécanisme STOP dans le texte** (`lib/review-url.ts:25-38`) → non-conformité, voir §3.5 |

### T06 — Publication SEO des réalisations sur un site public

| | |
|---|---|
| **Rôle MONDOR** | ST (et RT pour le site LTDB tant que la cible est codée en dur) |
| **Finalité** | Publier une page « réalisation » sur le site vitrine : photos avant/après du chantier, ville, code postal, type d'intervention, récit de l'intervention, FAQ générée, JSON-LD, photo et prénom du technicien ; puis diffusion sur Google Business Profile, YouTube, Facebook, Instagram, TikTok |
| **Base légale** | **Consentement (art. 6.1.a)** — voir la démonstration en §3.2. L'intérêt légitime n'est pas soutenable pour des images de l'intérieur d'un domicile |
| **Personnes concernées** | Clients finaux occupants, techniciens (image et prénom publiés) |
| **Catégories de données** | Photos et vidéos de l'intérieur du logement, ville + code postal, date, nature du problème sanitaire, texte du rapport reformulé, photo du technicien, `publie_slug` |
| **Destinataires** | **Le public**, via le site (`LTDB_API_URL`), Google, Meta, TikTok, YouTube |
| **Transferts hors UE** | Oui, massivement et de façon peu maîtrisable une fois publié (Meta, TikTok, Google) |
| **Conservation** | Tant que le consentement n'est pas retiré ; retrait = dépublication sous 72 h + demande de suppression aux plateformes |
| **Mesures de sécurité** | Sanitizing des data-URL (`lib/publish-sanitize.ts`) ; token Bearer `LTDB_PUBLISH_TOKEN` — **exposé en clair dans `.env.local.example:27`**, à révoquer |

### T07 — Gestion des ressources humaines et paie

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Gérer les dossiers salariés, établir les bulletins de paie et les cumuls, générer les documents RH (contrats, attestations), stocker les pièces justificatives |
| **Base légale** | Obligation légale (6.1.c) pour la paie et les déclarations sociales ; exécution du contrat de travail (6.1.b) |
| **Personnes concernées** | Salariés et anciens salariés de l'artisan |
| **Catégories de données** | Identité, date et lieu de naissance, **nationalité**, adresse personnelle, email et téléphone personnels, **numéro de sécurité sociale (NIR)**, poste, qualification, coefficient, salaire, type de contrat, dates, **mutuelle**, **numéro et catégories du permis de conduire**, `notes`, scans (`permis`, `mutuelle`, `autre`), bulletins (`brut`, `net_imposable`, charges, `detail_json`). Tables `salaries`, `salarie_documents`, `salarie_documents_generes` (migration 015), `fiches_paie` (migration 016) |
| **Destinataires** | L'artisan employeur uniquement (rôle `admin`), MONDOR, Supabase, Vercel |
| **Transferts hors UE** | Vercel (région à corriger) |
| **Conservation** | Voir §3.3 et `06-politique-conservation.md` — durées légales très hétérogènes, de 3 ans à 50 ans |
| **Mesures de sécurité** | `requireAdminApi()` (`lib/rh/require-admin.ts`) réserve l'accès au rôle admin — correct au niveau applicatif. **Mais** : NIR en clair, scans de permis versés dans un bucket public par défaut (`app/api/rh/salaries/[id]/documents/route.ts:8,54`), pas de RLS, pas de journalisation des consultations. Voir §3.3 |

### T08 — Comptes utilisateurs, authentification et journal de connexion

| | |
|---|---|
| **Rôle MONDOR** | RT (sécurité de la plateforme) + ST (le client peut consulter les connexions de ses techniciens) |
| **Finalité** | Authentifier les utilisateurs, gérer les habilitations, tracer les connexions réussies, révoquer les accès démo |
| **Base légale** | Intérêt légitime (6.1.f) — sécurité du SI ; obligation de sécurité (art. 32) |
| **Personnes concernées** | Artisan, ses techniciens, comptes de démonstration |
| **Catégories de données** | `login`, `role`, `technicien_id`, `is_demo`, **`ip`**, `country_code`, `city`, `user_agent`, horodatage (migration 025) ; `comptes_techniciens` (026/027) ; `demo_access` (024) ; hashes bcrypt |
| **Destinataires** | Artisan (rôle admin), MONDOR, Supabase, Vercel |
| **Transferts hors UE** | Vercel (les en-têtes de géolocalisation viennent de l'edge Vercel) |
| **Conservation** | **6 mois** (recommandation CNIL pour les journaux d'accès), 12 mois maximum si une raison de sécurité documentée le justifie. **Aujourd'hui : illimitée**, aucune purge |
| **Mesures de sécurité** | RLS activée sur `connexions_log` (migration 032) ; **mais** journal non purgé, aucune journalisation des *accès aux données* (seulement des connexions), et connexion administrateur **sans mot de passe** (`lib/auth-users.ts:26-41`) |

### T09 — Génération de contenu par IA (rapports, devis, SEO, FAQ, transcription)

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Transcrire la dictée du technicien, en extraire des champs structurés, rédiger le rapport technique, le bloc SEO, la FAQ, les mentions de devis |
| **Base légale** | Exécution du contrat (6.1.b) pour le rapport dû au client ; intérêt légitime (6.1.f) pour la production SEO — à condition que les données personnelles soient retirées avant l'appel (§3.1) |
| **Personnes concernées** | Clients finaux, techniciens |
| **Catégories de données envoyées aux API** | Enregistrement **audio brut** de la dictée (voix du technicien, souvent nom et adresse du client prononcés) → OpenAI Whisper ; transcription intégrale, type d'intervention, ville, code postal, nom du technicien → Anthropic ou Mistral. `app/api/extract/route.ts` demande explicitement au modèle d'extraire `client_nom` et `client_email` |
| **Destinataires** | OpenAI (`app/api/transcribe/route.ts`), Anthropic (`lib/llm.ts`), Mistral (repli / option) |
| **Transferts hors UE** | **Oui** — OpenAI et Anthropic aux États-Unis. Mistral = France/UE |
| **Conservation** | Chez le fournisseur : 30 jours par défaut (OpenAI, Anthropic) sauf accord de rétention nulle. Dans l'app : `interventions.transcription` conservée sans limite → à aligner sur T01 |
| **Mesures de sécurité** | Aucune pseudonymisation avant envoi ; aucun DPA signé documenté ; pas d'option zero-retention activée. Voir §3.1 |

### T10 — Diffusion sur les réseaux sociaux et Google Business Profile

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Publier automatiquement la réalisation sur GMB, YouTube, Facebook, Instagram, TikTok ; générer une vidéo Remotion à partir des photos du chantier |
| **Base légale** | Consentement de la personne concernée (6.1.a), identique à T06 |
| **Personnes concernées** | Clients finaux, techniciens |
| **Catégories de données** | Photos et vidéos du logement, ville, type d'intervention, texte de résumé, jetons OAuth de l'artisan (`social_tokens`) |
| **Destinataires** | Google, Meta, TikTok |
| **Transferts hors UE** | Oui. TikTok en particulier : transferts vers la Chine sanctionnés par la DPC irlandaise en 2025 — à mentionner explicitement dans l'information des personnes |
| **Conservation** | Selon les plateformes, non maîtrisée après publication → argument supplémentaire pour le consentement éclairé |
| **Mesures de sécurité** | Flux OAuth **sans vérification de `state`** et sans session (cf. `SECURITY_AUDIT_REPORT.md`), ligne unique par plateforme (`onConflict: "platform"`) — **incompatible avec le multi-tenant** : il faut une ligne par tenant |

### T11 — Calendrier partagé (flux iCalendar)

| | |
|---|---|
| **Rôle MONDOR** | ST |
| **Finalité** | Exposer le planning d'interventions dans l'agenda du technicien |
| **Base légale** | Intérêt légitime (6.1.f) — organisation du travail |
| **Personnes concernées** | Clients finaux (nom + adresse dans les événements), techniciens |
| **Catégories de données** | Nom du client, adresse du chantier, date/heure, type d'intervention |
| **Destinataires** | Le porteur du jeton d'URL ; l'éditeur de l'agenda utilisé (Google Calendar, Apple) |
| **Transferts hors UE** | Selon l'agenda abonné |
| **Conservation** | Glissante, liée au planning |
| **Mesures de sécurité** | Jeton dérivé de `NEXTAUTH_SECRET` (`lib/calendar-token.ts`), route publique (`middleware.ts:24`). Jeton **unique, partagé et non révocable individuellement** → en multi-tenant, un jeton par utilisateur, révocable, stocké en base |

### T12 — Gestion des abonnements et prospection du SaaS *(à créer)*

| | |
|---|---|
| **Rôle MONDOR** | **RT** |
| **Finalité** | Vendre et facturer l'abonnement, gérer le support, prospecter des artisans |
| **Base légale** | Contrat (6.1.b), obligation légale comptable (6.1.c), intérêt légitime pour la prospection B2B (6.1.f) |
| **Personnes concernées** | Artisans clients et prospects, leurs dirigeants et salariés utilisateurs |
| **Catégories de données** | Raison sociale, SIRET, nom du dirigeant, email, téléphone, données de facturation, échanges de support |
| **Destinataires** | MONDOR, son expert-comptable, l'outil de facturation, Resend |
| **Transferts hors UE** | Selon les outils retenus |
| **Conservation** | Client : contrat + 3 ans après le terme (prospection) ; factures 10 ans ; prospect : 3 ans après le dernier contact |
| **Mesures de sécurité** | À définir — ce traitement n'existe pas encore dans le code |

---

## 3. Points de non-conformité critiques identifiés dans le code

### 3.0 Le point bloquant : il n'existe aucun cloisonnement multi-tenant

Recherche effectuée sur l'ensemble de `supabase/` : **aucune colonne `tenant_id`, `organisation_id`, `entreprise_id` ou équivalent**. Les seules occurrences de `compte_id` désignent des comptes **bancaires** (migrations 001 et 010).

Conséquences si le produit était vendu en l'état :

- Toutes les données de tous les artisans seraient dans les mêmes lignes des mêmes tables, sans discriminant. Il serait **techniquement impossible** de répondre à une demande d'accès, d'export ou de suppression pour un client donné.
- Les tables cœur (`clients`, `techniciens`, `interventions`, `documents`, `factures_fournisseurs`) ont la **RLS explicitement désactivée** (`supabase/schema.sql:183-187`) ; la migration 032 ne l'a activée que sur 5 tables secondaires. L'application n'utilise que `SUPABASE_SERVICE_ROLE_KEY` (`lib/supabase.ts`), qui **contourne la RLS par construction**. Il n'y a donc **aucune barrière en base** : la seule protection est le code applicatif.
- L'identité légale de l'entreprise est codée en dur ou globale (`LTDB_SIREN`, `LTDB_SIRET`, table `parametres` mono-ligne, `social_tokens` avec `onConflict: "platform"`, `lestechniciensdudebouchage.fr` en dur dans `app/api/generate/route.ts:30`).
- Les comptes utilisateurs sont dans des **variables d'environnement** (`AUTH_USER_1`, `AUTH_TECH_1`…, `lib/auth-users.ts`) : non scalable et non cloisonné.

C'est le chantier n°1. Sans lui, aucun DPA n'est sincèrement signable : l'article 32.1.b (garantir la confidentialité) et l'article 28.3.e (assister le responsable) ne peuvent pas être satisfaits.

**Ce qu'il faut faire.** Ajouter `tenant_id uuid not null` sur **toutes** les tables porteuses de données personnelles, index composite `(tenant_id, …)` sur chaque index existant, contrainte de clé étrangère vers une table `tenants`. Puis, en défense en profondeur, activer la RLS partout et faire porter le `tenant_id` par un JWT Supabase applicatif plutôt que d'utiliser la `service_role` pour tout. À défaut d'un vrai passage RLS, imposer un **accès unique aux données via une couche de repository** qui injecte systématiquement le `tenant_id`, et interdire par lint tout appel `sb.from(...)` hors de cette couche.

### 3.1 Données personnelles envoyées aux API d'IA

**Ce qui part réellement.**

| Route | Destinataire | Contenu |
|---|---|---|
| `app/api/transcribe/route.ts` | **OpenAI** (`whisper-1`) | Le **fichier audio brut** de la dictée du technicien. Le technicien dicte sur place : la bande contient très souvent le nom du client, l'adresse, parfois des éléments de contexte familial. C'est une donnée personnelle **du client** et une donnée **vocale du technicien** |
| `app/api/extract/route.ts` | Anthropic ou Mistral | La transcription intégrale, avec une consigne explicite d'extraire `client_nom` et `client_email` |
| `app/api/generate/route.ts` | Anthropic ou Mistral | La transcription intégrale, le type d'intervention, la ville, le code postal, le nom du technicien, son ancienneté |
| `app/api/generate-devis`, `generate-facture`, `generate-attestation`, `dialogue-qa` | Anthropic ou Mistral | Contenus de rapport et éléments de devis |

**Analyse.**

1. **Transfert hors UE.** Anthropic PBC et OpenAI L.L.C. sont établis aux États-Unis. Ce sont des transferts au sens du chapitre V. Ils ne sont licites qu'encadrés : adhésion des entités concernées au **Data Privacy Framework** (à vérifier entité par entité sur `dataprivacyframework.gov` et à documenter avec une capture datée) **ou** clauses contractuelles types (module 3 : sous-traitant UE → sous-traitant hors UE) accompagnées d'une **analyse d'impact des transferts** (TIA). L'adhésion d'une société mère au DPF ne couvre pas automatiquement toutes ses filiales : c'est la personne morale contractante qui compte.
2. **Non-entraînement et rétention.** Sur les API commerciales, Anthropic et OpenAI indiquent ne pas entraîner leurs modèles sur les entrées API par défaut, avec une rétention d'environ 30 jours à des fins d'abus/sécurité. Les deux proposent une option de **rétention nulle (zero data retention)** sur demande, généralement soumise à validation commerciale. **Actions** : signer les DPA (Anthropic Commercial Terms + DPA ; OpenAI DPA), demander explicitement le ZDR, et **archiver la confirmation écrite**. Ne jamais se contenter d'une page de documentation : elle change sans préavis.
3. **Minimisation (art. 5.1.c).** Rien ne justifie d'envoyer le nom et l'email du client à un LLM pour rédiger un rapport technique. **Pseudonymiser avant l'appel** : remplacer les entités identifiantes par des jetons (`[CLIENT]`, `[ADRESSE]`, `[TEL]`, `[EMAIL]`), garder la table de correspondance côté serveur, et réinjecter après. Pour `extract`, l'extraction du nom/email est le but même : dans ce cas, préférer un extracteur local par expressions régulières (`lib/email-regexp.ts` existe déjà) et réserver le LLM à la normalisation du type d'intervention et de la ville.
4. **Transcription vocale.** C'est l'appel le plus difficile à pseudonymiser (on ne peut pas caviarder l'audio avant transcription). Deux réponses : (a) basculer sur un fournisseur UE ou une exécution locale (Whisper auto-hébergé, ou une API européenne), (b) à défaut, l'assumer dans l'information des personnes et purger la transcription brute dès que le rapport est validé — aujourd'hui `interventions.transcription` est conservée indéfiniment **et republiée** vers le site Django (`app/api/publish/from-intervention/route.ts` la sélectionne).
5. **Souveraineté immédiatement disponible.** `lib/llm.ts` gère déjà **Mistral** (société française, traitement en UE) via `AI_PROVIDER=mistral`. C'est le levier le plus rapide : **basculer par défaut sur Mistral pour tout ce qui contient des données personnelles**, et réserver Anthropic aux tâches sans donnée personnelle. Attention : le mécanisme de *fallback* actuel (`lib/llm.ts:200-230`) rebascule automatiquement vers l'autre fournisseur en cas de crédit épuisé — c'est un **transfert hors UE non maîtrisé et invisible**. Il faut pouvoir désactiver le fallback par configuration et le journaliser.

**Ce qu'il faut dire dans la politique de confidentialité** : nommer les fournisseurs, le pays, la finalité, le fait que les contenus ne servent pas à entraîner les modèles, la durée de rétention chez le fournisseur, et le mécanisme d'encadrement du transfert. Le modèle fourni en `02-politique-confidentialite-application.md` contient cette section.

### 3.2 Publication de photos de chantiers chez des particuliers

**Ce que fait le code.** `app/api/publish/route.ts` et `app/api/publish/from-intervention/route.ts` envoient au site public : les photos avant/après, la ville, le code postal, le type d'intervention, un récit détaillé, un JSON-LD, une FAQ générée, la photo et le nom du technicien. `app/api/publish-gmb/route.ts:88` compose `« {type} à {ville} »`. `/api/generate-video` produit une vidéo Remotion à partir des mêmes photos, diffusée sur YouTube/TikTok/Instagram/Facebook.

**Régime juridique — trois couches qui se superposent.**

1. **RGPD.** Une photo de l'intérieur d'un logement, associée à une commune, une date et la nature d'un problème sanitaire, permet raisonnablement de réidentifier le foyer, surtout dans une commune de quelques milliers d'habitants. C'est donc une donnée personnelle (art. 4.1 et considérant 26).
2. **Vie privée et domicile (art. 9 du Code civil).** L'image de l'intérieur du domicile relève de l'intimité de la vie privée, protection distincte et autonome du RGPD. Une base légale RGPD ne suffit pas à couvrir ce volet : il faut une **autorisation expresse**.
3. **Droit à l'image des biens.** La jurisprudence (Ass. plén., 7 mai 2004) écarte tout droit exclusif du propriétaire sur l'image de son bien, sauf trouble anormal. C'est le point le moins risqué, mais il ne neutralise pas les deux premiers.

**Base légale à retenir : le consentement (art. 6.1.a).** L'intérêt légitime ne tient pas ici : le test de mise en balance (considérant 47) échoue, parce que la personne concernée ne s'attend raisonnablement pas à ce que des photos de ses WC bouchés servent de support marketing public, et que l'atteinte à la vie privée l'emporte sur l'intérêt commercial de l'artisan. Le consentement doit être **libre** (le refus ne doit ni renchérir la prestation ni la retarder — donc pas de case dans le bon d'intervention qui conditionne les travaux), **spécifique**, **éclairé** et **univoque**, avec preuve conservée (art. 7.1) et **retrait aussi simple que le recueil** (art. 7.3).

**Ce qu'il faut mettre en place :**

- Une table `autorisations_publication` : `intervention_id`, `client_id`, `tenant_id`, `portee` (site web / GMB / réseaux sociaux / vidéo — cases séparées), `accepte_at`, `preuve` (signature ou horodatage + IP), `retire_at`, `texte_version`.
- Un **blocage dur** dans `app/api/publish/**` et `app/api/publish-*` : refus 403 si l'autorisation est absente, expirée ou retirée. Aujourd'hui aucune vérification de ce type n'existe.
- Une étape dédiée dans le wizard terrain (l'étape 8 « diffusion » existe déjà, migration 023) présentant un texte clair et **deux cases décochées par défaut** : « publication sur le site », « publication sur les réseaux sociaux ».
- Un traitement systématique des photos avant publication : floutage des visages, plaques, courrier, papiers, écrans, objets personnels identifiants ; recadrage. La CNIL considère qu'une photo non floutée d'un tiers est un traitement à part entière.
- **Ne jamais publier l'adresse précise**, seulement la commune. Éviter la mention du numéro de rue dans les légendes générées (`lib/photo-seo-name.ts` construit les noms de fichiers à partir du service et de la ville — correct, à préserver).
- Retirer les données EXIF (GPS notamment) des photos avant publication : rien dans le code ne le fait aujourd'hui.
- Prévoir une **route de dépublication** appelable depuis la fiche client, propageant la demande au site et aux plateformes, avec un délai contractuel de 72 h.
- Pour les techniciens (photo + prénom + ancienneté publiés) : consentement écrit distinct, recueilli hors du contrat de travail (le lien de subordination fragilise la liberté du consentement), et retrait sans conséquence sur l'emploi.

**Blocage produit spécifique au SaaS** : tant que la cible de publication est `lestechniciensdudebouchage.fr` en dur, la fonction est inutilisable en multi-tenant (§1.3.a). L'URL du site et le jeton doivent devenir des paramètres du tenant.

### 3.3 Données RH — sensibilité et durées de conservation

**Ce qui est stocké** (migration 015) : nationalité, date et lieu de naissance, adresse personnelle, **numéro de sécurité sociale**, mutuelle, **numéro et catégories du permis de conduire**, salaire, coefficient, notes libres ; plus les scans (`permis`, `mutuelle`) et les bulletins avec `detail_json`.

**Trois problèmes de fond.**

1. **Le NIR.** Le numéro de sécurité sociale est encadré par l'article 30 de la loi Informatique et Libertés et le décret n° 2019-341. Son usage pour la paie et les déclarations sociales est autorisé, mais il doit être **strictement cantonné à cette finalité**, avec un accès limité aux seules personnes en charge de la paie, et il ne doit **jamais** apparaître dans un export généraliste, un log, un ticket de support ou un prompt IA. Recommandation : le chiffrer au niveau colonne (pgcrypto, clé hors base) et ne le déchiffrer qu'au moment de générer le bulletin ou la DSN.
2. **Les scans de permis de conduire.** Position constante de la CNIL : l'employeur peut **vérifier** la validité du permis quand la conduite est nécessaire au poste, mais la **conservation d'une copie** doit être limitée au strict nécessaire. Le plus sûr est de conserver la **preuve de la vérification** (date, agent, validité, catégories) et non le scan. Si le scan est conservé, il doit l'être dans un espace chiffré à accès nominatif et purgé au départ du salarié.
3. **La destination des scans.** `app/api/rh/salaries/[id]/documents/route.ts:8` :
   ```ts
   const RH_BUCKET = process.env.SUPABASE_RH_BUCKET || process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'
   ```
   `SUPABASE_RH_BUCKET` n'est documentée **nulle part** (absente de `.env.local.example`). Par défaut, les permis de conduire et attestations de mutuelle des salariés atterrissent donc dans **le bucket des photos publiées sur le site**, avec une URL permanente obtenue par `getPublicUrl()` (ligne 54) et un chemin prévisible `rh/{uuid}/{type}-{timestamp}.ext`. Si ce bucket est public — ce qui est très probable puisqu'il alimente les pages publiques —, il s'agit d'une **violation de données en cours** au sens de l'article 33, à traiter selon la procédure `05-procedure-violation-donnees.md`. **À vérifier immédiatement dans le dashboard Supabase (Storage → visibilité des buckets).** Correctif : bucket privé dédié `rh-documents`, accès par `createSignedUrl()` de 60 secondes, derrière `requireAdminApi()`.

**Durées de conservation réelles en droit français** (à reporter dans `06-politique-conservation.md`) :

| Document / donnée | Durée | Fondement |
|---|---|---|
| Bulletin de paie — **double conservé par l'employeur** | **5 ans** | Art. L3243-4 C. trav. |
| Bulletin de paie **remis sous forme électronique** — disponibilité garantie au salarié | **50 ans**, ou jusqu'aux **75 ans du salarié** (l'échéance la plus favorable au salarié) | Art. D3243-8 C. trav. |
| Registre unique du personnel | **5 ans** à compter du départ du salarié | Art. R1221-26 C. trav. |
| Contrat de travail, avenants, soldes de tout compte | **5 ans** après la fin du contrat | Art. L1471-1 et 2224 C. civ. |
| Documents relatifs aux charges sociales et à la taxe sur les salaires | **3 ans** (+ année en cours) | Art. L244-3 CSS, L169 A LPF |
| Documents relatifs aux cotisations, justificatifs URSSAF | **3 ans** | Art. L244-3 CSS |
| Comptabilisation des horaires, heures supplémentaires, astreintes | **1 an** | Art. L3171-3 C. trav. |
| Déclarations d'accident du travail | **5 ans** | Art. D4711-3 C. trav. |
| Documents relatifs aux vérifications et contrôles de sécurité | **5 ans** | Art. D4711-3 C. trav. |
| Scan du permis de conduire | Durée du contrat, **suppression au départ** ; préférer la seule preuve de vérification | Minimisation (art. 5.1.c) + doctrine CNIL |
| Attestation de mutuelle | Durée du contrat + 5 ans si valeur probante ; sinon suppression au départ | Art. 2224 C. civ. |
| Candidatures non retenues | **2 ans** après le dernier contact, sauf consentement pour un vivier | Recommandation CNIL |

L'écart entre 5 ans (double employeur) et 50 ans (mise à disposition du bulletin électronique) est le piège classique : ce ne sont **pas** deux durées pour la même chose. La première est une obligation de conservation d'un double, la seconde une obligation de **mise à disposition** du bulletin dématérialisé. Si l'application se contente d'un PDF téléchargé par l'employeur, la seconde ne s'applique pas ; si elle joue le rôle de coffre-fort numérique du salarié, elle s'y engage sur 50 ans — ce qui est un engagement lourd pour un SaaS. **Recommandation produit : ne pas se positionner en coffre-fort numérique**, l'écrire noir sur blanc dans le DPA et dans la documentation, et renvoyer l'employeur vers un prestataire de coffre-fort si la remise dématérialisée est retenue.

**Aucune de ces durées n'est implémentée** : `fiches_paie` et `salarie_documents` n'ont ni `deleted_at`, ni purge, ni archivage.

### 3.4 Journal de connexion avec adresse IP

`connexions_log` (migration 025) enregistre `login`, `role`, `ip`, `country_code`, `city`, `user_agent`, à chaque connexion réussie (`lib/auth.ts:45`, `lib/connexions-log.ts:38-58`). L'IP et la ville sont des données personnelles. La table est consultée via `/connexions`, limitée à 200 lignes affichées mais **jamais purgée**.

- **Durée recommandée par la CNIL pour les journaux d'accès et de sécurité : 6 mois.** Douze mois restent défendables si un besoin de sécurité est documenté (détection de fraude, investigation). Au-delà, il faut une justification solide.
- Ne pas confondre avec les obligations de conservation des **données de connexion** pesant sur les opérateurs et hébergeurs au titre de l'article L34-1 CPCE et du décret n° 2021-1362 (1 an pour l'identité, l'IP, etc., à des fins de procédure pénale). Ce régime vise les fournisseurs d'accès et d'hébergement, pas l'éditeur d'un CRM métier. En revanche, publier un site vitrine expose l'artisan aux obligations de la LCEN — c'est un autre traitement.
- **À faire** : cron mensuel de purge à 6 mois ; ou mieux, purge des seuls champs identifiants (IP, ville, user-agent) à 6 mois en conservant `login`/`role`/`created_at` pour la statistique, ce qui est une anonymisation partielle acceptable. Documenter la durée dans la politique de confidentialité de l'application.
- Ajouter la **journalisation des accès aux données**, qui manque totalement (§6.3) : le journal actuel dit qui s'est connecté, pas qui a ouvert le dossier de M. Dupont ni qui a consulté un bulletin de paie.

### 3.5 SMS et emails de relance commerciale et de demande d'avis

**Cadre.** Article L34-5 du CPCE : la prospection directe par courrier électronique, SMS ou automate d'appel suppose le **consentement préalable** de la personne physique. Exception dite « des produits ou services analogues » : le consentement n'est pas requis si les coordonnées ont été recueillies **directement auprès de la personne à l'occasion d'une vente**, si la prospection porte sur des **produits ou services analogues** fournis par la même entreprise, et si la personne s'est vu offrir, **au moment du recueil et lors de chaque message**, un moyen simple et gratuit de s'y opposer.

**Ce que fait le code.**

| Flux | Canal | Opt-out | Conformité |
|---|---|---|---|
| Relance facture impayée (`lib/facture-relance.ts`) | Email | Lien signé HMAC + expiration | Conforme (recouvrement, pas de la prospection) |
| Relance devis (`lib/devis-relance.ts`) | Email | Lien signé | Conforme |
| Relance avis Google J+2 / J+7 (`lib/avis-relance.ts`) | Email | Lien STOP signé, présent dans le corps (lignes 29-41 et 89) | Conforme sous réserve du recueil initial |
| **Demande d'avis Google immédiate et relances** (`lib/review-url.ts:25-38`, `app/api/interventions/[id]/send-review-sms`, cron `avis-sms-relances`) | **SMS** | **Aucun** — `buildReviewOnlySmsText()` ne contient ni « STOP » ni lien de désinscription | **Non conforme** |

**Corrections.**

1. Ajouter dans **chaque SMS** de sollicitation un moyen d'opposition. En France, le standard est le mot-clé **STOP** sur un numéro court ; Brevo le gère nativement sur ses expéditeurs — vérifier que l'expéditeur alphanumérique `LTDB` (`BREVO_SMS_SENDER`) est bien configuré pour la remontée des STOP, et **traiter la remontée** (aujourd'hui aucune route ne consomme les webhooks Brevo). À défaut, insérer un lien de désinscription court signé, sur le modèle de `buildAvisStopUrl()`.
2. Tenir une **liste d'opposition par tenant** (table `oppositions_prospection` : canal, valeur normalisée e164/email, source, date), consultée **avant chaque envoi**, y compris par les crons. Aujourd'hui l'opt-out est stocké par intervention, pas par personne : un client qui refuse une fois sera resollicité à l'intervention suivante.
3. Documenter le **recueil initial** : la case « j'accepte d'être sollicité pour un avis » doit être matérialisée lors de la prise de coordonnées, sinon l'exception « services analogues » est fragile — une demande d'avis Google n'est pas la fourniture d'un service analogue, c'est une sollicitation marketing. La position prudente est de **recueillir un consentement spécifique**.
4. Mentionner l'identité de l'expéditeur dans chaque message (fait) et ne jamais masquer l'émetteur.
5. Le cron horaire `avis-sms-relances` doit vérifier l'opposition **et** l'absence de retrait avant chaque envoi.

### 3.6 Absence totale de purge et d'anonymisation automatique

Recherche exhaustive sur `deleted_at`, `purge`, `anonymis`, `retention`, `conservation` dans `supabase/`, `lib/`, `app/` : **aucun résultat fonctionnel**. Constats :

- Aucune colonne `deleted_at` ni suppression logique nulle part.
- Les 4 crons de `vercel.json` sont tous métier (alerte relevé, contrôle taux de paie, relances avis, annulation de relances) — **aucun cron de purge**.
- La seule suppression existante est `lib/cascadeDelete.ts`, un *hard delete* manuel d'une intervention (documents liés + dossiers Storage + ligne). Utile comme brique de base pour le droit à l'effacement, mais : il ne touche ni `accords_intervention`, ni les signatures, ni les vidéos, ni les publications déjà diffusées, ni les relances planifiées, et il n'est pas journalisé.
- `interventions.transcription` (dictée brute, la donnée la plus verbeuse et la plus sensible) est conservée sans limite et **repartagée** à la publication.
- `public/recup/ITV-20260724-1513-mirabella.json` (1 Mo) et son PDF : un dossier d'intervention **réel**, avec les données du client, **commité dans le dépôt et servi en statique par Next.js** derrière un préfixe public (`middleware.ts:21`). C'est une **violation de données caractérisée et active**, indépendamment de toute question de conservation. À traiter en priorité absolue : suppression du dépôt **et de l'historique git**, fermeture du préfixe `/recup`, puis analyse de notification (art. 33/34).

**Ce qu'il faut construire.** Un service de rétention unique, piloté par une table `politiques_retention (tenant_id, entite, duree_jours, action)` où `action ∈ {supprimer, anonymiser, archiver}`, et un cron quotidien `/api/cron/retention` qui :
1. bascule en archivage intermédiaire ce qui a une valeur probante (factures, accords) ;
2. anonymise ce qui doit être conservé en statistique (remplacement du nom par `Client #id`, suppression email/téléphone/adresse) ;
3. supprime définitivement le reste, y compris les objets Storage ;
4. écrit une trace dans un journal de purge (preuve de conformité, art. 5.2).

---

## 4. Droits des personnes — conception technique en multi-tenant

### 4.1 Qui répond à qui

C'est le point que les artisans comprendront mal, et il doit être écrit noir sur blanc dans le DPA :

- Le client final de l'artisan exerce ses droits **auprès de l'artisan** (responsable de traitement). MONDOR n'a pas à lui répondre directement, et ne doit surtout pas le faire de sa propre initiative.
- Si une demande arrive chez MONDOR, il la **transmet sans délai** à l'artisan concerné et n'y donne pas suite lui-même (art. 28.3.e). Prévoir un délai contractuel : transmission sous 3 jours ouvrés.
- MONDOR doit fournir **les outils** permettant à l'artisan de répondre dans le délai d'un mois (art. 12.3).
- MONDOR répond directement, en tant que responsable, aux demandes des **artisans eux-mêmes** sur leurs données de compte, de facturation et de prospection.

### 4.2 Routes API à créer

Toutes sont scopées par `tenant_id` issu de la session, jamais du corps de la requête, et réservées au rôle `admin` du tenant. Toutes écrivent dans un journal `demandes_droits`.

| Droit | Route | Méthode | Comportement |
|---|---|---|---|
| Accès (art. 15) | `/api/rgpd/personnes/[id]/acces` | GET | Renvoie l'intégralité des données liées à la personne, tous traitements confondus, plus les métadonnées obligatoires : finalités, catégories, destinataires (y compris les sous-traitants ultérieurs et les transferts hors UE), durée de conservation, origine des données, existence des droits |
| Rectification (art. 16) | `/api/rgpd/personnes/[id]/rectifier` | PATCH | Met à jour la fiche **et** propage aux copies gelées quand c'est légitime. Attention : les données gelées dans un `accords_intervention` ou une facture émise **ne se rectifient pas** — elles font foi à leur date ; on ajoute une mention rectificative |
| Effacement (art. 17) | `/api/rgpd/personnes/[id]/effacer` | POST | Voir §4.4 — effacement sélectif avec conservation des pièces légales |
| Portabilité (art. 20) | `/api/rgpd/personnes/[id]/export` | GET | Voir §4.3 |
| Limitation (art. 18) | `/api/rgpd/personnes/[id]/limiter` | POST | Pose `limitation_active = true` : la fiche devient lecture seule, exclue des relances, des exports, des publications et des crons. Implémenter le filtre dans la couche repository, pas route par route |
| Opposition (art. 21) | `/api/rgpd/personnes/[id]/opposition` | POST | Enregistre l'opposition par finalité (prospection, publication, avis). L'opposition à la prospection est **absolue** (art. 21.2) : aucune mise en balance |
| Retrait de consentement (art. 7.3) | `/api/rgpd/personnes/[id]/retrait-publication` | POST | Dépublie la réalisation du site, supprime les posts sociaux si l'API le permet, marque `autorisations_publication.retire_at` |
| Journal | `/api/rgpd/demandes` | GET | Registre des demandes et de leur traitement — preuve de conformité |

Prévoir aussi, pour l'artisan lui-même en tant que client de MONDOR : `/api/compte/export` (toutes les données du tenant, art. 28.3.g) et `/api/compte/suppression` (fin de contrat).

Point d'attention : dans ce schéma, la « personne » n'a pas d'identifiant unique. Le même particulier peut exister comme ligne `clients`, comme données gelées dans `accords_intervention` (`client_nom`, `client_email`… copiées), dans `documents.payload` (JSONB), dans `interventions.transcription` (texte libre), dans les légendes de photos et dans les PDF stockés. **Toute route de droits doit balayer ces six emplacements**, y compris une recherche plein texte dans les JSONB et une recherche dans le Storage par convention de chemin. `lib/client-dossier.ts` et `lib/client-search.ts` reconstituent déjà partiellement un dossier client en agrégeant `clients` + `interventions` + `documents` + `accords` : c'est la bonne base de départ, à étendre.

### 4.3 Portabilité — périmètre et format

**Périmètre exact (art. 20.1).** Le droit ne porte que sur les données **fournies par la personne**, traitées sur la base du **consentement ou du contrat**, et par **procédé automatisé**. Concrètement :

| Inclus | Exclu |
|---|---|
| Identité, coordonnées, adresse fournies par le client | Le rapport technique rédigé par l'artisan (donnée **créée** par le responsable) |
| Demandes et RDV pris par le client | Les `notes_internes` (données inférées / d'appréciation) |
| Photos fournies par le client | La cotation, la marge, les analyses commerciales |
| Historique des interventions et factures le concernant (données observées) | Les données concernant d'autres personnes |
| Contenu des messages qu'il a envoyés | |

Les données observées (historique des interventions) sont incluses selon les lignes directrices du G29/EDPB sur la portabilité ; les données inférées et dérivées en sont exclues. En cas de doute, l'inclusion est plus sûre que l'exclusion, sauf si elle révèle des données de tiers ou un secret d'affaires.

**Format.** « Structuré, couramment utilisé et lisible par machine » (art. 20.1) — un PDF **ne satisfait pas** cette exigence. Produire une archive ZIP contenant :

```
export-{ref}-{date}/
  donnees.json          # structure complète, UTF-8, dates ISO 8601
  clients.csv           # même contenu, tabulaire, séparateur ';', BOM UTF-8 (Excel FR)
  interventions.csv
  documents.csv
  photos/               # fichiers d'origine
  factures/             # PDF, à titre de commodité — hors périmètre art. 20 stricto sensu
  LISEZMOI.txt          # description des champs, finalités, date d'export
```

`app/api/export/csv/route.ts` fournit déjà un générateur CSV correct (séparateur `;`, échappement, format FR) : le réutiliser plutôt que d'en écrire un second. Ne pas mettre de mot de passe sur le ZIP sans transmettre le mot de passe par un canal distinct ; livrer via un lien signé de courte durée, pas en pièce jointe.

### 4.4 Effacement vs obligation comptable — la résolution correcte

C'est le conflit qui revient systématiquement, et il se résout **sans arbitrage**, parce que le RGPD a prévu le cas.

**La règle.** L'article 17.3.b écarte le droit à l'effacement lorsque le traitement est nécessaire « pour respecter une obligation légale qui requiert le traitement prévue par le droit de l'Union ou par le droit de l'État membre ». Les articles L123-22 du Code de commerce (10 ans pour les livres, registres et pièces justificatives) et L102 B du LPF (6 ans) sont exactement une telle obligation. **La facture ne s'efface donc pas** — et il ne s'agit pas d'un refus discrétionnaire mais d'une exception de plein droit.

**Ce que cela n'autorise pas.** L'exception couvre la **facture**, pas tout le reste. Elle ne justifie ni de garder la fiche client active, ni les photos du logement, ni la transcription, ni la publication SEO, ni le numéro de téléphone dans les listes de relance. Une réponse « je ne peux rien supprimer, j'ai une obligation comptable de 10 ans » est une **mauvaise réponse** et un motif de sanction classique.

**La mise en œuvre : le modèle à trois états de la CNIL.**

| État | Contenu | Accès | Ce qui s'y trouve après une demande d'effacement |
|---|---|---|---|
| **Base active** | Données utilisées au quotidien | Tous les utilisateurs habilités du tenant | **Rien** concernant la personne |
| **Archivage intermédiaire** | Données conservées pour une obligation légale ou un contentieux possible | **Accès restreint et motivé**, journalisé, idéalement une base ou un schéma séparé | Facture, avoir, accord signé, éléments comptables |
| **Archivage définitif** | Valeur patrimoniale/historique | Sans objet ici | — |

**Procédure concrète à implémenter dans `/api/rgpd/personnes/[id]/effacer` :**

1. **Supprimer** : ligne `clients` (ou anonymiser si des interventions y sont rattachées), photos et vidéos du logement, `transcription`, `notes_internes`, `photos_legendes`, signature manuscrite, IP et user-agent de l'accord, entrées de relance, autorisations de publication, dossiers Storage associés (réutiliser `lib/cascadeDelete.ts` en l'étendant).
2. **Dépublier** : réalisations sur le site, posts GMB/Meta/TikTok/YouTube, et demander la désindexation aux moteurs.
3. **Anonymiser** ce qui doit rester pour la cohérence statistique : `interventions` conservées avec `client_id = null`, nom remplacé par `Client anonymisé #{n}`, adresse réduite à la commune. Une intervention anonymisée n'est plus une donnée personnelle et sort du champ du RGPD (considérant 26) — à condition que la réidentification soit réellement impossible, ce qui suppose aussi de purger la transcription et les photos.
4. **Archiver** : la facture et l'accord partent en archivage intermédiaire, avec `archive_at` et un accès réservé au rôle comptable. Les champs non nécessaires à l'obligation comptable (téléphone, email, notes) sont **purgés du `payload` JSONB** avant archivage : l'obligation comptable impose de conserver l'identité et l'adresse de facturation, pas le portable et l'email.
5. **Répondre à la personne** dans le délai d'un mois, en expliquant précisément **ce qui a été supprimé** et **ce qui est conservé, pour quelle durée et sur quel fondement**. C'est une obligation (art. 12.4 et 17) et c'est aussi ce qui évite la plainte.
6. **Purger réellement à l'échéance** : à 10 ans révolus, la facture archivée doit disparaître automatiquement. Sans ce dernier maillon, l'argumentation de la légalité de l'archivage tombe.
7. **Tracer** la demande, la date, le périmètre, la décision et son fondement dans `demandes_droits`.

**Cas voisins à trancher de la même façon** : garantie décennale et assurance (conservation justifiée jusqu'à l'expiration de la garantie), contentieux en cours (art. 17.3.e : conservation pour la constatation ou l'exercice d'un droit en justice — mais mise en limitation, art. 18.1.c), et données RH (obligations propres, §3.3).

---

## 5. Documents contractuels à produire

Les six documents sont rédigés dans `docs/scale/juridique/` (chemins en tête de dossier). Ce qu'il reste à faire dessus :

1. Compléter les champs entre crochets `[…]` (raison sociale exacte, forme juridique, adresse du siège, adresse de contact RGPD, dates, plan tarifaire).
2. **Faire relire par un juriste** avant la première signature — chaque document porte l'avertissement en tête.
3. Versionner : chaque document a un numéro de version et une date ; toute évolution doit être notifiée aux clients avec préavis (30 jours pour la liste des sous-traitants ultérieurs).
4. Rendre publics le DPA (en annexe des CGV), la politique de confidentialité de l'application et la liste des sous-traitants ultérieurs, à une URL stable.

---

## 6. Mesures techniques exigibles (art. 32)

L'article 32 impose des mesures « adaptées au risque », en tenant compte de l'état de l'art et des coûts. Un CRM multi-tenant contenant des données RH, des NIR et des images de domiciles se situe dans le haut du spectre de risque.

### 6.1 Chiffrement en transit

**Où on en est** : HTTPS imposé par Vercel ; en-têtes de sécurité corrects (`next.config.mjs` : `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). TLS vers Supabase et les API tierces.
**Ce qui manque** : pas de `Strict-Transport-Security` (HSTS), pas de `Content-Security-Policy`.
**À faire** : ajouter `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` et une CSP restrictive (elle protège aussi contre l'exfiltration de données par script injecté).

### 6.2 Chiffrement au repos et pseudonymisation

**Où on en est** : chiffrement disque assuré par Supabase (AES-256) et par le Storage. C'est le minimum, et c'est acquis.
**Ce qui manque** : aucun chiffrement au niveau colonne pour les données les plus sensibles (`salaries.numero_secu`, `salaries.date_naissance`, `salarie_documents.url`) ; aucune pseudonymisation avant les appels IA (§3.1) ; aucun chiffrement applicatif des documents RH.
**À faire** : `pgcrypto` sur le NIR avec une clé détenue hors base (variable d'environnement Vercel, rotation annuelle) ; pseudonymisation systématique des prompts ; bucket RH privé et chiffré.

### 6.3 Journalisation des accès aux données personnelles

**Où on en est** : `connexions_log` trace les **connexions**. C'est tout.
**Ce qui manque** : rien ne trace la **consultation** d'un dossier client, d'un bulletin de paie ou d'un document RH ; rien ne trace les exports ; rien ne trace les accès de MONDOR (exploitation) aux données d'un tenant.
**À faire** : table `journal_acces (tenant_id, acteur, role, action, entite, entite_id, at, ip)`, alimentée dans la couche repository sur les entités sensibles (RH, comptabilité, dossier client complet, exports). Conservation 6 mois à 1 an. **Les accès de l'éditeur** (support, debug) doivent être tracés séparément, notifiés au client et justifiés — c'est ce que demandera tout artisan un peu attentif, et c'est l'argument commercial le plus fort face à des concurrents.

### 6.4 Sauvegardes et test de restauration

**Où on en est** : rien dans le dépôt. Supabase assure des sauvegardes quotidiennes selon le plan (7 jours en Pro, PITR en option payante).
**À faire** : documenter le RPO/RTO dans le DPA ; activer le **Point-In-Time Recovery** (indispensable dès qu'on héberge les données d'un tiers) ; sauvegarde du Storage (les buckets ne sont pas toujours couverts par les sauvegardes de la base — à vérifier explicitement) ; **test de restauration semestriel documenté** avec compte rendu daté. La restauration non testée est le manquement art. 32.1.c le plus fréquemment relevé.

### 6.5 Gestion des habilitations

**Où on en est** : deux rôles seulement, `admin` et `tech` (`lib/auth-users.ts`), avec un filtrage de routes par rôle (`lib/auth-routes.ts`, `middleware.ts`) et des permissions techniciens en base (migration 027). Les comptes admin sont dans des **variables d'environnement**, et surtout : `loadAdmins()` (`lib/auth-users.ts:26-41`) crée les administrateurs avec `passwordHash: null`, c'est-à-dire **une connexion administrateur sans mot de passe**.
**À faire, par ordre d'urgence** : (1) supprimer la connexion sans mot de passe — c'est incompatible avec toute commercialisation ; (2) migrer les comptes en base avec hash Argon2id ou bcrypt coût ≥ 12 ; (3) rôles par tenant (`proprietaire`, `admin`, `comptable`, `technicien`, `lecteur`) avec un rôle **comptable** distinct pour l'accès aux archives et un accès RH réservé au propriétaire ; (4) revue trimestrielle des habilitations ; (5) désactivation automatique des comptes inactifs à 6 mois.

**Comptes de démonstration** : `demo_access` (migration 024) crée des comptes **admin complets** temporaires. En l'état, faire une démo à un prospect revient à lui **montrer les vraies données des vrais clients** — une divulgation non autorisée. Il faut un **tenant de démonstration avec des données fictives**, jamais un accès admin à la production.

### 6.6 Durée de session et authentification forte

**Où on en est** : `session: { strategy: "jwt" }` sans `maxAge` (`lib/auth.ts:58`) → la valeur par défaut de NextAuth est de **30 jours**. Aucun MFA.
**À faire** : `maxAge` de 12 h pour les comptes admin et comptables, 7 jours glissants avec `updateAge` pour les techniciens en mobilité (contrainte terrain réelle : un technicien ne peut pas se reconnecter en permanence sur un chantier) ; déconnexion à l'inactivité côté client ; **MFA obligatoire (TOTP) pour les rôles `proprietaire`, `admin` et `comptable`**, recommandé pour les autres. Le MFA n'est pas explicitement exigé par l'article 32, mais son absence sur un compte donnant accès à des bulletins de paie et des NIR est difficile à défendre en 2026.

### 6.7 Cloisonnement multi-tenant

**Où on en est** : inexistant (§3.0). RLS désactivée sur les tables cœur, `service_role` partout, pas de `tenant_id`.
**À faire** : `tenant_id` obligatoire ; RLS activée sur **toutes** les tables ; abandon de la `service_role` pour les requêtes portant sur des données de tenant au profit d'un JWT applicatif portant `tenant_id` ; cloisonnement du Storage par préfixe `/{tenant_id}/…` avec politiques d'accès ; **tests automatisés d'isolation** (un test par table qui vérifie qu'un tenant A ne peut jamais lire une ligne du tenant B) exécutés en CI. Ces tests sont la preuve la plus convaincante à produire lors d'un audit client.

### 6.8 Autres mesures

| Mesure | État | Action |
|---|---|---|
| Secrets | `LTDB_PUBLISH_TOKEN` en clair dans `.env.local.example:27`, dans l'historique git | Révoquer, régénérer, purger l'historique, ajouter un scan de secrets en CI |
| Données réelles dans le dépôt | `public/recup/*.json` et `.pdf` — dossier client réel | Supprimer du dépôt **et de l'historique**, fermer `/recup` |
| Protection des crons | Fail-open sans `CRON_SECRET` | `return false` inconditionnel |
| OAuth | Pas de vérification du `state`, une ligne par plateforme | `state` aléatoire vérifié, jetons par tenant, chiffrés |
| Mises à jour | Next.js 14.2.35 | Veille de sécurité, `npm audit` en CI |
| Sous-traitants humains | Aucun | Engagement de confidentialité signé pour tout intervenant |
| Environnements | Pas de séparation documentée | Interdire les données réelles hors production ; jeu de données de test anonymisé |

---

## 7. Hébergement, souveraineté et transferts hors UE

### 7.1 Ce que le projet utilise réellement

**Vercel.** `vercel.json` ne contient **aucune clé `regions`**. Sans configuration explicite, les fonctions serverless Vercel s'exécutent dans la région par défaut du projet, historiquement `iad1` (Washington D.C., États-Unis). Toutes les fonctions listées dans `vercel.json` — génération de PDF, rendu vidéo Remotion (`maxDuration: 300`, `memory: 3008`), envoi des mails terrain, crons de relance — traiteraient donc **les photos de l'intérieur des logements, les factures et les bulletins de paie sur des serveurs américains**. À vérifier immédiatement dans le dashboard Vercel (Settings → Functions → Function Region) et à corriger.

**Correctif** :
```jsonc
// vercel.json
{
  "regions": ["cdg1"],   // Paris ; fra1 (Francfort) ou arn1 (Stockholm) en alternative UE
  // ...
}
```
Attention : le choix de la région de fonction requiert un plan **Pro** ; sur le plan Hobby, la région est imposée. Un SaaS commercial doit de toute façon être sur un plan Pro (support, SLA, DPA). Noter aussi que même avec `cdg1`, Vercel Inc. reste une société américaine : les journaux de la plateforme, le support et l'administration relèvent d'un accès potentiel depuis les États-Unis. La région règle la localisation du **traitement**, pas la qualification du transfert.

**Supabase.** `supabase/README.md` prescrit explicitement la région **Europe (West) — Paris** à la création du projet. C'est correct, **à vérifier sur le projet réellement provisionné** (Dashboard → Settings → General → Region). Supabase Inc. est également américaine : mêmes remarques sur le support et l'administration. Une alternative pleinement souveraine serait un PostgreSQL managé chez un hébergeur français (Scaleway, OVHcloud, Clever Cloud), mais elle implique de réécrire l'usage du Storage et du client `@supabase/supabase-js` — à considérer comme une option de différenciation commerciale, pas comme un prérequis.

**Autres.** Anthropic (US) et OpenAI (US) — voir §3.1. Resend (US). Brevo = Sendinblue SA, **France** — à privilégier comme unique fournisseur SMS et à envisager aussi pour l'email transactionnel, ce qui supprimerait un transfert. Twilio (US) en repli. Google, Meta, TikTok : entités irlandaises contractantes, avec des transferts vers les États-Unis (et, pour TikTok, vers la Chine, sujet d'une sanction de la DPC irlandaise en 2025).

### 7.2 Encadrement des transferts, sous-traitant par sous-traitant

Le tableau détaillé et maintenu figure dans `juridique/04-sous-traitants-ulterieurs.md`. Synthèse des mécanismes :

| Sous-traitant | Pays de traitement | Mécanisme de transfert | Action |
|---|---|---|---|
| Supabase | UE (Paris) si bien configuré | Pas de transfert pour les données au repos ; SCC pour l'administration et le support | Vérifier la région ; signer le DPA ; activer le PITR |
| Vercel | **US par défaut** → à basculer UE | SCC (module 3) + DPF selon l'entité ; **vérifier l'inscription sur `dataprivacyframework.gov`** | Passer en `cdg1` ; signer le DPA ; documenter |
| Anthropic | US | DPA + SCC ; vérifier le statut DPF de l'entité contractante | Signer le DPA, demander la rétention nulle, archiver la confirmation |
| OpenAI | US (entité irlandaise pour l'UE selon l'offre) | DPA + SCC / DPF | Idem ; ou remplacer la transcription par une solution UE |
| Mistral AI | **France** | Aucun transfert | **À privilégier par défaut** pour tout prompt contenant des données personnelles |
| Resend | US | DPA + SCC / DPF ; vérifier l'existence d'une région UE sur le plan souscrit | Signer le DPA ; évaluer une bascule vers Brevo |
| Brevo (Sendinblue) | **France** | Aucun transfert | À privilégier |
| Twilio | US | DPA + SCC / DPF | Désactiver si Brevo suffit, sinon documenter |
| Google (GMB, YouTube, Calendar) | UE + US | Google Ireland ; SCC + DPF | Accepter les conditions de traitement des données Google ; documenter |
| Meta (Facebook, Instagram) | UE + US | Meta Ireland ; SCC + DPF | Documenter ; publication soumise au consentement (§3.2) |
| TikTok | UE (Project Clover) + US + **Chine** | TikTok Technology Ltd (Irlande) ; SCC | Risque le plus élevé du lot : **mentionner explicitement** dans le consentement ; envisager de retirer la fonctionnalité |
| OpenStreetMap / Nominatim | UE / Royaume-Uni | RU sous décision d'adéquation | Usage gratuit soumis à une politique d'usage restrictive : passer sur un géocodeur contractualisé (base Adresse Nationale, IGN) pour un usage commercial |

### 7.3 Méthode à appliquer pour chaque transfert

1. Identifier l'**entité juridique contractante** exacte (pas la marque).
2. Déterminer le mécanisme : adéquation → DPF (vérifier l'inscription **et** que la catégorie « HR data » est couverte le cas échéant) → clauses contractuelles types (module 3) → dérogations de l'art. 49 (à ne pas utiliser en routine).
3. Réaliser une **analyse d'impact du transfert** (TIA) pour les transferts vers les États-Unis : nature des données, sensibilité, mesures supplémentaires (chiffrement, pseudonymisation, rétention nulle), exposition au FISA 702 / EO 12333.
4. Archiver les preuves datées : DPA signé, capture de l'inscription DPF, SCC signées, TIA.
5. Refaire l'exercice **annuellement** — le DPF a déjà été contesté, et une invalidation par la CJUE (« Schrems III ») rendrait caducs les transferts qui en dépendent seuls. Prévoir contractuellement la possibilité de basculer un sous-traitant vers une alternative UE ; c'est aussi pour cela qu'avoir Mistral et Brevo déjà intégrés est un atout.

---

## 8. Plan d'action priorisé

### Immédiat — avant toute autre chose (jours 1 à 7)

| # | Action | Référence |
|---|---|---|
| 1 | Vérifier la **visibilité des buckets Supabase**. Si `interventions-photos` est public, les permis de conduire et attestations mutuelle sont exposés → **violation de données**, déclencher `05-procedure-violation-donnees.md` | §3.3 |
| 2 | Supprimer `public/recup/*` du dépôt **et de l'historique git**, retirer `/recup` de `PUBLIC_PREFIXES` | §3.6 |
| 3 | Supprimer la **connexion administrateur sans mot de passe** (`lib/auth-users.ts:35`) | §6.5 |
| 4 | Révoquer et régénérer `LTDB_PUBLISH_TOKEN` | §6.8 |
| 5 | Créer un bucket privé `rh-documents`, migrer les fichiers, passer en `createSignedUrl()` | §3.3 |
| 6 | Fixer `"regions": ["cdg1"]` dans `vercel.json` et vérifier la région Supabase | §7.1 |
| 7 | Ajouter le mécanisme **STOP** dans les SMS de demande d'avis | §3.5 |

### Court terme — prérequis à la première vente (semaines 2 à 10)

8. Architecture multi-tenant : `tenant_id` partout, RLS activée, abandon de la `service_role` pour les données de tenant, tests d'isolation en CI (§3.0, §6.7).
9. Comptes utilisateurs en base, rôles étendus, MFA sur les rôles sensibles, `maxAge` de session (§6.5, §6.6).
10. Table `autorisations_publication` + blocage des routes `publish/*` sans consentement + floutage et purge EXIF (§3.2).
11. Paramétrage par tenant de la cible de publication, des jetons OAuth et de l'identité légale (§1.3.a, §3.0).
12. Pseudonymisation des prompts, bascule Mistral par défaut, désactivation du fallback silencieux, signature des DPA IA + demande de rétention nulle (§3.1).
13. Service de rétention et cron `/api/cron/retention` ; purge de `connexions_log` à 6 mois (§3.4, §3.6).
14. Routes d'exercice des droits + export de portabilité (§4).
15. Journal des accès aux données sensibles, y compris les accès de l'éditeur (§6.3).
16. Tenant de démonstration avec données fictives, en remplacement de `demo_access` sur la production (§6.5).

### Moyen terme — industrialisation (mois 3 à 6)

17. AIPD complète et documentée (§1.5).
18. Deux registres des traitements tenus à jour (§1.5, §2).
19. Test de restauration documenté, PITR activé (§6.4).
20. Contractualisation complète de la chaîne de sous-traitance + TIA (§7.3).
21. HSTS, CSP, scan de secrets et `npm audit` en CI (§6.1, §6.8).
22. Procédure de violation testée à blanc une fois par an (`05-procedure-violation-donnees.md`).
23. Revue annuelle de l'ensemble du dossier et de la liste des sous-traitants ultérieurs.

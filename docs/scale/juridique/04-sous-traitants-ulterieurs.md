# Liste des sous-traitants ultérieurs

> **Nature du document.** Liste publique et versionnée des sous-traitants ultérieurs, exigée par
> l'article 28.2 et 28.4 du RGPD et par l'article [X] du DPA. Elle doit être accessible en ligne
> et notifiée aux clients **30 jours avant** tout ajout ou remplacement, afin de leur laisser
> le temps d'exercer leur droit d'objection.
>
> **Avertissement.** Les mécanismes de transfert et les entités contractantes évoluent. Chaque
> ligne doit être **vérifiée à la source** (DPA du fournisseur, page « sous-traitants », registre
> `dataprivacyframework.gov`) avant publication commerciale, puis revue au moins une fois par an.
>
> **Version : [1.0] — En vigueur depuis le [JJ/MM/AAAA]**

---

## 1. Comment lire ce tableau

| Colonne | Signification |
|---|---|
| **Finalité** | Ce que le sous-traitant fait, et rien d'autre |
| **Données concernées** | Catégories réellement transmises |
| **Localisation** | Où le traitement a lieu, tel que configuré |
| **Encadrement** | Ce qui rend le transfert licite s'il sort de l'UE |
| **Statut** | ✅ en production · ⚠️ à corriger · 🔲 optionnel/désactivable |

---

## 2. Infrastructure — indispensables au fonctionnement

| Sous-traitant | Entité et pays | Finalité | Données concernées | Localisation du traitement | Encadrement | Statut |
|---|---|---|---|---|---|---|
| **Supabase** | Supabase Inc. (États-Unis) | Base de données, authentification, stockage des fichiers | L'intégralité des données applicatives | **UE — Paris (`eu-west-3`)** | DPA + clauses contractuelles types pour l'administration et le support | ✅ |
| **Vercel** | Vercel Inc. (États-Unis) | Hébergement de l'application et exécution des traitements | Toutes les données en transit lors des traitements | **À basculer sur `cdg1` (Paris)** — la région par défaut est américaine | DPA + CCT ; vérifier l'inscription au Data Privacy Framework | ⚠️ **à corriger avant commercialisation** |
| **Backblaze** (sauvegardes) | Backblaze Inc. (États-Unis) | Sauvegarde chiffrée hors fournisseur principal | Copie chiffrée de la base | UE (`eu-central`) | Chiffrement côté client : la clé n'est jamais transmise | 🔲 recommandé |

## 3. Communication avec les clients finaux

| Sous-traitant | Entité et pays | Finalité | Données concernées | Localisation | Encadrement | Statut |
|---|---|---|---|---|---|---|
| **Brevo** | Sendinblue SA — **France** | Envoi des SMS (rappels, avis, relances) | Numéro de téléphone, contenu du message | France | **Aucun transfert hors UE** | ✅ à privilégier |
| **Resend** | Resend Inc. (États-Unis) | Envoi des e-mails transactionnels (devis, factures, rapports) | Adresse e-mail, nom, pièces jointes | États-Unis | DPA + CCT / DPF | ⚠️ migration vers Brevo à évaluer |
| **Twilio** | Twilio Inc. (États-Unis) | SMS de repli si Brevo indisponible | Numéro de téléphone, contenu | États-Unis | DPA + CCT / DPF | 🔲 désactivable |

## 4. Intelligence artificielle

| Sous-traitant | Entité et pays | Finalité | Données concernées | Localisation | Encadrement | Statut |
|---|---|---|---|---|---|---|
| **Mistral AI** | Mistral AI SAS — **France** | Rédaction assistée des rapports d'intervention | Description technique de l'intervention, **sans identité ni adresse du client** | France | **Aucun transfert hors UE** | ✅ **à privilégier pour tout contenu personnel** |
| **Anthropic** | Anthropic PBC (États-Unis) | Rédaction assistée des rapports, devis et contenus | Idem, après pseudonymisation | États-Unis | DPA + CCT ; rétention nulle à demander et archiver | ✅ |
| **OpenAI** | OpenAI (entité irlandaise pour l'UE selon l'offre) | Transcription de la dictée vocale des techniciens | Enregistrement audio du technicien, pouvant contenir des noms de clients | États-Unis / Irlande | DPA + CCT / DPF ; option de non-entraînement à activer | ⚠️ alternative UE à étudier |

> **Règle produit à faire respecter par le code** : aucune donnée directement identifiante (nom,
> adresse, téléphone, e-mail du client final) ne doit figurer dans un prompt. La pseudonymisation
> doit être appliquée **avant** l'appel, pas après.

## 5. Publication et intégrations optionnelles

Ces services ne sont activés que si le client artisan le demande explicitement, avec son propre
compte. Chaque activation ajoute un sous-traitant à sa propre chaîne.

| Sous-traitant | Entité contractante | Finalité | Localisation | Encadrement | Statut |
|---|---|---|---|---|---|
| **Google** (Business Profile, YouTube, Calendar) | Google Ireland Ltd | Publication de réalisations, réponses aux avis, synchronisation d'agenda | UE + États-Unis | CCT + DPF | 🔲 sur activation |
| **Meta** (Facebook, Instagram) | Meta Platforms Ireland Ltd | Publication de réalisations | UE + États-Unis | CCT + DPF | 🔲 sur activation |
| **TikTok** | TikTok Technology Ltd (Irlande) | Publication de vidéos de réalisations | UE (Project Clover), États-Unis et **Chine** | CCT — **risque le plus élevé de la liste** | 🔲 sur activation, à mentionner explicitement dans le consentement client |
| **OpenStreetMap / Nominatim** | Fondation OSM (Royaume-Uni) | Géocodage et fonds de carte | UE / Royaume-Uni (décision d'adéquation) | Adéquation | ⚠️ usage commercial : basculer sur la Base Adresse Nationale ou l'IGN |

---

## 6. Engagements de l'éditeur

1. **Notification préalable de 30 jours** avant tout ajout ou remplacement d'un sous-traitant,
   par e-mail à l'adresse de contact renseignée par le client, et par mise à jour datée de la
   présente liste.
2. **Droit d'objection** : le client dispose de 30 jours pour s'opposer, par écrit et pour un
   motif raisonnable tenant à la protection des données. À défaut d'accord, il peut résilier
   sans pénalité la partie du service concernée.
3. **Équivalence contractuelle** : chaque sous-traitant ultérieur est lié par des obligations de
   protection au moins équivalentes à celles du DPA principal. L'éditeur demeure pleinement
   responsable de leurs manquements devant le client.
4. **Revue annuelle** de la présente liste, et à chaque changement d'architecture.

## 7. Journal des modifications

| Version | Date | Modification | Notifiée le |
|---|---|---|---|
| 1.0 | [JJ/MM/AAAA] | Version initiale | — |

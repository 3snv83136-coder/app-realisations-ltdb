# Procédure de violation de données personnelles

> **Nature du document.** Procédure interne de l'éditeur, en qualité de sous-traitant (art. 33.2
> RGPD) et de responsable de traitement pour ses propres données (art. 33.1 et 34).
>
> **Avertissement.** Base de travail à valider par un juriste. Les délais indiqués sont ceux du
> RGPD ; les délais contractuels plus courts proviennent du DPA.
>
> **Version : [1.0] — [JJ/MM/AAAA] · Responsable de la procédure : [NOM]**

---

## 1. Ce qui compte comme violation

Une violation, ce n'est pas seulement un piratage. C'est **toute** atteinte à la confidentialité,
à l'intégrité ou à la disponibilité de données personnelles, qu'elle soit malveillante ou
accidentelle (art. 4.12).

Entrent dans le champ, par exemple :

- une fuite entre clients : un artisan voit les données d'un autre (**le risque propre à la base
  partagée** — priorité absolue) ;
- un fichier contenant des données personnelles rendu accessible publiquement (bucket de stockage
  ouvert, fichier déposé dans un répertoire public) ;
- un accès non autorisé à un compte (identifiants compromis, absence de mot de passe, session
  volée) ;
- une perte de données sans sauvegarde exploitable ;
- un envoi d'e-mail ou de SMS au mauvais destinataire, s'il contient des données personnelles ;
- un vol ou une perte de matériel non chiffré contenant des données ;
- un rançongiciel, même sans exfiltration prouvée (l'indisponibilité suffit).

**En cas de doute, on qualifie et on documente.** Une violation non notifiée à tort coûte plus
cher qu'une notification prudente.

---

## 2. Les délais, et qui doit quoi

| Qui | Vers qui | Délai | Fondement |
|---|---|---|---|
| **Éditeur (sous-traitant)** | Client artisan concerné | **24 h** après la prise de connaissance | Contractuel (DPA) — le RGPD dit « sans délai injustifié » |
| **Client artisan (responsable)** | CNIL | **72 h** après avoir été informé, sauf risque improbable | Art. 33.1 |
| **Client artisan (responsable)** | Personnes concernées | Sans délai injustifié, si **risque élevé** | Art. 34 |
| **Éditeur (pour ses propres données)** | CNIL | **72 h** | Art. 33.1 |

Le point de départ des 72 h du client, c'est **le moment où l'éditeur le prévient**. D'où
l'engagement contractuel à 24 h : tout retard de l'éditeur consomme le délai de son client.

---

## 3. Déroulé, heure par heure

### Étape 1 — Endiguer (0 à 2 h)

Objectif : arrêter l'hémorragie avant de comprendre.

- Couper l'accès concerné : révoquer les sessions, désactiver le compte, retirer le fichier,
  fermer le bucket, activer le drapeau de coupure globale si la fuite est inter-clients.
- **Ne rien détruire.** Les journaux, la base et les fichiers sont des preuves. Ne pas
  « nettoyer » avant capture.
- Figer les éléments de preuve : export des journaux d'accès, capture de la configuration fautive,
  identifiant du déploiement concerné, horodatage.

### Étape 2 — Qualifier (2 à 8 h)

Renseigner la fiche d'incident (§5) en répondant à :

- **Quoi** : quelles catégories de données, quel volume, quelles personnes.
- **Qui** : combien de personnes concernées, combien de clients artisans concernés.
- **Quand** : début de l'exposition, fin, durée totale.
- **Comment** : cause technique première.
- **Preuve d'accès** : les données ont-elles été **effectivement** consultées, ou seulement
  exposées ? Les journaux d'accès du stockage et de la base répondent. Une exposition sans accès
  avéré reste une violation, mais le risque est moindre.
- **Gravité** : croiser la sensibilité (RH, NIR, santé > coordonnées) et le volume.

### Étape 3 — Notifier les clients (dans les 24 h)

Envoyer à chaque client artisan concerné, par e-mail à l'adresse de contact RGPD du DPA, le
modèle du §6. Contenu minimal exigé par l'article 33.3 : nature de la violation, catégories et
nombre approximatif de personnes et d'enregistrements, conséquences probables, mesures prises,
contact.

Si tout n'est pas connu à 24 h, **notifier quand même** avec ce qui est établi, et prévenir qu'un
complément suivra. C'est explicitement prévu par l'article 33.4.

### Étape 4 — Assister le client (jours 1 à 3)

L'éditeur ne notifie pas la CNIL à la place de son client, mais il lui fournit tout ce qu'il faut
pour le faire : chronologie, périmètre exact des personnes concernées, mesures correctives,
évaluation du risque. Sur demande, l'aider à rédiger.

### Étape 5 — Corriger et vérifier (jours 1 à 14)

- Correctif technique, puis **preuve** que le correctif fonctionne (test automatisé ajouté à la
  suite d'isolation ou de sécurité, pour que la régression soit impossible).
- Recherche de cas identiques ailleurs dans le produit.
- Rotation des secrets si un secret a pu être exposé.

### Étape 6 — Retour d'expérience (sous 30 jours)

Analyse sans recherche de faute : pourquoi la protection n'a pas joué, pourquoi la détection a
tardé, ce qui a manqué. Une action concrète par cause identifiée, avec une échéance.

---

## 4. Registre des violations

L'article 33.5 impose de documenter **toute** violation, y compris celles qui ne sont pas
notifiées. Le registre est tenu dans `docs/scale/juridique/registre-violations.md` (accès
restreint) et présenté à la CNIL en cas de contrôle.

| Champ | Contenu |
|---|---|
| Référence | `VIOL-AAAA-NN` |
| Date de survenance / de découverte | |
| Nature | Confidentialité · Intégrité · Disponibilité |
| Catégories de données et de personnes | |
| Nombre approximatif de personnes / d'enregistrements | |
| Clients artisans concernés | |
| Cause première | |
| Conséquences probables | |
| Mesures d'endiguement et correctives | |
| Notification client (date/heure) | |
| Notification CNIL par le client (oui/non, date, motif si non) | |
| Information des personnes (oui/non, motif) | |
| Actions de fond engagées | |

---

## 5. Fiche d'incident — à remplir dès l'étape 1

```
RÉFÉRENCE        : VIOL-____-__
DÉCOUVERTE LE    : __/__/____ à __h__   PAR : ____________
CANAL DE DÉCOUVERTE : supervision · client · chercheur · hasard · audit

DESCRIPTION FACTUELLE (que s'est-il passé, sans interprétation) :

DONNÉES CONCERNÉES :
  [ ] Identité/coordonnées clients finaux   [ ] Photos de domiciles
  [ ] Factures / données financières        [ ] Données RH (dont NIR)
  [ ] Identifiants / secrets                [ ] Journaux de connexion (IP)

PÉRIMÈTRE : ____ personnes · ____ enregistrements · ____ clients artisans
EXPOSITION : du __/__ __h__ au __/__ __h__  (durée : ____)
ACCÈS EFFECTIF PROUVÉ : oui / non / indéterminé   (source : ____________)

GRAVITÉ : négligeable · limitée · importante · maximale
RISQUE POUR LES PERSONNES : improbable · possible · élevé

ENDIGUEMENT (heure) : ____________________
NOTIFICATION CLIENTS (heure) : ______________
```

---

## 6. Modèle de notification au client artisan

> **Objet : Notification d'une violation de données — action requise de votre part sous 72 h**
>
> Madame, Monsieur,
>
> En application de l'article 33.2 du RGPD et de l'article [X] de notre contrat de sous-traitance,
> nous vous informons d'une violation de données personnelles affectant les données que nous
> traitons pour votre compte.
>
> **Ce qui s'est passé.** [Description factuelle, sans jargon.]
>
> **Quand.** Survenue le [date, heure], détectée le [date, heure].
>
> **Données concernées.** [Catégories précises.] Environ [N] personnes et [N] enregistrements
> vous concernant sont impliqués.
>
> **Les données ont-elles été consultées ?** [Consultation avérée / exposition sans accès avéré,
> avec la source de cette conclusion.]
>
> **Conséquences probables pour les personnes.** [Analyse honnête.]
>
> **Ce que nous avons fait.** [Endiguement, horaire, correctif, vérification.]
>
> **Ce que vous devez faire.** En tant que responsable de traitement, il vous appartient
> d'apprécier s'il convient de notifier la CNIL — le délai de 72 h court à compter de la présente
> notification — et, en cas de risque élevé, d'informer les personnes concernées. Nous nous tenons
> à votre disposition pour vous fournir tout élément utile et vous aider à rédiger.
>
> **Votre contact dédié.** [Nom, e-mail direct, téléphone.]
>
> [Nom, fonction]

---

## 7. Le cas particulier de la fuite entre clients

C'est le scénario le plus grave du modèle à base partagée, et il appelle des règles propres :

1. **Notifier tous les clients dont les données ont pu être vues, ET celui qui a pu les voir.**
   Les deux sont concernés, pour des raisons différentes.
2. **Ne jamais nommer un client à un autre** dans les notifications.
3. **Couper avant de comprendre** : si l'isolation est en doute, l'indisponibilité est préférable
   à la fuite.
4. **Ne pas rouvrir sans un test automatisé** qui échoue sur le scénario fautif.
5. Considérer par défaut que le risque est **élevé** : il s'agit de données de clientèle et
   d'informations commerciales concurrentielles entre entreprises du même secteur.

---

## 8. Vérification annuelle

Une fois par an, dérouler un exercice à blanc sur un scénario réaliste (par exemple : « un bucket
de documents RH est public depuis trois semaines »), chronométrer chaque étape, et corriger la
procédure sur ce qui a coincé. Consigner l'exercice dans le registre.

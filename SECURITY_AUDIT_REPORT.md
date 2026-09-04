# Audit de sécurité — app-realisations-ltdb (LTDB back-office)

Date : 2026-09-04
Portée : intégralité du code du dépôt (Next.js 14 App Router / Supabase / NextAuth v5).
Méthode : lecture de code (aucune exécution, aucun fichier applicatif modifié). `npm audit` exécuté pour les dépendances.

---

## 1. Cartographie

**Stack** (`package.json`) : Next.js 14.2.35 (App Router), TypeScript, Tailwind, NextAuth v5.0.0-beta.30 (Credentials provider, session JWT), `@supabase/supabase-js` ^2.105.1, `bcryptjs`, Resend (email), Brevo/Twilio (SMS), `@react-pdf/renderer`, Remotion (vidéo), Anthropic/OpenAI/Mistral SDKs (IA), déployé sur Vercel. **Prisma n'est pas utilisé dans le code** malgré la mention dans `CLAUDE.md` (aucun `@prisma/client` importé, aucun fichier `.prisma`) — documentation obsolète, sans impact sécurité.

**Flux de données — serveur vs navigateur :**
- Toutes les lectures/écritures Supabase passent **exclusivement par `SUPABASE_SERVICE_ROLE_KEY`** côté serveur (`lib/supabase.ts`), jamais par une clé `anon` exposée au client. Confirmé par grep exhaustif : aucune occurrence de clé Supabase dans un composant client, aucun `NEXT_PUBLIC_SUPABASE_ANON_KEY` utilisé.
- Conséquence directe : le schéma désactive volontairement RLS sur les tables cœur (`clients`, `techniciens`, `interventions`, `documents`, `factures_fournisseurs` — `supabase/schema.sql:183-187`), en s'appuyant uniquement sur l'auth applicative (NextAuth + middleware). C'est un choix explicite documenté dans les migrations, pas un oubli — mais voir Finding #16 (défense en profondeur).
- Toutes les routes sensibles sont des Route Handlers serveur (`app/api/**/route.ts`), pas de Server Actions exposant des mutations directes.
- Aucune fuite de secret vers le bundle client trouvée : les `NEXT_PUBLIC_*` utilisés (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_LTDB_RC_PRO`, `NEXT_PUBLIC_LTDB_SIRET`) ne portent que des identifiants publics ou des données légales déjà publiques (numéro RC Pro, SIRET).

**Points d'entrée** : ~150 routes API sous `app/api/**`, formulaire de login (`/login`, NextAuth Credentials), 4 flux OAuth (Google/YouTube, Google Business Profile, Facebook/Instagram, TikTok), uploads (photos intervention, vidéos, documents RH, relevés bancaires), 4 crons Vercel (`vercel.json`), webhooks/liens publics sans session (`/api/notify-client/stop-review`, `/api/facture/stop-reminders`, `/api/quote-complementaire/stop-reminders`, `/api/calendar.ics`, `/api/proxy-image`).

**Modèle d'accès** : 3 profils de session — `admin` (gérant), `tech` (technicien terrain, restreint par préfixes dans `lib/auth-routes.ts`), et compte **démo** (`isDemo: true` mais `role: 'admin'` — voir Finding #4). `middleware.ts` protège toutes les routes sauf une liste `PUBLIC_PREFIXES` explicite.

---

## 2. Failles constatées (classées par sévérité)

### 🔴 CRITIQUE

#### F1 — Connexion administrateur sans mot de passe
**Fichier** : `lib/auth-users.ts:26-42` et `:109-113`

```ts
function loadAdmins(): AuthAccount[] {
  ...
  accounts.push({ id: `admin-${i}`, login, role: "admin", passwordHash: null, technicienId: null })
}
...
const admin = admins.find(a => a.login.toLowerCase() === login.toLowerCase())
if (admin) {
  return admin   // ← aucune vérification de mot de passe, le champ `password` soumis est ignoré
}
```
`.env.local.example:5` confirme l'intention : *« Admins (identifiant seul, sans mot de passe) »*, avec `AUTH_USER_1=admin` comme valeur par défaut documentée.

**Exploitation** : l'app est exposée publiquement sur Vercel (`NEXTAUTH_URL=https://app-realisations.vercel.app`). Quiconque visite `/login` et saisit l'identifiant `admin` (valeur documentée par défaut, ou tout autre `AUTH_USER_N` deviné) obtient **une session admin complète** — accès à tous les clients, factures, devis, comptabilité, paie, comptes techniciens, réglages, et à la publication du site public — sans avoir besoin du moindre mot de passe.

**Correctif** : exiger systématiquement un hash bcrypt pour `AUTH_USER_N` (le format `login:hash` est déjà supporté par le parsing de `AUTH_TECH_N`), et vérifier avec `bcrypt.compare` avant de retourner le compte. Exemple de correctif (à valider) :
```ts
// lib/auth-users.ts
function loadAdmins(): { id: string; login: string; passwordHash: string }[] {
  const accounts = []
  for (let i = 1; i <= 10; i++) {
    const entry = process.env[`AUTH_USER_${i}`]
    if (!entry?.trim() || !entry.includes(":")) continue   // refuse le format sans hash
    const [login, hash] = entry.split(":")
    if (!login.trim() || !hash) continue
    accounts.push({ id: `admin-${i}`, login: login.trim(), passwordHash: normalizeBcryptHash(hash) })
  }
  return accounts
}
// puis dans verifyCredentials : bcrypt.compare(pwd, admin.passwordHash) avant de retourner le compte
```
**Action immédiate recommandée** : générer un hash bcrypt fort pour chaque admin (`npx tsx scripts/hash-password.ts "<mot de passe fort>"`), mettre à jour `AUTH_USER_N` sur Vercel avec le format `login:hash`, et considérer la session actuelle comme potentiellement compromise (changer `NEXTAUTH_SECRET` invaliderait toutes les sessions actives).

---

#### F2 — Données personnelles réelles d'une cliente publiées sans authentification
**Fichiers** : `public/recup/ITV-20260724-1513-mirabella.json` (+ `.pdf`), route statique `/recup/*` explicitement listée dans `PUBLIC_PREFIXES` (`middleware.ts:21`), et de toute façon exclue du matcher middleware car elle contient un point (`middleware.ts:134`).

Le fichier JSON (1 Mo), committé en historique git depuis plusieurs commits, contient les coordonnées réelles d'une cliente : nom complet, adresse postale, e-mail personnel et numéro de téléphone (vérifié directement dans le fichier — non reproduits ici pour ne pas dupliquer la fuite dans ce rapport). `app/inspection/page.tsx` génère ce type de fichier avec un nommage prévisible (`ITV-{date}-{heure}-{nom-client-slugifié}.json`) pour tout brouillon d'inspection caméra sauvegardé via cette fonctionnalité.

**Exploitation** : toute personne connaissant ou devinant l'URL (lien partagé, indexation moteur de recherche, historique navigateur, capture d'écran) accède aux données personnelles d'un client sans aucune authentification. **Violation RGPD directe** (donnée d'identification directe + coordonnées personnelles exposées sans consentement, sans contrôle d'accès, sans limite de durée).

**Correctif** :
1. Retirer immédiatement `public/recup/ITV-20260724-1513-mirabella.json` (et `.pdf` s'il contient les mêmes données) du dépôt et de l'historique git (`git filter-repo` ou BFG Repo-Cleaner — action destructive sur l'historique, **à valider avec vous avant exécution**).
2. Retirer `"/recup"` de `PUBLIC_PREFIXES` dans `middleware.ts`.
3. Remplacer le mécanisme de sauvegarde de brouillon par une route API authentifiée (session NextAuth) stockant en base ou dans un bucket Supabase **privé**, jamais dans `public/`.

---

#### F3 — Un technicien peut supprimer (hard-delete) l'intervention de n'importe quel autre technicien
**Fichier** : `app/api/interventions/[id]/route.ts` — handler `DELETE` (~ligne 237-279)

`GET` et `PUT` de ce même fichier appellent bien `requireInterventionAccess`/`assertInterventionAccess` pour vérifier que `session.user.technicienId` correspond au `technicien_id` de l'intervention. **`DELETE` ne fait aucun de ces appels** et va directement en base avec le client `service_role` :
```ts
export async function DELETE(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  ...
  if (hard) {
    const result = await cascadeDeleteIntervention(params.id)   // pas de contrôle de propriété
    ...
  }
  const { data, error } = await sb.from('interventions').update({ statut: 'annulee' }).eq('id', params.id)...
```
`lib/auth-routes.ts` n'autorise l'accès `tech` qu'au niveau du préfixe `/api/interventions` (pas par ressource).

**Exploitation** : un technicien authentifié, connaissant ou obtenant l'UUID d'une intervention d'un collègue, peut appeler `DELETE /api/interventions/<id>?hard=1` et détruire définitivement cette intervention **et tout ce qui en dépend en cascade** (documents, photos, PDF), ou simplement l'annuler.

**Correctif** : ajouter en tête du handler `DELETE` le même contrôle que `GET`/`PUT` :
```ts
const access = await requireInterventionAccess(req, params.id)
if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
```

---

#### F4 — Les comptes démo (role="admin") contournent le contrôle d'accès RH/paie et comptabilité
**Fichiers** : `lib/rh/require-admin.ts`, `lib/demo-access.ts:70-77`, `app/api/comptabilite/**`, `app/api/factures-fournisseurs/**`, `app/api/clients/[id]`, `app/api/historique/[id]`

Un compte démo se voit attribuer `role: 'admin', isDemo: true` (`lib/demo-access.ts:72,75`). `lib/require-owner-admin.ts` (`requireOwnerAdminApi`) exclut explicitement `isDemo` — c'est le motif prévu pour les endpoints sensibles :
```ts
if (session.user.isDemo) {
  return { ok: false as const, status: 403, error: 'Réservé au gérant — pas aux accès démo' }
}
```
Mais **toutes** les routes `app/api/rh/**` utilisent `lib/rh/require-admin.ts` (`requireAdminApi`), qui ne vérifie que `role !== 'admin'` et **jamais `isDemo`** :
```ts
export async function requireAdminApi() {
  const session = await auth()
  if (!session?.user) return { ok: false, status: 401, ... }
  if (session.user.role !== 'admin') return { ok: false, status: 403, ... }
  return { ok: true, session }   // ← un compte démo passe cette vérification
}
```
`middleware.ts` (`demoMgmtBlocked`) ne bloque que `/admin`, `/api/admin`, `/reglages`, `/acces-demo`, `/connexions`, `/api/connexions`, `/api/demo-access` (sauf `/check`) — **`/rh`, `/api/rh`, `/comptabilite`, `/api/comptabilite` n'y figurent pas**.

De plus, les routes suivantes n'ont **aucun** contrôle de rôle dans leur handler (elles s'appuient uniquement sur le fait que middleware bloque `tech` mais laisse passer `admin`/démo) :
- `app/api/clients/[id]/route.ts` (`PATCH`/`DELETE`)
- `app/api/factures-fournisseurs/[id]/route.ts` (`PUT`/`DELETE`)
- `app/api/historique/[id]/route.ts` (`DELETE`/`PATCH` — supprime en cascade intervention + documents + fichiers)
- `app/api/comptabilite/operations/[id]/lettrer`, `.../pre-bilan/[id]/valider`, `.../releves/[id]` (incl. suppression du PDF en storage)
- `app/api/comptabilite/{recettes,plan-comptable,pre-bilan,operations,releves}/route.ts`
- `app/api/export/csv`, `app/api/export/fec`, `app/api/statistiques`

**Exploitation** : tout détenteur d'un accès démo (destiné à des prospects/démonstrations commerciales) peut lire la liste complète des salariés, télécharger leurs bulletins de paie et documents personnels (pièces d'identité), lire/exporter l'intégralité de la comptabilité (relevés bancaires, FEC), et **modifier ou supprimer** des clients, factures fournisseurs, opérations comptables et l'historique métier réels de l'entreprise.

**Correctif** :
1. Remplacer `requireAdminApi()` par `requireOwnerAdminApi()` dans tous les fichiers de `app/api/rh/**`.
2. Ajouter un contrôle `requireOwnerAdminApi()` (au minimum `requireAdminApi()` + rejet explicite `isDemo`) sur toutes les routes listées ci-dessus.
3. En défense en profondeur, étendre `demoMgmtBlocked` dans `middleware.ts` :
```ts
const demoMgmtBlocked =
  pathname.startsWith("/acces-demo")
  || pathname.startsWith("/connexions")
  || pathname.startsWith("/api/connexions")
  || pathname.startsWith("/admin")
  || pathname.startsWith("/api/admin")
  || pathname.startsWith("/reglages")
  || pathname.startsWith("/rh")
  || pathname.startsWith("/api/rh")
  || pathname.startsWith("/comptabilite")
  || pathname.startsWith("/api/comptabilite")
  || pathname.startsWith("/api/factures-fournisseurs")
  || pathname.startsWith("/api/export")
  || (pathname.startsWith("/api/demo-access") && !pathname.startsWith("/api/demo-access/check"))
```
4. À plus long terme : remplacer le flag `isDemo` par un véritable rôle `role: 'demo'` avec liste blanche explicite (symétrique à `isTechApiAllowed`), plutôt qu'une liste noire fragile.

---

#### F5 — Documents RH sensibles et relevés bancaires stockés dans des buckets Supabase publics
**Fichiers** : `app/api/rh/salaries/[id]/documents/route.ts:8`, `app/api/comptabilite/releves/upload/route.ts:10,56`

```ts
const RH_BUCKET = process.env.SUPABASE_RH_BUCKET || process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'
```
Aucune variable `SUPABASE_RH_BUCKET` n'étant documentée/configurée, les documents RH (pièces d'identité, attestations mutuelle — données personnelles sensibles) sont stockés **dans le même bucket public** que les photos de chantier, servis via `getPublicUrl()` (URL permanente, non signée, non expirable), protégés uniquement par la non-devinabilité du chemin.

De même, `app/api/comptabilite/releves/upload/route.ts` stocke les relevés bancaires (IBAN, opérations) dans le bucket `intervention-pdfs`, public lui aussi, via `getPublicUrl()`, avec un chemin protégé par seulement 24 bits d'aléatoire.

**Exploitation** : toute personne obtenant une de ces URLs (log serveur, en-tête `Referer`, historique navigateur, brute-force léger sur 24 bits) accède au document sans authentification.

**Correctif** : créer des buckets Supabase **privés** dédiés (RH, comptabilité), servir via `createSignedUrl()` à durée de vie courte (quelques minutes), exclusivement derrière `requireOwnerAdminApi()`.

---

#### F6 — Secret de production à forte entropie committé dans `.env.local.example`
**Fichier** : `.env.local.example:29` → `LTDB_PUBLISH_TOKEN=<valeur committée, 43 caractères aléatoires>`

Contrairement aux autres variables du fichier (vides ou clairement factices), cette valeur a l'entropie d'un vrai secret et n'a jamais changé dans l'historique git. Elle est utilisée comme jeton `Bearer` pour authentifier la publication de contenu vers le site public Django (`app/api/publish/route.ts`, `app/api/publish/from-intervention/route.ts`, `scripts/republish-intervention.ts`).

**Exploitation** : si cette valeur est identique au secret de production Vercel, toute personne ayant accès au dépôt (contributeur, fork, historique) peut publier/modifier du contenu sur le site public de l'entreprise sans autorisation.

**Correctif** : vérifier sur Vercel si cette valeur correspond au secret réel ; si oui, la **révoquer et régénérer immédiatement côté backend Django**, puis remplacer la ligne par `LTDB_PUBLISH_TOKEN=` (vide) dans `.env.local.example`.

---

### 🟠 ÉLEVÉE

#### F7 — Aucune protection anti brute-force sur le login
**Fichiers** : `lib/auth.ts`, `middleware.ts`, `package.json` (aucune dépendance de rate-limiting)

Aucun compteur de tentatives, aucun verrouillage progressif. Combiné à F1 (admin sans mot de passe) et au fait qu'un exemple de mot de passe technicien documenté est un **PIN à 4 chiffres** (`"1245"`), un compte technicien réel avec un PIN similaire est brute-forçable en quelques minutes sans aucun blocage.

**Correctif** : rate-limit par IP + par login dans `authorize()` (ex. `@upstash/ratelimit` + Vercel KV, ou compteur en base), verrouillage temporaire après N échecs, politique de mot de passe minimale renforcée pour les comptes techniciens (actuellement 8 caractères dans `lib/comptes-tech.ts` — imposer un minimum plus robuste que des PIN numériques).

#### F8 — Flux OAuth (Google/YouTube, GMB, Facebook, TikTok) sans protection CSRF, accessibles sans authentification
**Fichiers** : `app/api/oauth/{google,gmb,facebook,tiktok}/route.ts` + `.../callback/route.ts`, `lib/youtube.ts`, `lib/gmb.ts`, `lib/social.ts`

- `/api/oauth` figure dans `PUBLIC_PREFIXES` (`middleware.ts:26`) : **aucune session n'est requise** pour déclencher ces flux.
- Aucun paramètre `state` cryptographique n'est généré/vérifié. Facebook et TikTok envoient un `state` statique (`"facebook"` / `"tiktok"`) jamais contrôlé au retour ; Google/GMB n'en envoient aucun.
- Les tokens obtenus sont stockés via `upsert(..., { onConflict: "platform" })` — **une seule ligne par plateforme**, sans notion d'utilisateur/tenant.

**Exploitation** : un attaquant non authentifié visite `/api/oauth/google` (ou gmb/facebook/tiktok), complète le consentement OAuth avec **son propre compte**, et le callback (également public) écrase la ligne `social_tokens` de l'entreprise avec les tokens de l'attaquant — détournement des intégrations YouTube / Google Business Profile / Facebook / TikTok de l'entreprise (publication de contenu non désiré, ou déni de service de l'automatisation).

**Correctif** : exiger une session `requireOwnerAdminApi()` sur les routes d'**initiation** (pas seulement le callback) ; générer un `state` aléatoire cryptographique, le stocker en cookie `httpOnly` signé à courte durée de vie, le vérifier strictement au callback avant l'échange du code.

#### F9 — Aucune validation du type réel des fichiers uploadés
**Fichiers** : `app/api/interventions/[id]/photo/route.ts`, `app/api/rh/salaries/[id]/documents/route.ts`, `app/api/techniciens/[id]/photo/route.ts`

L'extension provient du nom de fichier fourni par le client, et le `Content-Type` stocké provient de `file.type` (contrôlé par le client), sans vérification des « magic bytes ». Un utilisateur authentifié à faible privilège (technicien) peut uploader un contenu arbitraire sous une extension `.jpg`/`.pdf`, obtenant une URL publique sur le domaine Supabase du projet — utilisable pour de l'hébergement de contenu malveillant sur une infrastructure de confiance.

**Correctif** : valider le contenu réel du fichier (librairie de détection par magic bytes), whitelister strictement les MIME/extensions acceptés, forcer un `Content-Type` déterminé côté serveur (jamais celui du client), ajouter `Content-Disposition: attachment` et `X-Content-Type-Options: nosniff` sur les objets sensibles.

#### F10 — Fail-open des routes cron si `CRON_SECRET` n'est pas configuré en production
**Fichiers** : les 4 routes sous `app/api/cron/**`

```ts
function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"   // ← fail-open si secret absent hors "production" strict
  ...
}
```
`/api/cron/` est public au niveau du middleware (aucun repli sur `x-internal-auth`/`isInternalApiCall`). Si `CRON_SECRET` n'est pas positionné sur Vercel (erreur de configuration), ou sur un environnement de preview où `NODE_ENV` n'est pas strictement `"production"`, ces routes deviennent accessibles à quiconque sur Internet — annulation de relances de paiement réelles, déclenchement de campagnes SMS, etc.

**Correctif** : à vérifier en priorité — confirmer que `CRON_SECRET` est bien positionné sur le projet Vercel de production. Durcir le code pour qu'une absence de secret soit un refus **inconditionnel**, pas conditionné à `NODE_ENV` :
```ts
function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}
```

---

### 🟡 MOYENNE

#### F11 — Absence de Content-Security-Policy et de Strict-Transport-Security
`next.config.mjs` définit `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, mais aucun CSP ni HSTS n'existe nulle part dans le dépôt (ni `vercel.json`, ni `middleware.ts`).
**Correctif** : ajouter dans `headers()` de `next.config.mjs` :
```js
{ key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'" },
{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
```
(la CSP ci-dessus est un point de départ à affiner selon les ressources externes réellement chargées — Leaflet, polices, etc.)

#### F12 — Fuite systématique de messages d'erreur internes
Motif répété dans au moins 35 fichiers, ex. `app/api/comptabilite/pre-bilan/route.ts:28,42`, `app/api/devis/[id]/accepter/route.ts:64`, `app/api/techniciens/route.ts:70,116` :
```ts
return NextResponse.json({ error: error.message }, { status: 500 })
```
`lib/error-message.ts` (`errorMessage`) centralise le pattern mais ne filtre rien — relaie tel quel les messages Postgres/Supabase bruts (noms de colonnes, contraintes). Exposition limitée aux utilisateurs déjà authentifiés, mais facilite la reconnaissance en cas de compte compromis.
**Correctif** : journaliser le détail côté serveur (`console.error`), renvoyer au client un message générique + code d'erreur opaque, sauf messages de validation explicitement destinés à l'utilisateur.

#### F13 — `/api/health` expose des informations d'infrastructure sans authentification
SHA du commit déployé, région Vercel, fournisseur IA actif, et présence/absence de `RESEND_API_KEY`/`NEXTAUTH_SECRET`, plus un appel live à l'API Resend dont le statut HTTP est relayé.
**Correctif** : réduire la réponse publique à `{ ok: true/false }`, réserver le détail à une requête authentifiée par un secret de monitoring dédié.

#### F14 — Injection de formule CSV/FEC (Excel) via champs libres
`app/api/export/csv/route.ts` et `app/api/export/fec/route.ts` échappent guillemets/retours-ligne mais pas les caractères déclencheurs de formule (`=`, `+`, `-`, `@`) en début de cellule. Un nom de client/fournisseur malveillant, une fois exporté et ouvert dans Excel par le gérant, peut exécuter une formule (ex. exécution de commande via `=cmd|'/c calc'!A0`, ou exfiltration via `HYPERLINK`).
**Correctif** : préfixer d'une apostrophe (`'`) toute cellule dont la valeur commence par `=`, `+`, `-` ou `@` avant l'export.

#### F15 — RLS désactivée sur les tables cœur (défense en profondeur absente)
`supabase/schema.sql:183-187` désactive explicitement RLS sur `clients`, `techniciens`, `interventions`, `documents`, `factures_fournisseurs`. La migration `032_security_rls_remediation.sql` a activé RLS (sans policy, donc fermeture totale pour anon/authenticated) sur seulement 5 autres tables (`comptes_techniciens`, `connexions_log`, `accords_intervention`, `lignes_devis`, `tarifs`). Le raisonnement documenté (l'app n'utilise que `service_role`, qui contourne RLS de toute façon) est **correct aujourd'hui**, mais laisse ces 5 tables cœur totalement ouvertes si une clé `anon` était un jour introduite par erreur (nouveau composant client, script de test, etc.).
**Correctif (SQL à valider avant exécution — voir section 4).**

#### F16 — Fail-open du middleware si aucune variable d'auth n'est configurée
```ts
if (!process.env.AUTH_USER_1 && !process.env.AUTH_TECH_1) {
  return NextResponse.next()   // toute l'app devient publique
}
```
Comportement de repli dangereux en cas d'erreur de configuration Vercel (variables manquantes après un redéploiement, une purge, etc.) : l'app entière devient accessible sans authentification plutôt que de bloquer.
**Correctif** : ne jamais fail-open en production ; si aucune variable n'est définie et `NODE_ENV === 'production'`, retourner une erreur 500 générique plutôt que de laisser passer.

#### F17 — Pas de limite de taille sur les uploads vidéo directs
`app/api/interventions/[id]/video-upload-url/route.ts` : whitelist d'extensions correcte, chemin assaini, mais aucune limite de taille imposée côté serveur pour l'upload direct vers Supabase Storage (contournement volontaire du serveur Vercel). Un technicien authentifié pourrait uploader des fichiers de taille arbitraire de façon répétée.
**Correctif** : configurer une limite de taille objet (`file_size_limit`) directement sur le bucket Supabase.

---

### 🟢 FAIBLE

- **F18** — `app/api/rh/salaries/[id]/documents` accepte tout type MIME par défaut (`application/octet-stream`) : whitelister strictement `application/pdf`, `image/jpeg`, `image/png`.
- **F19** — Mot de passe démo minimum 6 caractères (`lib/demo-access.ts`) vs 8 pour les comptes techniciens — incohérence mineure de politique de mot de passe.
- **F20** — Comptes techniciens définis uniquement par variable d'environnement (sans ligne `comptes_techniciens` en base) conservent toujours toutes les permissions fines (`voir_prix`, `creer_facture`, etc.) — cohérent avec le code actuel, mais à surveiller si l'app doit un jour restreindre un compte env-only.

---

## 3. Dépendances (`npm audit`)

**28 vulnérabilités** : 2 critiques, 15 élevées, 9 modérées, 2 faibles. Les plus pertinentes pour cette app :

| Paquet | Sévérité | Sujet |
|---|---|---|
| `next-auth` / `@auth/core` | **Critique** | Contournement d'authentification (« existence-based auth checks can fail open »), bypass homoglyphe sur normalisation email, cookies OAuth state/nonce/PKCE non liés au provider |
| `next` (14.2.35) | Élevée | Multiples DoS, SSRF via rewrites, cache poisoning, XSS avec CSP nonces, contournement de Middleware/Proxy |
| `fast-uri` | Élevée | SSRF via normalisation IPv6/hostname malformée |
| `pdfjs-dist` | Élevée | Exécution JS arbitraire à l'ouverture d'un PDF malveillant |
| `postcss` | Élevée | Lecture de fichier arbitraire via `sourceMappingURL` |
| `ws`, `nanoid`, `js-yaml`, `glob`, `qs`, `uuid`, `browserslist` | Élevée/Modérée | DoS divers (non directement exploitables à distance sans vecteur applicatif, mais à corriger) |

**Correctif** : mettre à jour `next` et `next-auth` vers les dernières versions patchées de la branche 14.x / 5.x (vérifier les breaking changes du Credentials provider avant upgrade — l'auth étant déjà fragile, tester `lib/auth.ts` intégralement après mise à jour), puis exécuter `npm audit fix` pour le reste et revalider `npm audit` à zéro critique/élevé.

---

## 4. Top 3 des actions prioritaires

1. **Corriger F1 (admin sans mot de passe) immédiatement** — c'est une porte d'entrée totale à l'application, exploitable par quiconque devine ou trouve un identifiant admin. Exiger un hash bcrypt pour tous les `AUTH_USER_N`, régénérer les identifiants, envisager la rotation de `NEXTAUTH_SECRET`.
2. **Retirer la PII cliente exposée publiquement (F2)** et fermer l'accès public à `/recup` — violation RGPD active, en cours d'exposition tant que le fichier reste dans `public/`.
3. **Fermer le contournement RH/comptabilité par les comptes démo (F4)** et l'IDOR de suppression d'intervention (F3) — un compte démo distribué à un prospect ou un technicien malveillant a aujourd'hui accès à la paie, la comptabilité complète, et peut détruire des données métier réelles.

---

## 5. Correctifs SQL proposés (à valider avant exécution — rien n'a été exécuté)

```sql
-- ============================================================
-- 036 — Fermeture RLS des tables cœur (défense en profondeur)
-- Hypothèse inchangée : l'app n'utilise que SUPABASE_SERVICE_ROLE_KEY
-- côté serveur. service_role contourne RLS quoi qu'il arrive ;
-- cette migration ferme uniquement l'accès pour une clé anon/authenticated
-- qui serait introduite par erreur plus tard.
-- Réversible : ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
-- ============================================================

ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.techniciens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures_fournisseurs ENABLE ROW LEVEL SECURITY;

-- Aucune policy créée → anon / authenticated : refus total en lecture/écriture.
-- service_role (utilisé par lib/supabase.ts) : accès inchangé, RLS ne s'applique pas à ce rôle.
```

Ce script est le prolongement direct de `supabase/migrations/032_security_rls_remediation.sql` — même logique, appliquée aux 5 tables restées ouvertes.

---

## 6. Ce qui a été vérifié et jugé correct (pas de faille)

- Aucun `dangerouslySetInnerHTML`, `eval(`, `new Function(`, ni `.innerHTML =` dans tout le dépôt.
- Comparaison des mots de passe partout ailleurs (comptes techniciens env, comptes DB, comptes démo) via `bcrypt.compare` — timing-safe, correctement implémenté.
- Pas d'injection SQL classique (PostgREST, pas de SQL brut) ; le seul usage de `.or()` avec entrée utilisateur (`app/api/clients/route.ts`) neutralise correctement le caractère séparateur `,`.
- Liens publics sans session (`stop-review`, `stop-reminders`) protégés par signature HMAC-SHA256 + expiration + `crypto.timingSafeEqual` — non devinables.
- `app/api/proxy-image` : allowlist stricte par égalité exacte de hostname, pas de SSRF praticable.
- `app/api/static-map` : cible toujours codée en dur (Nominatim/OpenStreetMap), pas de SSRF vers une URL arbitraire.
- Aucun `exec`/`spawn`/`execSync` dans le pipeline de rendu vidéo Remotion exposé en HTTP.
- Cookies NextAuth : configuration par défaut (httpOnly/secure/sameSite), aucune surcharge trouvée.
- CORS : seul `proxy-image` fixe `Access-Control-Allow-Origin: *`, sans credentials — pas d'autre route à risque.
- Aucun secret hardcodé trouvé dans le code applicatif (`.ts`/`.tsx`) en dehors du cas `.env.local.example` (F6).

---

*Rapport produit par audit statique du code. Aucun fichier applicatif n'a été modifié. Les correctifs ci-dessus sont proposés pour revue — aucun n'a été appliqué.*

# Audit de sécurité — app-realisations-ltdb (back-office Les Techniciens du Débouchage)

Date : 2026-09-04 · Périmètre : intégralité du dépôt · Méthode : lecture de code uniquement.
**Aucun fichier applicatif modifié, aucune requête SQL exécutée, aucun correctif appliqué.**
Chaque constat ci-dessous a été vérifié directement dans le fichier cité.

---

## 1. Cartographie

**Stack réelle** (`package.json`) : Next.js 14.2.35 App Router · TypeScript · Tailwind · NextAuth v5.0.0-beta.30 (provider Credentials, session JWT) · `@supabase/supabase-js` ^2.105.1 · bcryptjs · Resend (mail) · Brevo/Twilio (SMS) · `@react-pdf/renderer` · Remotion (vidéo) · SDK Anthropic/OpenAI/Mistral · déploiement Vercel.

> ⚠️ **Écart avec la doc** : `CLAUDE.md` et le contexte maître annoncent **Prisma** comme ORM. Prisma n'est **pas utilisé** dans ce dépôt (aucun import `@prisma/client`, aucun fichier `.prisma`) — tout passe par `supabase-js`. Sans impact sécurité, mais la doc est à corriger.

**Où tournent les requêtes — serveur vs navigateur :**
- 100 % des accès base passent par `lib/supabase.ts` → `SUPABASE_SERVICE_ROLE_KEY`, **côté serveur uniquement**. Aucune clé `anon` n'est utilisée nulle part dans le code, aucun composant client n'instancie de client Supabase. **Pas de fuite de clé vers le navigateur.**
- Les seules variables `NEXT_PUBLIC_*` employées portent des données publiques : `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL` (URL, pas clé), `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (un client ID OAuth n'est pas un secret), `NEXT_PUBLIC_LTDB_SIRET`, `NEXT_PUBLIC_LTDB_RC_PRO` (mentions légales). **Rien de sensible.**
- Conséquence assumée par le code : RLS désactivée sur les tables cœur (`supabase/schema.sql:183-187`), la sécurité repose **entièrement** sur l'auth applicative (NextAuth + `middleware.ts`). D'où la gravité des failles d'authentification ci-dessous : il n'existe aucune seconde barrière côté base.

**Points d'entrée** : 138 routes API (`app/api/**/route.ts`), le formulaire de login, 4 flux OAuth (Google/YouTube, GMB, Facebook/Instagram, TikTok), 5 types d'upload, 4 crons Vercel, et 8 préfixes publics sans session (`middleware.ts:19-32`) : `/login`, `/mirabella`, `/recup`, `/api/auth`, `/api/health`, `/api/calendar.ics`, `/api/oauth`, `/api/proxy-image`, les liens de désinscription, `/api/cron/`.

**Modèle d'accès** : rôles `admin` et `tech`, plus un flag `isDemo`. Les techniciens sont restreints par liste blanche de préfixes (`lib/auth-routes.ts`) ; l'accès aux ressources est vérifié par `lib/intervention-access.ts` (`assertInterventionAccess` compare `technicien_id` à la session). Les comptes démo reçoivent `role: 'admin'` et ne sont restreints que par une **liste noire** dans le middleware — c'est la racine des failles C3.

---

## 2. Failles constatées

### 🔴 CRITIQUE

#### C1 — N'importe qui peut se connecter en administrateur sans mot de passe
**`lib/auth-users.ts:109-113`** (et `:26-42`)

```ts
const admins = loadAdmins()
const admin = admins.find(a => a.login.toLowerCase() === login.toLowerCase())
if (admin) {
  return admin        // ← retour immédiat : le mot de passe soumis n'est JAMAIS vérifié
}
```
`loadAdmins()` construit chaque compte avec `passwordHash: null`, et le commentaire l.25 l'assume : *« hash ignoré → admin sans MDP »*. `.env.local.example:6` documente la valeur par défaut : `AUTH_USER_1=admin`.

**Ce qu'un attaquant fait concrètement** : il ouvre l'URL Vercel de l'app, saisit `admin` dans le champ identifiant, laisse le mot de passe vide, et obtient une session administrateur complète. Il accède alors à tout : fichiers clients (nom, adresse, téléphone, email), factures et devis, comptabilité et relevés bancaires, bulletins de paie, comptes techniciens, et la publication de contenu sur le site public. Aucune connaissance préalable n'est requise au-delà d'un identifiant courant (`admin`).

**Correctif proposé** (non appliqué) :
```ts
// lib/auth-users.ts — exiger login:hash pour les admins comme pour AUTH_TECH_*
function loadAdmins(): { id: string; login: string; passwordHash: string }[] {
  const accounts = []
  for (let i = 1; i <= 10; i++) {
    const entry = process.env[`AUTH_USER_${i}`]
    if (!entry?.trim() || !entry.includes(":")) continue   // refuse le format sans hash
    const [login, hash] = [entry.slice(0, entry.indexOf(":")).trim(), entry.slice(entry.indexOf(":") + 1)]
    if (!login || !hash) continue
    accounts.push({ id: `admin-${i}`, login, passwordHash: normalizeBcryptHash(hash) })
  }
  return accounts
}

// puis dans verifyCredentials(), à la place du retour immédiat :
if (admin) {
  const pwd = password ?? ""
  if (!pwd) return null
  const valid = await bcrypt.compare(pwd, admin.passwordHash)
  if (!valid) return null
  return { ...admin, role: "admin", technicienId: null }
}
```
**Action** : générer un hash fort (`npx tsx scripts/hash-password.ts "<mot de passe>"`), passer `AUTH_USER_N` au format `login:hash` sur Vercel, et considérer que des sessions non autorisées ont pu être ouvertes (rotation de `NEXTAUTH_SECRET` pour toutes les invalider).

---

#### C2 — Données personnelles d'une cliente réelle accessibles publiquement
**`public/recup/ITV-20260724-1513-mirabella.json`** (1 Mo) et le `.pdf` associé.

Le fichier contient les coordonnées réelles d'une cliente : nom, adresse postale, e-mail personnel et numéro de mobile (vérifiés dans le fichier ; non recopiés ici pour ne pas dupliquer la fuite). Il est doublement exposé :
- `/recup` est déclaré public dans `middleware.ts:21` ;
- tout fichier contenant un point est de toute façon exclu du matcher middleware (`middleware.ts:134`), et `public/` est servi en statique par Next.js.

Le mécanisme est générique : `app/inspection/page.tsx` lit/écrit les brouillons d'inspection caméra sous `/recup/{slug}.json`, avec un nom **prévisible** (`ITV-{date}-{heure}-{nom-client}`).

**Ce qu'un attaquant fait concrètement** : il récupère l'URL (indexation moteur, en-tête `Referer`, lien partagé, ou en devinant le motif de nommage) et obtient l'identité complète et les coordonnées d'un client, plus le détail technique de l'inspection. **Violation RGPD en cours** tant que le fichier reste en place.

**Correctif proposé** : supprimer le JSON de `public/` **et** de l'historique git (`git filter-repo`/BFG — réécriture d'historique, à valider avec vous avant toute exécution) ; retirer `"/recup"` de `PUBLIC_PREFIXES` ; déplacer la sauvegarde de brouillon vers une route API authentifiée écrivant en base ou dans un bucket privé.

---

#### C3 — Les comptes démo ont un accès administrateur complet à la paie et à la comptabilité
**`lib/demo-access.ts:72`** attribue `role: 'admin'` aux accès démo. Deux garde-fous coexistent, et le mauvais est utilisé aux endroits sensibles :

| Helper | Vérifie `isDemo` ? | Utilisé par |
|---|---|---|
| `lib/require-owner-admin.ts` | ✅ oui, rejette la démo | `/api/admin/comptes-tech`, `/api/demo-access`, `/api/tarifs` |
| `lib/rh/require-admin.ts` | ❌ **non** | **toutes** les routes `/api/rh/**` (paie) |

```ts
// lib/rh/require-admin.ts — un compte démo passe cette vérification
if (session.user.role !== 'admin') { return { ok: false, status: 403, ... } }
return { ok: true as const, session }
```

Pire, une série de routes n'effectue **aucun** contrôle de rôle dans son handler et s'appuie uniquement sur le middleware (qui laisse passer la démo) — vérifié fichier par fichier :

| Route | Handlers sans contrôle |
|---|---|
| `app/api/clients/[id]/route.ts` | `GET`, `PATCH`, `DELETE` |
| `app/api/historique/[id]/route.ts` | `GET`, `DELETE` (cascade), `PATCH` |
| `app/api/factures-fournisseurs/[id]/route.ts` | `PUT`, `DELETE` |
| `app/api/comptabilite/**` (11 routes) | toutes, y compris `releves/upload` et `releves/[id]` (DELETE) |
| `app/api/export/csv`, `export/fec`, `statistiques` | toutes |

Et `middleware.ts:90-97` (`demoMgmtBlocked`) ne bloque que `/admin`, `/reglages`, `/connexions`, `/acces-demo`, `/api/demo-access` — **ni `/rh`, ni `/comptabilite`**.

**Ce qu'un attaquant fait concrètement** : toute personne à qui un accès démo a été remis (prospect, démonstration commerciale) liste les salariés, télécharge leurs bulletins de paie et documents personnels, exporte l'intégralité de la comptabilité (FEC, relevés bancaires), et **modifie ou supprime** des clients, factures fournisseurs et interventions réels.

**Correctif proposé** :
```ts
// 1) lib/rh/require-admin.ts — aligner sur requireOwnerAdminApi
if (session.user.isDemo) {
  return { ok: false as const, status: 403, error: 'Réservé au gérant — pas aux accès démo' }
}

// 2) middleware.ts — défense en profondeur
const demoMgmtBlocked =
  pathname.startsWith("/acces-demo") || pathname.startsWith("/connexions")
  || pathname.startsWith("/api/connexions") || pathname.startsWith("/admin")
  || pathname.startsWith("/api/admin") || pathname.startsWith("/reglages")
  || pathname.startsWith("/rh") || pathname.startsWith("/api/rh")
  || pathname.startsWith("/comptabilite") || pathname.startsWith("/api/comptabilite")
  || pathname.startsWith("/api/factures-fournisseurs") || pathname.startsWith("/api/export")
  || (pathname.startsWith("/api/demo-access") && !pathname.startsWith("/api/demo-access/check"))

// 3) ajouter requireOwnerAdminApi() en tête des handlers du tableau ci-dessus
```
À terme : remplacer le flag `isDemo` par un vrai rôle `'demo'` avec **liste blanche** (comme `isTechApiAllowed`), une liste noire étant structurellement fragile.

---

#### C4 — Secret de production committé dans `.env.local.example`
**`.env.local.example:29`** — `LTDB_PUBLISH_TOKEN` porte une chaîne aléatoire de 43 caractères (les autres variables du fichier sont vides ou factices), inchangée depuis son unique commit. Ce jeton sert de `Bearer` pour publier du contenu sur le site Django public (`app/api/publish/route.ts`, `app/api/publish/from-intervention/route.ts`).

**Je ne peux pas confirmer depuis le dépôt** que cette valeur est bien celle de production — c'est à vérifier dans les variables Vercel. Si c'est le cas, toute personne ayant accès au dépôt (contributeur, fork, historique) peut publier ou modifier du contenu sur lestechniciensdudebouchage.fr.

**Correctif** : comparer avec la variable Vercel ; si identique → révoquer et régénérer côté Django, puis vider la ligne (`LTDB_PUBLISH_TOKEN=`).

---

### 🟠 ÉLEVÉE

#### E1 — Un technicien peut supprimer définitivement l'intervention de n'importe quel collègue
**`app/api/interventions/[id]/route.ts:237-279`**

Dans ce même fichier, `GET` (l.51) et `PUT` (l.124) appellent `assertInterventionAccess` / `requireInterventionAccess`. **`DELETE` n'appelle ni l'un ni l'autre** et attaque directement la base en `service_role` :
```ts
export async function DELETE(req: NextRequest, { params }: Params) {
  const sb = getSupabaseOrNull()
  ...
  if (hard) {
    const result = await cascadeDeleteIntervention(params.id)   // aucun contrôle de propriété
```
`lib/auth-routes.ts` n'autorise `tech` qu'au niveau du préfixe `/api/interventions`, jamais par ressource.

**Concrètement** : un technicien authentifié appelle `DELETE /api/interventions/<uuid>?hard=1` sur l'intervention d'un collègue et détruit irréversiblement l'intervention, ses documents, ses photos et ses PDF (`cascadeDeleteIntervention`).
*(Sévérité Élevée et non Critique : un compte technicien valide est nécessaire — mais l'impact est une destruction irréversible de données métier.)*

**Correctif** : ajouter en tête du `DELETE` le contrôle déjà présent dans `PUT` :
```ts
const access = await requireInterventionAccess(req, params.id)
if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
```

#### E2 — Flux OAuth détournables : ni authentification, ni paramètre `state`
**`app/api/oauth/{google,gmb,facebook,tiktok}/route.ts`** + callbacks · `lib/gmb.ts:66-78`, `lib/youtube.ts`, `lib/social.ts`

Vérifié sur GMB (identique sur les 3 autres) : la route d'initiation est un simple `NextResponse.redirect(await getAuthUrl())` sans session (le préfixe `/api/oauth` est public, `middleware.ts:26`) ; le callback lit `code` et appelle `exchangeCodeAndStore(code)` **sans vérifier aucun `state`** (Facebook/TikTok envoient un `state` statique `"facebook"`/`"tiktok"`, jamais recontrôlé). Les jetons sont ensuite écrits avec `onConflict: "platform"` — **une seule ligne par plateforme**, sans notion d'utilisateur.

**Concrètement** : un inconnu ouvre `/api/oauth/gmb`, donne son consentement avec **son propre** compte Google, et le callback écrase la ligne `social_tokens` de l'entreprise avec ses jetons. Les publications automatiques (fiche Google Business, YouTube, Facebook, TikTok) partent alors sur le compte de l'attaquant, ou cessent de fonctionner.

**Correctif** : exiger `requireOwnerAdminApi()` sur les routes d'**initiation** ; générer un `state` aléatoire (`crypto.randomBytes(32)`), le stocker en cookie `httpOnly`+`secure`+`sameSite=lax` à courte durée, et le comparer strictement au retour avant l'échange du code.

#### E3 — Aucune protection contre le bruteforce du login
Aucune dépendance ni code de rate-limiting dans tout le dépôt (`upstash`, `@vercel/kv`, throttle : **0 occurrence**). Combiné à C1 et au fait que le mot de passe technicien d'exemple documenté est un **PIN à 4 chiffres** (`"1245"`, `.env.local.example:9-12`), un compte technicien utilisant un PIN similaire tombe en quelques minutes.
**Correctif** : rate-limit par IP **et** par identifiant dans `authorize()`, verrouillage progressif après N échecs, politique de mot de passe interdisant les PIN numériques courts.

#### E4 — Documents RH et relevés bancaires exposés via des URL publiques permanentes
**`app/api/rh/salaries/[id]/documents/route.ts:8,54`** — le bucket retombe sur celui des photos publiées :
```ts
const RH_BUCKET = process.env.SUPABASE_RH_BUCKET || process.env.SUPABASE_PHOTOS_BUCKET || 'interventions-photos'
...
const { data: pub } = sb.storage.from(RH_BUCKET).getPublicUrl(path)   // URL permanente, non signée
```
`SUPABASE_RH_BUCKET` n'est documentée nulle part : par défaut, permis de conduire et attestations mutuelle atterrissent **dans le bucket des photos de chantier**, avec une URL permanente non expirable et un chemin prévisible (`rh/{id}/{type}-{timestamp}.ext`).

**`app/api/comptabilite/releves/upload/route.ts:10,56`** — même schéma pour les relevés bancaires (IBAN, opérations) dans `intervention-pdfs`, chemin protégé par seulement 24 bits d'aléatoire (`crypto.randomBytes(3)`). **Cette route n'a par ailleurs aucun contrôle de rôle** (cf. C3).

> **Point que je ne peux pas trancher depuis le code** : `getPublicUrl()` ne produit une URL réellement accessible que si le bucket est configuré public dans Supabase. Le partage avec le bucket des photos publiées sur le site rend cette hypothèse très probable, mais **à confirmer dans le dashboard Supabase** (Storage → buckets → visibilité).

**Correctif** : buckets privés dédiés (RH, comptabilité), accès par `createSignedUrl()` de courte durée, derrière `requireOwnerAdminApi()`.

#### E5 — Dépendances vulnérables (`npm audit` : 28 vulnérabilités — 2 critiques, 15 élevées)
| Paquet | Sévérité | Sujet |
|---|---|---|
| `next-auth` / `@auth/core` | **Critique** | *Auth.js : des erreurs de configuration peuvent faire échouer « en ouvert » les vérifications d'authentification*, bypass homoglyphe, cookies OAuth state/nonce/PKCE non liés au provider |
| `next` 14.2.35 | Élevée | DoS multiples, SSRF via rewrites, cache poisoning, contournement Middleware/Proxy |
| `pdfjs-dist` | Élevée | Exécution de JS arbitraire à l'ouverture d'un PDF piégé |
| `postcss`, `fast-uri`, `ws`, `js-yaml`, `nanoid`, `glob`, `qs` | Élevée/Modérée | Lecture de fichier, SSRF, DoS |

La CVE `next-auth` est particulièrement mal placée ici : elle aggrave un socle d'authentification déjà défaillant (C1).
**Correctif** : monter `next` et `next-auth` aux versions corrigées, **puis retester intégralement le login** (provider Credentials en beta), enfin `npm audit fix` pour le reste.

---

### 🟡 MOYENNE

| # | Faille | Fichier | Correctif |
|---|---|---|---|
| M1 | **Type de fichier jamais validé** : extension issue du nom client, `contentType` issu de `file.type` (client), aucun contrôle des magic bytes | `interventions/[id]/photo/route.ts:75,84` · `rh/salaries/[id]/documents/route.ts:42,47` · `techniciens/[id]/photo` | Détection par magic bytes, liste blanche MIME stricte, `Content-Type` imposé côté serveur |
| M2 | **Crons fail-open** : `if (!secret) return process.env.NODE_ENV !== "production"` — sans `CRON_SECRET`, les 4 crons deviennent publics hors prod stricte (préfixe `/api/cron/` public, `middleware.ts:31`) | les 4 `app/api/cron/**` | `if (!secret) return false` inconditionnel + vérifier que `CRON_SECRET` est bien positionné sur Vercel |
| M3 | **CSP et HSTS absents** (0 occurrence dans tout le dépôt ; les 4 autres en-têtes sont bien présents) | `next.config.mjs` | Ajouter `Content-Security-Policy` (démarrer en `Report-Only`) et `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| M4 | **Fuite de messages d'erreur internes** : **47 routes sur 138** renvoient `error.message` brut (messages Postgres : noms de colonnes, contraintes). `lib/error-message.ts` centralise le motif sans rien filtrer | ex. `comptabilite/pre-bilan/route.ts:28,42` · `techniciens/route.ts:70,116` | Logger le détail côté serveur, renvoyer un message générique + code opaque |
| M5 | **`/api/health` public** : SHA du commit, région Vercel, présence de `NEXTAUTH_SECRET`/`RESEND_API_KEY`, statut de vérification du domaine Resend, et appel live à l'API Resend | `app/api/health/route.ts:63-95` | Réponse publique réduite à `{ ok }`, détail réservé à un secret de monitoring |
| M6 | **Injection de formule CSV/FEC** : `csvCell()` échappe guillemets et retours ligne mais pas `=`, `+`, `-`, `@` en début de cellule ; les colonnes Client/Fournisseur/Description sont des saisies libres, ouvertes dans Excel par le gérant | `export/csv/route.ts:8-18` · `export/fec/route.ts:32-35` | Préfixer d'une apostrophe toute cellule commençant par `=+-@` |
| M7 | **RLS désactivée sur les 5 tables cœur** (`clients`, `techniciens`, `interventions`, `documents`, `factures_fournisseurs`). Cohérent tant que seule la `service_role` est utilisée, mais aucune barrière si une clé `anon` était introduite plus tard | `supabase/schema.sql:183-187` | SQL en §4 (à valider) |
| M8 | **Middleware fail-open** : sans `AUTH_USER_1` ni `AUTH_TECH_1`, toute l'app devient publique | `middleware.ts:39-41` | En production, refuser au lieu de laisser passer |

### 🟢 FAIBLE
- **Upload vidéo direct sans limite de taille applicative** (`interventions/[id]/video-upload-url` : extensions bien filtrées et accès bien vérifié, mais l'upload va directement au Storage) → fixer `file_size_limit` sur le bucket Supabase.
- **Documents RH** : aucun filtre MIME (`application/octet-stream` par défaut) → restreindre à PDF/JPEG/PNG.
- **Mot de passe démo : 6 caractères minimum** contre 8 pour les techniciens → aligner.

---

## 3. Top 3 des actions prioritaires

1. **C1 — Remettre un mot de passe sur les comptes admin.** C'est une porte ouverte : l'identifiant `admin` suffit aujourd'hui à prendre le contrôle total de l'application depuis Internet. Tout le reste est secondaire tant que ce point tient.
2. **C2 — Retirer le fichier de PII cliente de `public/recup/`** (dépôt + historique git) et fermer le préfixe `/recup`. C'est une fuite de données personnelles active, avec exposition RGPD directe.
3. **C3 — Couper l'accès des comptes démo à la paie et à la comptabilité** (`lib/rh/require-admin.ts` + contrôles manquants sur ~20 routes), et **corriger E1** (suppression d'intervention sans contrôle de propriété) dans la foulée — même famille de problème : des routes qui font confiance au middleware au lieu de vérifier le demandeur.

---

## 4. Correctif SQL proposé — **à valider, non exécuté**

```sql
-- ============================================================
-- 036 — Fermeture RLS des tables cœur (défense en profondeur)
-- Prolonge 032_security_rls_remediation.sql, même logique.
-- L'app n'utilise que SUPABASE_SERVICE_ROLE_KEY, qui contourne RLS :
-- aucun impact fonctionnel attendu. Ferme l'accès pour une clé
-- anon/authenticated qui serait introduite par erreur plus tard.
-- Réversible : ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
-- ============================================================

ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.techniciens           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interventions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures_fournisseurs ENABLE ROW LEVEL SECURITY;

-- Aucune policy créée → anon/authenticated : refus total.
-- service_role : accès inchangé (RLS ne s'applique pas à ce rôle).
```
À exécuter **après** avoir confirmé qu'aucun autre service (site Django, script, outil BI) ne lit ces tables avec une clé `anon`.

---

## 5. Vérifié et jugé correct

- **Contrôle de propriété des interventions** : `assertInterventionAccess` est correctement appelé dans `GET`/`PUT` de `interventions/[id]`, l'upload photo (l.35), `video-upload-url` (l.26), et les routes `accords/[id]` — **seul `DELETE` fait exception** (E1).
- **Cloisonnement technicien** : `PUT` interdit à un `tech` de modifier autre chose que `statut` (l.155-160) ; `GET` masque `prix_prevu` si la permission `voir_prix` est absente (l.101-104). Bien fait.
- **Hachage des mots de passe** : partout où un mot de passe existe (`AUTH_TECH_*`, comptes techniciens en base, accès démo), la vérification passe par `bcrypt.compare` — jamais de comparaison en clair.
- **Liens publics de désinscription** (`stop-review`, `stop-reminders`) : signature HMAC-SHA256 + expiration + `timingSafeEqual`. Non devinables. Correct.
- **Pas d'injection SQL** : PostgREST, pas de SQL brut ; le seul `.or()` alimenté par l'utilisateur (`clients/route.ts:60-66`) neutralise bien le séparateur `,`.
- **Pas de XSS dans ce dépôt** : 0 occurrence de `dangerouslySetInnerHTML`, `eval(`, `new Function(`, `innerHTML =`. *(Le rendu final des rapports publiés se fait côté Django, hors périmètre — à auditer séparément : `lib/publish-sanitize.ts` n'échappe pas les caractères HTML avant envoi.)*
- **Pas de SSRF** : `proxy-image` filtre par égalité exacte de hostname ; `static-map` cible des URL codées en dur (OpenStreetMap).
- **Pas d'injection de commande** : aucun `exec`/`spawn` dans une route API.
- **Cookies NextAuth** : configuration par défaut (httpOnly, secure, sameSite), aucune surcharge.
- **CORS** : seul `proxy-image` pose `Access-Control-Allow-Origin: *`, sans credentials — approprié pour des images.

---

## 6. Ce que je ne peux pas déterminer depuis le code

1. **Visibilité réelle des buckets Supabase** (`interventions-photos`, `intervention-pdfs`) — conditionne la gravité de E4. À vérifier dans le dashboard.
2. **Si `CRON_SECRET` est positionné sur Vercel** — conditionne l'exploitabilité de M2.
3. **Si `LTDB_PUBLISH_TOKEN` du fichier example est bien le secret de production** — conditionne C4.
4. **Si l'app est réellement joignable publiquement** (pas de protection Vercel type Password/SSO en amont) — cela ne change pas la gravité de C1, mais bien son exploitabilité immédiate depuis Internet.

---

*Audit statique. Aucun fichier applicatif modifié, aucun correctif appliqué, aucun SQL exécuté — tout est proposé pour validation.*

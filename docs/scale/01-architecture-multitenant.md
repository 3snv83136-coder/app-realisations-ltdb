# Architecture multi-tenant — du CRM LTDB au produit SaaS artisan

> Document d'architecture. Aucun fichier applicatif n'est modifié par ce document.
> Cible : un seul code, une seule base Postgres/Supabase, N entreprises clientes.
> Base de l'analyse : 138 routes `app/api/**/route.ts`, 36 migrations, schéma `supabase/schema.sql`.

---

## 1. Inventaire des obstacles au multi-tenant

### 1.1 Effort FAIBLE — constantes d'identité à déplacer en données

| Emplacement | Contenu figé | Remarque |
|---|---|---|
| `lib/entreprise.ts:6-21` | `LTDB_SIREN`, `LTDB_SIRET`, `LTDB_RCS`, `LTDB_TVA_INTRACOM`, `LTDB_FORME_JURIDIQUE`, `LTDB_BANK` (IBAN + BIC en clair) | Cœur du problème : 6 constantes exportées, importées partout |
| `lib/entreprise.ts:24-29` | `FACTURE_MENTIONS_LEGALES` | Dépend du régime (EI vs SARL, franchise TVA vs assujetti) |
| `lib/emetteur.ts:19-30` | `LTDB_EMETTEUR` : raison sociale, adresse `700 Avenue du 15ème Corps / 83200 Toulon`, email `contact@lestechniciensdudebouchage.fr` | Objet `EmetteurData` déjà bien isolé — c'est le point d'injection idéal |
| `lib/parametres.ts:10` | `TEL_PRINCIPAL_FALLBACK = '07 83 63 68 35'` | Fallback synchrone utilisé dans les PDF |
| `lib/parametres.ts:71,80` | `OWNER_NOTIFY_EMAIL` fallback `LesTechniciensDuDebouchage@gmail.com` | |
| `lib/review-url.ts:3-5` | `https://g.page/r/CascWzNKHgyEEAE/review` | Lien avis Google du client actuel |
| `lib/agences.ts:1-9` | 7 agences en `as const` → type TypeScript `Agence` | Bloquant : le *type* est dérivé des données. À passer en `string` + table `agences` |
| `lib/villes-var.ts:5-135` | 101 communes du Var | Un client à Lille n'a rien à faire là |
| `lib/catalogue-prestations.ts:17-25` | 7 prestations **avec prix** (`pu_ht: 199`, `90`, `119`…) | Viole la règle R2 même en mono-tenant : fallback hors-ligne codé en dur |
| `remotion/types.ts:34-49` | `BRAND` : couleurs, slogan `Débouchage Var 24h/24 dès 99€ TTC`, tél, site, `logoUrl`, `camionUrl`, `musicUrl` | Prix dans un slogan |
| `components/PdfBranding.tsx:104,110` | `siteUrl` par défaut + kicker `Les Techniciens du Débouchage` | |
| `components/AttestationPDF.tsx:27-36` | objet `FIRM` (site, `rcPro` via `NEXT_PUBLIC_LTDB_RC_PRO`) | |
| `components/InspectionCameraPDF.tsx:339,353`, `components/RealisationPDF.tsx:485,553`, `components/terrain/TravauxSupplementairesPDF.tsx:44`, `components/rh/RhDocumentsPDF.tsx:57,68,125,343`, `components/rh/BulletinPaiePDF.tsx:148` (`NAF : 8122Z`) | Raison sociale / SIRET / NAF inline dans le JSX | ~15 points |
| `public/manifest.json:2,13,19,35,47,59` | Nom PWA + icônes pointant `lestechniciensdudebouchage.fr` | Manifest doit devenir une route dynamique |
| `.env.local.example:31-36` | `LTDB_SIREN`, `LTDB_SIRET`, `NEXT_PUBLIC_LTDB_SIRET`, `LTDB_TVA_INTRACOM` | Identité en variables d'env = 1 déploiement par client |
| `app/api/export/fec/route.ts:188-190` | `process.env.LTDB_SIREN \|\| '484791546'` — nom de fichier FEC | Le FEC est nominatif : faux SIREN = export invalide |

**Emails** : ~14 routes construisent le `from` en dur, ex. `app/api/notify-facture/route.ts:52`, `notify-devis/route.ts:108`, `notify-attestation/route.ts:51`, `notify-rapport/route.ts:57`, `notify-inspection/route.ts:52`, `quote-complementaire/route.ts:107,123`, `comptabilite/pre-bilan/envoyer/route.ts:81`, `notify-rapport-facture/route.ts:326` — toutes sous la forme `` `Les Techniciens du Débouchage <${fromEmail}>` ``. Les pieds de mail répètent `Les Techniciens du Débouchage · ${tel} · lestechniciensdudebouchage.fr` (`notify-facture:191`, `notify-devis:230`, `notify-rapport:121`, `notify-inspection:148`, `notify-attestation:119`).

**Prompts IA** : `app/api/generate-facture/route.ts:71` et `app/api/generate-devis/route.ts:70` décrivent le métier (« débouchage et assainissement », « LTDB », « Var ») dans le system prompt. Multi-métier ⇒ prompt paramétré par tenant.

### 1.2 Effort MOYEN — structures qui supposent un seul émetteur

- **Numérotation** : `supabase/migrations/019_document_sequences.sql:7-13` — clé primaire `(doc_type, year)`, sans tenant. `lib/numero.ts:61-64` appelle `allocate_document_number(p_type, p_year)`. Deux tenants partageraient le même compteur → `FA-2026-0001` attribué une seule fois pour tout le monde. Voir §4.
- **Unicité globale** : `migrations/020_documents_numero_unique.sql:6-8` (`unique (type, numero)`), `schema.sql:47` (`interventions.reference unique`), `005_accord_intervention.sql:44` (`tarifs.type unique`), `:75` (`accords.reference unique`), `:110` (`sms_token unique`), `:123` (`local_id unique`), `026_comptes_techniciens.sql:7` (`login unique`), `024_demo_access.sql:5` (`login unique`), `010_releves_pre_bilan.sql:82,105`, `033_relances_planifiees.sql:28`. Toutes ces contraintes doivent devenir `unique (tenant_id, …)`.
- **`parametres`** (`003_mode_terrain.sql:64-69`) : PK = `cle` seule. C'est le magasin clé/valeur de l'app (TEL_PRINCIPAL, EMAIL_COMPTABLE, google_review_url, et l'identité KBIS via `009_entreprise_kbis.sql`). Multi-tenant : PK `(tenant_id, cle)`.
- **`social_tokens`** (`002_video_generation.sql:40-51`) : `unique (platform)` — un seul compte YouTube/GMB/Meta pour toute la plateforme. Chaque artisan a les siens.
- **Storage** : buckets fixes `intervention-pdfs`, `interventions-photos`, `intervention-videos`, `accords-pdfs` (`lib/video-storage.ts:4`, `lib/terrain-pdf-server.ts:12`, `lib/cascadeDelete.ts:3-4`, `app/api/accords/route.ts:10`, `app/api/accords/[id]/pdf/route.ts:8`, `app/api/accords/[id]/valider/route.ts:9`, `app/api/interventions/[id]/photo/route.ts:13`, `app/api/rh/salaries/[id]/documents/route.ts:8`…). Pas de préfixe tenant dans les chemins d'objets.
- **Références métier** : `app/api/interventions/route.ts:72` et `app/api/generate/route.ts:72` et `app/api/devis/[id]/accepter/route.ts:34` génèrent `LTDB-YYYYMMDD-HHMM`. Le préfixe doit venir du tenant.
- **Crons** (`vercel.json:8-25`) : 4 crons globaux (`compta-releve-alert`, `controle-taux-paie`, `avis-sms-relances`, `annuler-relances-factures-payees`). Ils itèrent aujourd'hui sur toute la base ; en multi-tenant ils doivent boucler **par tenant** et ne pas s'arrêter au premier échec.

### 1.3 Effort LOURD — le socle

1. **Authentification hors base** (`lib/auth-users.ts:26-42, 55-77`) : les admins sont des `AUTH_USER_N` **sans mot de passe** (`passwordHash: null`, retour direct ligne 112 sans vérification). Les techniciens sont des `AUTH_TECH_N=login:bcrypt`. Impossible à multiplier : chaque nouveau client demanderait des variables d'environnement Vercel et un redéploiement, et surtout **aucun utilisateur ne porte de tenant**. `lib/auth.ts:46-53` construit une session `{id, name, role, technicienId, isDemo, isDbTech}` — il manque `tenantId`.
2. **Absence totale de colonne de rattachement** : aucune des 23 tables (`clients`, `interventions`, `documents`, `techniciens`, `tarifs`, `parametres`, `accords_intervention`, `lignes_devis`, `salaries`, `fiches_paie`, `comptes_bancaires`, `operations_bancaires`, `releves_bancaires`, `pre_bilans`, `factures_fournisseurs`, `document_counters`, `social_tokens`, `demo_access`, `comptes_techniciens`, `connexions_log`, `relances_planifiees`, `salarie_documents*`) ne porte de `tenant_id`.
3. **RLS neutralisée par conception** : `schema.sql:183-187` (`disable row level security` sur les 5 tables cœur) ; `032_security_rls_remediation.sql:21-31` active RLS **sans policy** sur 5 autres — ce qui ferme `anon` mais ne protège rien côté app puisque `lib/supabase.ts:18` instancie le client avec `SUPABASE_SERVICE_ROLE_KEY`, qui **contourne RLS par définition**. Les 77 routes API qui importent `getSupabase` ont donc un accès total et non filtré.
4. **Client Supabase singleton mis en cache au niveau module** (`lib/supabase.ts:4` `let cached`) : en multi-tenant, un client porteur d'un contexte tenant ne doit **jamais** être mis en cache dans un module partagé entre requêtes (risque de fuite inter-tenant sur les lambdas réutilisées).
5. **Helpers globaux non scopés** : `saveDocument` (`lib/supabase.ts:290-306`) cherche un doublon par `(type, numero)` sur toute la base ; `upsertClient` (`:363-381`) cherche un client par email **global** puis par `(nom, ville)` global. En multi-tenant, sans filtre, l'entreprise A récupérerait la fiche client de l'entreprise B. C'est le scénario de fuite le plus probable et le plus grave.

---

## 2. Modèle de données multi-tenant

### 2.1 Choix : pooled (base unique + `tenant_id` + RLS)

| Critère | Pooled (retenu) | Schéma par client | Base par client |
|---|---|---|---|
| Coût | 1 projet Supabase, coût quasi constant | 1 projet, mais N× objets | N projets = N× le prix plancher |
| Maintenance | **1 migration = tous les clients** — exactement l'objectif du propriétaire | N schémas à migrer, drift garanti | N bases, orchestration obligatoire |
| Isolation RGPD | Logique (RLS) — suffisante si RLS réellement active + audit | Bonne | Excellente |
| Restauration ciblée | Point faible : PITR restaure tout → nécessite export logique par tenant | Moyenne | Excellente |
| Bruit de voisinage | Réel : index partagés, connexions partagées → mitigé par index `(tenant_id, …)` en tête | Moyen | Nul |
| Onboarding | Un `INSERT` | Un `CREATE SCHEMA` + réplication DDL | Provisioning de projet (minutes à heures) |

Pour un artisan-CRM avec 5 à 200 clients de quelques milliers de lignes chacun, **pooled** domine. La faiblesse (restauration ciblée) se compense par un export logique quotidien par tenant (`COPY … WHERE tenant_id = …` vers un bucket dédié), qui sert aussi à la portabilité RGPD (art. 20).

### 2.2 SQL cible

```sql
-- =============================================================
-- 100_tenants.sql — socle multi-tenant
-- =============================================================
create table if not exists organisations (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,        -- 'ltdb', 'plomberie-durand'
  raison_sociale    text not null,
  nom_commercial    text not null,
  metier            text not null default 'debouchage',
  -- identité légale (remplace lib/entreprise.ts)
  siren             text,
  siret             text,
  rcs               text,
  tva_intracom      text,
  naf               text,
  forme_juridique   text,
  regime_tva        text not null default 'franchise'
                      check (regime_tva in ('franchise','reel')),
  iban              text,
  bic               text,
  mentions_legales  text,
  -- contact & marque
  adresse_lignes    text[] not null default '{}',
  telephone         text,
  email_contact     text,
  site_url          text,
  logo_url          text,
  couleurs          jsonb not null default '{}'::jsonb,
  -- routage
  domaines          text[] not null default '{}', -- ['durand.moncrm.fr']
  -- cycle de vie
  prefixe_reference text not null default 'INT',  -- remplace 'LTDB-'
  actif             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on organisations using gin (domaines);

-- Utilisateurs en base (remplace AUTH_USER_N / AUTH_TECH_N)
create table if not exists utilisateurs (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references organisations(id) on delete cascade,
  login          text not null,
  email          text,
  password_hash  text not null,                  -- bcrypt, jamais null
  role           text not null check (role in ('owner','admin','tech')),
  technicien_id  uuid references techniciens(id) on delete set null,
  actif          boolean not null default true,
  is_demo        boolean not null default false,
  mfa_secret     text,
  derniere_connexion_at timestamptz,
  created_at     timestamptz not null default now(),
  unique (tenant_id, lower(login))
);
-- login global unique aussi, pour permettre la saisie du seul login à l'écran
create unique index utilisateurs_login_global_uidx on utilisateurs (lower(login));
```

Ajout de la colonne sur chaque table métier (script généré, pas 23 copier-collers) :

```sql
do $$
declare t text;
begin
  foreach t in array array[
    'clients','techniciens','interventions','documents','factures_fournisseurs',
    'tarifs','parametres','accords_intervention','lignes_devis','document_counters',
    'comptes_bancaires','operations_bancaires','releves_bancaires','pre_bilans',
    'salaries','fiches_paie','salarie_documents','salarie_documents_generes',
    'social_tokens','demo_access','comptes_techniciens','connexions_log',
    'relances_planifiees'
  ] loop
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid
         references public.organisations(id) on delete restrict', t);
    execute format(
      'create index if not exists %I on public.%I (tenant_id)', t||'_tenant_idx', t);
  end loop;
end $$;
```

**Règle d'indexation** : `tenant_id` doit être la **première colonne** de tout index composite chaud, sinon le planner scanne des lignes d'autres tenants avant de filtrer.

```sql
drop index if exists interventions_date_idx;
create index interventions_tenant_date_idx on interventions (tenant_id, date_prevue desc);
create index interventions_tenant_statut_idx on interventions (tenant_id, statut);
create index documents_tenant_type_date_idx on documents (tenant_id, type, date_emission desc);
create index clients_tenant_email_idx on clients (tenant_id, lower(email));
```

Ré-écriture des unicités globales (§1.2) :

```sql
-- documents : le numéro n'est unique QUE dans le tenant
drop index if exists documents_type_numero_unique;
create unique index documents_tenant_type_numero_uidx
  on documents (tenant_id, type, numero) where numero is not null;

alter table interventions drop constraint if exists interventions_reference_key;
create unique index interventions_tenant_reference_uidx
  on interventions (tenant_id, reference) where reference is not null;

alter table tarifs drop constraint if exists tarifs_type_key;
create unique index tarifs_tenant_type_uidx on tarifs (tenant_id, type);

alter table parametres drop constraint parametres_pkey;
alter table parametres add primary key (tenant_id, cle);

alter table social_tokens drop constraint if exists social_tokens_platform_key;
create unique index social_tokens_tenant_platform_uidx
  on social_tokens (tenant_id, platform);
```

**Garde-fou d'intégrité référentielle croisée** — un FK simple n'empêche pas un `document` du tenant A de pointer une `intervention` du tenant B. Clés composites :

```sql
alter table interventions add constraint interventions_tenant_id_uk unique (tenant_id, id);
alter table documents
  drop constraint documents_intervention_id_fkey,
  add constraint documents_intervention_tenant_fk
    foreign key (tenant_id, intervention_id)
    references interventions (tenant_id, id) on delete set null;
```

### 2.3 Policies RLS

```sql
create or replace function app_current_tenant() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('app.current_tenant', true), '')::uuid
$$;

do $$
declare t text;
begin
  foreach t in array array['clients','interventions','documents','tarifs','parametres', /* … */] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t); -- vaut aussi pour le owner
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format($p$
      create policy tenant_isolation on public.%I
        for all to app_user
        using      (tenant_id = public.app_current_tenant())
        with check  (tenant_id = public.app_current_tenant())
    $p$, t);
  end loop;
end $$;
```

`force row level security` est décisif : sans lui, le propriétaire des tables ignore les policies. Et `with check` est ce qui empêche un `INSERT`/`UPDATE` d'écrire dans un autre tenant — beaucoup d'implémentations n'écrivent que `using` et laissent une porte ouverte en écriture.

### 2.4 Le point critique : service_role contourne RLS

**Stratégie (a) — garder `service_role` + filtre applicatif.** Coût nul en infra. Mais la sécurité repose alors sur 138 routes qui n'oublient jamais un `.eq('tenant_id', …)`. Le code actuel prouve que ça ne tient pas : `upsertClient` (`lib/supabase.ts:363-381`) et `saveDocument` (`:290-306`) font déjà des lectures globales enfouies dans des helpers, invisibles depuis les routes appelantes. Un seul oubli sur 500+ requêtes = fuite de données comptables entre concurrents. **Non retenu seul.**

**Stratégie (b) — RLS réellement active.** Le client ne doit plus être `service_role`. Deux variantes :

- *b1 — JWT Supabase par utilisateur* : NextAuth émet un JWT signé avec le `SUPABASE_JWT_SECRET`, contenant `{ sub, role: 'app_user', app_metadata: { tenant_id } }`, et les policies lisent `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`. Avantage : PostgREST applique RLS nativement, zéro `set_config`. Inconvénient : couplage NextAuth ↔ secret JWT Supabase, et les traitements sans utilisateur (crons, webhooks) demandent un jeton de service explicite.
- *b2 — `service_role` conservé mais chaque requête précédée d'un `set_config('app.current_tenant', …, true)`* : impossible de façon fiable via PostgREST (pas de transaction multi-requêtes garantie ; le pooling peut recycler la session).

**Recommandation : b1**, avec un rôle Postgres `app_user` distinct, et `service_role` réservé à trois usages nommés et audités : les migrations, le provisioning d'un tenant, et les crons — ces derniers passant par une fonction `set_tenant_context(uuid)` et itérant explicitement tenant par tenant.

### 2.5 Mécanisme « impossible d'oublier le filtre »

Trois couches, du plus fort au plus faible :

**Couche 1 — la RLS elle-même** (b1). C'est le seul filet réellement infaillible : même un `select * from clients` sans clause renvoie uniquement le tenant courant.

**Couche 2 — un wrapper obligatoire.** `lib/supabase.ts` cesse d'exporter un client brut ; le singleton `cached` (`lib/supabase.ts:4`) disparaît, remplacé par une fabrique par requête :

```ts
// lib/db.ts — nouveau point d'entrée unique
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'

export type TenantId = string & { readonly __tenant: unique symbol }

export interface TenantDb {
  readonly tenantId: TenantId
  from(table: string): ReturnType<SupabaseClient['from']>
  rpc: SupabaseClient['rpc']
  storage: SupabaseClient['storage']
}

async function tenantJwt(tenantId: string, userId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
  return new SignJWT({ sub: userId, role: 'app_user', app_metadata: { tenant_id: tenantId } })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('10m').sign(secret)
}

/** Aucun accès DB ailleurs que par ici. Jamais mis en cache au niveau module. */
export async function dbForSession(): Promise<TenantDb> {
  const session = await auth()
  const tenantId = session?.user?.tenantId
  if (!tenantId) throw new Error('Contexte tenant absent — requête refusée')
  const token = await tenantJwt(tenantId, session.user.id)
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }), // cf. lib/supabase.ts:27
    },
  })
  return {
    tenantId: tenantId as TenantId,
    from: (t) => sb.from(t).eq /* voir note */ ? sb.from(t) : sb.from(t),
    rpc: sb.rpc.bind(sb),
    storage: sb.storage,
  }
}
```

En ceinture-bretelles, on peut ajouter un filtre applicatif automatique dans `from()` via un Proxy qui injecte `.eq('tenant_id', tenantId)` sur les `select/update/delete` et `tenant_id` sur les `insert` — la RLS reste l'autorité, le filtre applicatif ne fait que rendre les erreurs visibles tôt (0 ligne au lieu d'une erreur RLS).

**Couche 3 — lint + tests.** Règle ESLint maison `no-raw-supabase-client` :

```js
// .eslintrc.json → "rules": { "local/no-raw-supabase-client": "error" }
// Interdit tout import de '@/lib/supabase' hors de lib/db.ts et scripts/.
// Interdit createClient() hors de lib/db.ts.
```

Et un test d'isolation qui **doit échouer** si une route fuit :

```ts
// scripts/test-isolation.ts — exécuté en CI
const A = await seedTenant('tenant-a'), B = await seedTenant('tenant-b')
for (const route of listApiRoutes()) {                   // 138 routes
  const res = await call(route, { as: A.adminSession })
  const body = JSON.stringify(await res.json())
  // Les UUID du tenant B ne doivent JAMAIS apparaître dans une réponse au tenant A
  assert(!B.allIds.some(id => body.includes(id)), `FUITE sur ${route}`)
}
```

Complété par un test SQL direct : `set role app_user; set request.jwt.claims = '{"app_metadata":{"tenant_id":"…A"}}'; select count(*) from clients;` doit renvoyer exactement le compte du tenant A.

---

## 3. Personnalisation par client : data, pas code

| Donnée | Où | Remplace |
|---|---|---|
| Identité légale, RIB, mentions | colonnes `organisations` | `lib/entreprise.ts`, `009_entreprise_kbis.sql` |
| Émetteur PDF | fonction `getEmetteur(tenant)` construisant `EmetteurData` depuis `organisations` | `lib/emetteur.ts:19-30` |
| Réglages divers (clés/valeurs) | `parametres (tenant_id, cle)` | `lib/parametres.ts` |
| Logo, couleurs, favicon | `organisations.logo_url` / `couleurs jsonb`, assets dans `tenant-assets/{tenant_id}/` | `PdfBranding.tsx`, `remotion/types.ts:34` |
| Agences | table `agences (tenant_id, nom, actif)` ; `type Agence` devient `string` | `lib/agences.ts` |
| Zones géographiques | table `zones (tenant_id, ville, code_postal, departement)`, seedée par département via une table de référence nationale | `lib/villes-var.ts` |
| Catalogue + prix | `tarifs (tenant_id, …)` **exclusivement** | `lib/catalogue-prestations.ts:17-25` — le fallback à prix codés doit disparaître, pas être dupliqué |
| Templates email / SMS | table `templates_message (tenant_id, cle, canal, sujet, corps_html, corps_texte)` + moteur de substitution `{{client_nom}}`, `{{numero}}`, `{{tel}}` | ~14 routes `notify-*` |
| Prompts IA | `organisations.metier` + `prompts (tenant_id, cle, contenu)` | `generate-devis/route.ts:70`, `generate-facture/route.ts:71` |
| Tokens réseaux sociaux | `social_tokens (tenant_id, platform)` | `002_video_generation.sql:50` |

**Généralisation de la règle R2 (prix jamais en dur)** : la règle devient *« aucun prix, aucune désignation tarifaire ne peut exister ailleurs que dans `tarifs` scopée au tenant »*. Concrètement :

1. Supprimer `CATALOGUE_PRESTATIONS` (`lib/catalogue-prestations.ts:17-25`) et faire retourner `[]` au `fetchPrestations` en cas d'échec API, avec un message UI explicite plutôt qu'un prix faux.
2. Retirer le prix du slogan Remotion (`remotion/types.ts:39`, « dès 99€ TTC ») → champ `organisations.slogan`.
3. Ajouter un test CI : `grep -rnE "pu_ht:\s*[0-9]|prix[_a-z]*:\s*[0-9]{2,}" lib/ components/ app/` doit ne rien renvoyer hors des tests.
4. Conserver le gel des prix à l'instant T dans `lignes_devis` (`005_accord_intervention.sql`) — le comportement actuel, correct, ne change pas : le devis figé ne doit pas bouger si le tarif est modifié après.

**Résolution du tenant à la requête** : le middleware (`middleware.ts`) résout dans l'ordre (1) `session.user.tenantId` si authentifié, (2) le `Host` contre `organisations.domaines` pour les pages publiques (accord client, lien de facture, `stop-reminders`), (3) refus. Les préfixes publics de `middleware.ts:19-32` doivent tous être re-qualifiés : `/api/notify-client/stop-review`, `/api/facture/stop-reminders`, `/api/quote-complementaire/stop-reminders`, `/api/calendar.ics` sont accessibles sans session et doivent donc porter un token **incluant le tenant** (et non un simple id devinable).

---

## 4. Numérotation et séquences légales

Obligation : par entreprise, suite chronologique continue, sans trou ni doublon (art. 242 nonies A ann. II CGI). Le compteur actuel est correct dans son principe (upsert atomique `on conflict … do update` — `019:27-32`), il lui manque uniquement la dimension tenant.

```sql
-- 101_document_counters_tenant.sql
alter table document_counters drop constraint document_counters_pkey;
alter table document_counters add column tenant_id uuid not null
  references organisations(id) on delete restrict;
alter table document_counters add primary key (tenant_id, doc_type, year);

create or replace function allocate_document_number(p_type text, p_year int)
returns int language plpgsql security definer set search_path = 'public' as $$
declare v_tenant uuid; v_next int;
begin
  v_tenant := public.app_current_tenant();
  if v_tenant is null then
    raise exception 'allocate_document_number: contexte tenant absent';
  end if;
  insert into document_counters (tenant_id, doc_type, year, last_value, updated_at)
    values (v_tenant, p_type, p_year, 1, now())
  on conflict (tenant_id, doc_type, year)
    do update set last_value = document_counters.last_value + 1, updated_at = now()
  returning last_value into v_next;
  return v_next;
end $$;
```

Le tenant est lu **dans le contexte de session**, pas passé en paramètre : un appelant ne peut donc pas incrémenter le compteur d'un autre. La signature reste `(text, int)`, donc `lib/numero.ts:61-64` n'a pas à changer — mais **le repli `allocateFallback` (`lib/numero.ts:29-50`) doit être supprimé** : il calcule `max + 1` par un `select … order by numero desc limit 1` non transactionnel, ce qui produit des doublons sous concurrence. En multi-tenant avec plusieurs artisans facturant simultanément, ce chemin de repli devient un générateur de doublons ; mieux vaut échouer bruyamment.

**Trous.** Le compteur alloue avant l'écriture du document : si l'insertion échoue ensuite, le numéro est consommé — c'est un trou. Deux mesures :
- allouer le plus tard possible, dans la même unité logique que l'insertion (une RPC `create_document(payload jsonb)` qui alloue *et* insère dans la même transaction) ;
- une table `numeros_annules (tenant_id, doc_type, year, valeur, motif, created_at)` pour tracer tout numéro alloué non utilisé — l'administration fiscale accepte un trou justifié, pas un trou inexpliqué.

**Préfixe par tenant** : `FA`/`DV` restent, mais `organisations.prefixe_reference` remplace `LTDB-` dans `app/api/interventions/route.ts:72`, `app/api/generate/route.ts:72`, `app/api/devis/[id]/accepter/route.ts:34`. Ne **jamais** intégrer le slug tenant dans le numéro de facture : la numérotation légale doit rester lisible et stable même si le client change de nom.

---

## 5. Plan de migration en phases

**Phase 0 — Filet de sécurité (1 j).** Snapshot Supabase + export logique complet ; script `scripts/test-isolation.ts` écrit *avant* toute modification, avec deux tenants de test.
*Risque* : aucun. *Vérification* : restauration du snapshot testée sur un projet Supabase de préproduction.

**Phase 1 — `organisations` + tenant n°1 (1 j).** Créer `organisations`, insérer LTDB avec les valeurs exactes de `lib/entreprise.ts` et `009_entreprise_kbis.sql`, ajouter `tenant_id` **nullable** partout, backfill `update … set tenant_id = <ltdb>` sur toutes les tables, puis `set not null`. Aucun changement de code.
*Risque* : faible ; le backfill est un `UPDATE` sans clause. *Vérification* : `select count(*) from <table> where tenant_id is null` = 0 sur les 23 tables.

**Phase 2 — Identité en données (2-3 j).** `lib/entreprise.ts` et `lib/emetteur.ts` deviennent des lecteurs de `organisations` ; `getEmetteur(tenantId)` remplace la constante `LTDB_EMETTEUR`. Les composants PDF reçoivent l'émetteur en props (la plupart le font déjà via `EmetteurData`). Suppression des chaînes littérales dans les 14 routes `notify-*` au profit de `templates_message`.
*Risque* : régression visuelle sur les PDF (le poste le plus visible du produit). *Vérification* : snapshot binaire — générer les 6 PDF (facture, devis, attestation, rapport, inspection, travaux supp.) avant/après et comparer le texte extrait (`lib/pdf-text-check.ts` existe déjà et sert exactement à ça).

**Phase 3 — Utilisateurs en base (2-3 j).** Table `utilisateurs`, écran `/admin/utilisateurs`, `lib/auth.ts` ajoute `tenantId` au JWT et à la session. `lib/auth-users.ts` conserve la lecture des `AUTH_USER_N` **uniquement** en repli de secours, rattachés au tenant n°1, avec un mot de passe désormais obligatoire (le `passwordHash: null` de `auth-users.ts:37` et le retour direct de `:112` sont supprimés). `comptes_techniciens` et `demo_access` deviennent des vues sur `utilisateurs` ou sont scopés.
*Risque* : verrouillage du propriétaire hors de son app. *Vérification* : créer le compte owner LTDB en base **avant** de retirer le repli env ; garder les deux chemins actifs une semaine.

**Phase 4 — Wrapper `lib/db.ts` (3-5 j).** Migration mécanique des 77 fichiers qui importent `getSupabase` vers `dbForSession()`. Encore en `service_role` à ce stade, mais avec injection automatique du `tenant_id`. Activation de la règle ESLint. `upsertClient`, `patchClient`, `saveDocument` reçoivent le tenant en premier argument.
*Risque* : le plus élevé du plan — 77 fichiers touchés. *Vérification* : la CI d'isolation à deux tenants doit passer à 100 % ; migration route par route, pas en un seul commit.

**Phase 5 — Bascule RLS réelle (2 j).** Rôle `app_user`, policies `for all … using/with check`, `force row level security`, JWT signé par NextAuth, `SUPABASE_ANON_KEY` en front de `service_role`. Les crons passent par un jeton de service et bouclent `for tenant in select id from organisations where actif`.
*Risque* : un oubli de policy = table inaccessible en production (panne, pas fuite — le bon sens de l'échec). *Vérification* : script SQL listant toute table sans policy `tenant_isolation` ; doit renvoyer 0 ligne.

**Phase 6 — Storage & séquences (2 j).** Préfixage `{tenant_id}/…` des chemins d'objets, policies Storage sur le premier segment du chemin, migration 101 des `document_counters`, suppression de `allocateFallback`.
*Risque* : URLs de PDF déjà envoyées par mail qui cassent. *Vérification* : conserver les anciens chemins en lecture (pas de déplacement physique pour le tenant 1 ; seul le nouveau contenu est préfixé), ou table de redirection.

**Phase 7 — Onboarding & multi-domaine (2 j).** Voir §6.

**Sort du client existant** : LTDB devient le tenant n°1 en Phase 1, sans interruption. La bascule est *additive* jusqu'en Phase 5 (les colonnes s'ajoutent, rien n'est supprimé), donc chaque phase est réversible par un `alter table … disable row level security` ou un revert de déploiement Vercel. Aucune fenêtre de migration de données longue n'est nécessaire : la seule opération lourde est le backfill `tenant_id`, qui sur quelques dizaines de milliers de lignes dure quelques secondes.

---

## 6. Onboarding d'un nouveau client en moins d'une heure

Route `POST /api/admin/tenants` (réservée au rôle plateforme), qui exécute en une transaction :

```ts
// app/api/platform/tenants/route.ts (nouveau — accès plateforme uniquement)
const { data: org } = await admin.from('organisations').insert({
  slug, raison_sociale, nom_commercial, metier,
  siren, siret, tva_intracom, forme_juridique, regime_tva,
  iban, bic, telephone, email_contact, site_url,
  adresse_lignes, couleurs, prefixe_reference: prefixe,
  domaines: [`${slug}.moncrm.fr`],
}).select('id').single()

await admin.rpc('provision_tenant', {           // fonction SQL, une transaction
  p_tenant: org.id,
  p_departement: departement,                    // seed des zones géographiques
  p_metier: metier,                              // seed du catalogue tarifs métier
  p_owner_login: ownerLogin,
  p_owner_hash: await bcrypt.hash(motDePasseTemporaire, 10),
})
```

`provision_tenant` fait, dans l'ordre : (1) insertion de l'utilisateur `owner` ; (2) copie du catalogue de référence `tarifs_modeles (metier, type, label, prix_min, prix_max, unite)` vers `tarifs` du tenant — **le nouvel artisan ajuste ensuite ses prix, il n'hérite jamais de ceux d'un autre tenant** ; (3) copie des `templates_message` de référence ; (4) insertion des `parametres` par défaut (`TEL_PRINCIPAL`, `OWNER_NOTIFY_EMAIL`, `google_review_url`) ; (5) seed des `zones` depuis la table nationale des communes filtrée sur le département ; (6) init des `document_counters` à 0 pour `facture` et `devis` de l'année courante ; (7) création d'une agence par défaut.

Reste manuel, hors transaction :
- **Domaine** : `{slug}.moncrm.fr` via un wildcard DNS + domaine wildcard Vercel → zéro action par client. Domaine propre du client : ajout dans Vercel + une entrée dans `organisations.domaines` (5 min).
- **Assets** : upload logo dans `tenant-assets/{tenant_id}/logo.png`, couleurs dans le formulaire.
- **Email sortant** : le `from` doit être validé côté Resend. Deux options — un domaine mutualisé (`{slug}@notifications.moncrm.fr`, immédiat) ou le domaine du client (vérification DNS, 24 h). Prévoir le mutualisé par défaut, le domaine propre en option.
- **SMS** : `BREVO_SMS_SENDER` (11 caractères) devient `organisations.sms_sender`, avec la clé API Brevo mutualisée et une refacturation à l'usage.
- **OAuth réseaux sociaux** : les `*_REDIRECT_URI` de `.env.local.example:52-73` sont figées sur `app-realisations-ltdb.vercel.app` ; à unifier sur un callback unique `https://app.moncrm.fr/api/oauth/{provider}/callback` avec le tenant transporté dans le paramètre `state` signé, sinon il faudra une app OAuth par client (rédhibitoire).

Budget réaliste : **15 min** pour le tenant + l'owner + le catalogue, **20 min** pour l'identité légale et les assets, **25 min** pour le domaine et l'email si domaine propre. Sous l'heure, sauf attente de propagation DNS.

---

## Récapitulatif des décisions

1. **Pooled + RLS**, pas un schéma ni une base par client — la maintenance unique est l'exigence explicite du propriétaire.
2. **Abandon de `service_role` comme client applicatif** au profit d'un JWT porteur de `tenant_id` et d'un rôle `app_user` ; `service_role` réservé aux migrations, au provisioning et aux crons.
3. **Un point d'entrée DB unique** (`lib/db.ts`), sans singleton de module, imposé par lint et par un test d'isolation à deux tenants en CI.
4. **`document_counters` clé `(tenant_id, doc_type, year)`**, tenant lu dans le contexte de session, repli `max+1` supprimé.
5. **Toute identité, tout prix, tout template en base**, scopés au tenant ; la règle R2 est généralisée et vérifiée par un grep en CI.

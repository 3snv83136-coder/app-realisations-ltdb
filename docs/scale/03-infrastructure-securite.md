# Infrastructure & sécurité cible — CRM multi-clients

> Cible : produit SaaS B2B, base PostgreSQL **unique partagée** (pooled multi-tenant), 1 → 200 clients, exploité par **une seule personne**.
> Point de départ : Next.js 14 App Router, 138 routes API, `next-auth@5` en mode Credentials, comptes en variables d'environnement (`lib/auth-users.ts`), Supabase accédé **exclusivement en `service_role`** (`lib/supabase.ts`), donc RLS structurellement inopérante.
> Les failles de l'audit (connexion admin sans mot de passe, démo en `role: 'admin'`, RLS off, PII dans `public/`, OAuth sans `state`, pas de rate-limiting, pas de CSP, 47/138 routes qui fuient `error.message`) ne sont pas ré-auditées ici : elles sont traitées comme des contraintes de conception.

---

## 1. Identité et authentification

### 1.1 Décision : Supabase Auth

| Critère | Supabase Auth | Clerk | WorkOS | Auth.js + adapter |
|---|---|---|---|---|
| Coût à 200 clients (~600 users) | **0 €** (inclus) | ~250 $/mo (MAU + MFA payant) | ~critère « par connexion SSO », 125 $/mo mini | 0 € |
| `tenant_id` natif dans le JWT lu par RLS | **oui** (custom access token hook, même Postgres) | oui via *third-party auth* (JWKS), latence + dépendance externe | oui, mapping manuel | non — il faut signer soi-même un JWT compatible `auth.jwt()` |
| MFA TOTP | inclus | payant (add-on) | inclus | à écrire |
| Révocation immédiate | `auth.admin.signOut(user, 'global')` | oui | oui | à écrire |
| Charge de maintenance solo | **faible** | faible | moyenne | **élevée** (reset MDP, invitations, MFA, rate-limit login : tout à écrire) |
| Sortie de dépendance | schéma `auth` dans **votre** base, dumpable | export API | export API | totale |

**Recommandation tranchée : Supabase Auth.** C'est le seul choix où le `tenant_id` circule *dans le même moteur* que les policies RLS — aucune brique tierce entre la vérification d'identité et la vérification d'accès. `next-auth` est retiré. Clerk ne se justifierait que si un client exigeait du SAML/SCIM d'entreprise ; à ce moment-là on ajoute WorkOS **en amont** de Supabase Auth comme fournisseur OIDC, sans changer le modèle d'autorisation.

### 1.2 Modèle de données

```sql
-- 040_tenants.sql
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null check (slug ~ '^[a-z0-9-]{3,40}$'),
  raison_sociale text not null,
  siret         text,
  plan          text not null default 'standard',
  statut        text not null default 'actif'
                check (statut in ('actif','suspendu','resilie')),
  is_demo       boolean not null default false,
  data_region   text not null default 'eu-west-3',
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create type app_role as enum ('proprietaire','admin','comptable','technicien','lecture');

-- Un compte Supabase Auth peut appartenir à plusieurs tenants (cabinet comptable
-- mutualisé, prestataire) : le rattachement vit dans memberships, jamais dans auth.users.
create table public.memberships (
  user_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  role       app_role not null,
  technicien_id uuid references public.techniciens(id),
  actif      boolean not null default true,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);
create index on public.memberships (tenant_id) where actif;
```

Toutes les tables métier existantes (`clients`, `interventions`, `documents`, `accords_intervention`, `tarifs`, `parametres`, `comptes_techniciens`, `connexions_log`, `factures_fournisseurs`, `social_tokens`…) reçoivent `tenant_id uuid not null references tenants(id)`, indexé **en tête de chaque index composite** (`create index on interventions (tenant_id, date_prevue desc)`), et les contraintes d'unicité deviennent scopées : `unique (tenant_id, numero)` sur `documents` remplace `unique (numero)` (migration 020).

### 1.3 Le JWT porte le tenant — le point central

Supabase permet de réécrire les claims à l'émission du token via un **Custom Access Token Hook** exécuté en PL/pgSQL. C'est lui qui rend RLS possible sans un seul appel réseau supplémentaire.

```sql
-- 041_access_token_hook.sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
declare
  claims    jsonb := coalesce(event->'claims', '{}'::jsonb);
  uid       uuid  := (event->>'user_id')::uuid;
  active    uuid;   -- tenant courant, mémorisé sur le profil
  m         record;
begin
  select current_tenant_id into active from public.user_profiles where user_id = uid;

  select ms.tenant_id, ms.role, ms.technicien_id, t.statut, t.is_demo
    into m
  from public.memberships ms
  join public.tenants t on t.id = ms.tenant_id
  where ms.user_id = uid and ms.actif
    and (active is null or ms.tenant_id = active)
    and t.statut = 'actif' and t.deleted_at is null
  order by (ms.tenant_id = active) desc, ms.created_at
  limit 1;

  if m.tenant_id is null then
    -- Aucun tenant actif : token émis sans droit. Toutes les policies échouent.
    return jsonb_set(event, '{claims}', claims || jsonb_build_object('tenant_id', null));
  end if;

  claims := claims || jsonb_build_object(
    'tenant_id',     m.tenant_id,
    'app_role',      m.role,
    'technicien_id', m.technicien_id,
    'is_demo',       m.is_demo,
    -- incrémenté à chaque révocation → invalide les tokens en vol
    'sv',            (select session_version from public.user_profiles where user_id = uid)
  );
  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

Activation : *Dashboard → Authentication → Hooks → Customize Access Token (JWT) Claims* → `public.custom_access_token_hook`.

Helpers + policies. Le motif est **identique sur les ~25 tables**, donc générable :

```sql
create or replace function public.jwt_tenant() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id','')::uuid
$$;

create or replace function public.jwt_role() returns text
language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb->>'app_role'
$$;

-- Générateur : applique le socle sur toute table possédant tenant_id
do $$
declare r record;
begin
  for r in
    select c.table_name from information_schema.columns c
    where c.table_schema='public' and c.column_name='tenant_id'
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('alter table public.%I force row level security', r.table_name);
    execute format($f$
      create policy tenant_isolation on public.%I
        for all to authenticated
        using (tenant_id = public.jwt_tenant())
        with check (tenant_id = public.jwt_tenant())
    $f$, r.table_name);
  end loop;
end $$;

-- Policies fines par-dessus le socle (exemple : un technicien ne voit que ses interventions)
create policy tech_scope on public.interventions
  for select to authenticated
  using (
    tenant_id = public.jwt_tenant()
    and (public.jwt_role() <> 'technicien'
         or technicien_id = (current_setting('request.jwt.claims',true)::jsonb->>'technicien_id')::uuid)
  );

-- La paie : lisible uniquement par proprietaire/comptable, et seulement en AAL2 (MFA)
create policy paie_sensible on public.fiches_paie
  for all to authenticated
  using (
    tenant_id = public.jwt_tenant()
    and public.jwt_role() in ('proprietaire','comptable')
    and current_setting('request.jwt.claims',true)::jsonb->>'aal' = 'aal2'
  );
```

`force row level security` est essentiel : sans lui, le propriétaire des tables échappe aux policies.

### 1.4 Deux clients Supabase, plus un seul

Le point de bascule le plus important du chantier : `lib/supabase.ts` expose aujourd'hui **uniquement** `service_role`, qui contourne RLS. Cible :

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** 99 % des accès. Porte le JWT utilisateur → RLS active, tenant_id imposé par Postgres. */
export function supabaseAsUser() {
  const store = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        get: (n) => store.get(n)?.value,
        set: (n, v, o) => store.set({ name: n, value: v, ...o }),
        remove: (n, o) => store.set({ name: n, value: '', ...o }),
    } },
  )
}

/**
 * service_role : contourne RLS. Réservé aux opérations système.
 * Toute utilisation exige une raison explicite, tracée dans audit_log.
 */
const SYSTEM_REASONS = ['cron','provisioning','webhook','backup','support'] as const
export function supabaseAdmin(reason: typeof SYSTEM_REASONS[number]) {
  console.warn(JSON.stringify({ evt: 'service_role_use', reason }))
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

Une règle ESLint `no-restricted-imports` interdit d'importer `supabaseAdmin` hors de `app/api/cron/**`, `app/api/webhooks/**` et `lib/provisioning/**`. Cette règle vaut mieux qu'une revue humaine : elle échoue au build.

### 1.5 Politiques

- **Mots de passe** : Supabase Auth → longueur mini 12, jeu `lower+upper+digits+symbols`, vérification HIBP activée (*Leaked password protection*). Zéro compte sans mot de passe : `AUTH_USER_1=admin` disparaît.
- **MFA** : TOTP obligatoire pour `proprietaire`, `admin`, `comptable` (imposé en base par la clause `aal = 'aal2'` des policies sensibles, pas seulement dans l'UI — un contournement du front ne donne rien). Facultatif pour `technicien` (terrain, mobile). Codes de secours : 8 codes à usage unique, hashés, table `mfa_recovery_codes`.
- **Réinitialisation** : `supabase.auth.resetPasswordForEmail()`, lien 1 h, usage unique, template FR hébergé chez Resend (SMTP custom Supabase) pour ne pas dépendre du SMTP de démo limité à 3 mails/h.
- **Invitations** : `auth.admin.inviteUserByEmail()` déclenché par une route `POST /api/tenants/[id]/invitations` qui exige `users:invite` ; la ligne `memberships` est créée en `actif=false` et bascule à `true` au premier login. Un invité ne peut jamais recevoir un rôle supérieur à celui de l'invitant.
- **Sessions** : access token **1 h**, refresh token avec rotation + détection de réutilisation (Supabase le fait nativement), inactivité 8 h pour les rôles bureau, 30 jours pour les techniciens terrain (JWT court + refresh long, l'app mobile ne se reconnecte pas sur un chantier sans réseau). Time-box absolue : 30 jours.
- **Révocation immédiate** : le claim `sv` (session_version). `POST /api/users/[id]/revoke` fait `update user_profiles set session_version = session_version + 1` + `auth.admin.signOut(userId, 'global')`. Le middleware compare `jwt.sv` à la valeur en base **une fois par minute maximum** (cache mémoire) : révocation effective en ≤ 60 s sans requête base à chaque appel. C'est la généralisation propre du bricolage actuel `isDemoAccessActive()` / `isCompteTechActive()` qui touche la base à **chaque requête** dans le middleware.
- **Comptes de démonstration cloisonnés** : le correctif structurel de la faille C3. Une démo n'est plus un flag `isDemo` sur un compte admin du tenant de production — c'est **un tenant à part entière** (`tenants.is_demo = true`), peuplé par un script de seed de données fictives, TTL 14 jours, purgé par cron (`delete from tenants where is_demo and created_at < now() - interval '14 days'`, cascade). L'isolation devient une conséquence de RLS, plus une liste noire de préfixes d'URL dans le middleware.

---

## 2. Modèle d'autorisation : RBAC déclaratif, impossible à oublier

### 2.1 Matrice de permissions

```ts
// lib/authz/permissions.ts
export const PERMISSIONS = [
  'interventions:read','interventions:write','interventions:delete',
  'clients:read','clients:write',
  'devis:write','factures:write','factures:send',
  'compta:read','compta:write',
  'paie:read','paie:write',
  'tarifs:read','tarifs:write',
  'users:read','users:invite','users:revoke',
  'settings:read','settings:write',
  'integrations:connect',
  'publish:write',
] as const
export type Permission = typeof PERMISSIONS[number]

const LECTURE: Permission[] = ['interventions:read','clients:read','compta:read','tarifs:read']
const TECHNICIEN: Permission[] = ['interventions:read','interventions:write','clients:read','tarifs:read','devis:write']
const COMPTABLE: Permission[] = [...LECTURE,'compta:write','factures:write','factures:send','paie:read']
const ADMIN: Permission[] = [...COMPTABLE,...TECHNICIEN,'clients:write','interventions:delete','tarifs:write','users:read','users:invite','settings:read','publish:write']
const PROPRIETAIRE: Permission[] = [...PERMISSIONS]   // tout, y compris paie:write et users:revoke

export const ROLE_PERMISSIONS = {
  lecture: LECTURE, technicien: TECHNICIEN, comptable: COMPTABLE,
  admin: ADMIN, proprietaire: PROPRIETAIRE,
} as const satisfies Record<AppRole, readonly Permission[]>
```

Les permissions fines actuelles (`lib/tech-permissions.ts` : `voir_prix`, `creer_facture`, `envoyer_devis`) deviennent des **retraits** sur le membership : `memberships.permissions_denied text[]`, soustraits du rôle. Ajouter, jamais retrancher, aurait produit des combinaisons impossibles à tester.

### 2.2 Le garde-fou unique

```ts
// lib/authz/guard.ts
import { supabaseAsUser } from '@/lib/supabase/server'
import type { Permission } from './permissions'

export type Ctx = { userId: string; tenantId: string; role: AppRole; technicienId: string | null; can: (p: Permission) => boolean }

export class HttpError extends Error { constructor(public status: number, public code: string) { super(code) } }

/** OBLIGATOIRE en première instruction de tout handler sous app/api/. */
export async function guard(opts: { permission: Permission | 'public'; }): Promise<Ctx> {
  if (opts.permission === 'public') return PUBLIC_CTX
  const sb = supabaseAsUser()
  const { data: { user } } = await sb.auth.getUser()      // vérifie la signature côté Supabase
  if (!user) throw new HttpError(401, 'unauthenticated')

  const claims = decodeClaims(user)                        // tenant_id, app_role, sv
  if (!claims.tenant_id) throw new HttpError(403, 'no_tenant')
  if (await isRevoked(user.id, claims.sv)) throw new HttpError(401, 'session_revoked')

  const granted = new Set(ROLE_PERMISSIONS[claims.app_role])
  for (const d of claims.denied ?? []) granted.delete(d as Permission)
  if (!granted.has(opts.permission)) throw new HttpError(403, 'forbidden')

  return { userId: user.id, tenantId: claims.tenant_id, role: claims.app_role,
           technicienId: claims.technicien_id, can: (p) => granted.has(p) }
}

/** Enveloppe : convertit les erreurs en réponses SANS jamais fuiter error.message (fix M4, 47 routes). */
export function route(permission: Permission | 'public',
                      handler: (req: Request, ctx: Ctx, params: any) => Promise<Response>) {
  return async (req: Request, params: any) => {
    let ctx: Ctx
    try { ctx = await guard({ permission }) }
    catch (e) { return e instanceof HttpError
      ? Response.json({ error: MESSAGES[e.code] }, { status: e.status })
      : Response.json({ error: 'Erreur interne' }, { status: 500 }) }
    try { return await handler(req, ctx, params) }
    catch (e) {
      const ref = crypto.randomUUID().slice(0, 8)
      console.error(JSON.stringify({ evt:'route_error', ref, tenant: ctx.tenantId, err: String(e) }))
      return Response.json({ error: 'Erreur interne', ref }, { status: 500 })  // message opaque + référence
    }
  }
}
```

Usage — le handler ne fait plus jamais son propre contrôle de rôle ni son propre filtrage par tenant (RLS s'en charge) :

```ts
// app/api/interventions/[id]/route.ts
export const DELETE = route('interventions:delete', async (_req, ctx, { params }) => {
  const sb = supabaseAsUser()
  const { error } = await sb.from('interventions').delete().eq('id', params.id)  // RLS = filtre tenant
  if (error) throw error
  await audit(ctx, 'intervention.delete', 'intervention', params.id)
  return Response.json({ ok: true })
})
```

### 2.3 Le test qui rend l'oubli impossible

```ts
// tests/authz-coverage.test.ts
import { globSync } from 'glob'; import { readFileSync } from 'fs'
import { PUBLIC_ROUTES } from '@/lib/authz/public-routes'   // liste explicite, revue en PR
import { PERMISSIONS } from '@/lib/authz/permissions'

const METHOD = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*route\(\s*['"]([^'"]+)['"]/g

it('toute route API passe par route() avec une permission connue', () => {
  const faults: string[] = []
  for (const file of globSync('app/api/**/route.ts')) {
    const src = readFileSync(file, 'utf8')
    const exported = [...src.matchAll(/export\s+(?:const|async\s+function)\s+(GET|POST|PUT|PATCH|DELETE)/g)].map(m => m[1])
    const wrapped = new Map([...src.matchAll(METHOD)].map(m => [m[1], m[2]]))
    for (const verb of exported) {
      const perm = wrapped.get(verb)
      if (!perm) { faults.push(`${file} :: ${verb} n'utilise pas route()`); continue }
      if (perm === 'public' && !PUBLIC_ROUTES.includes(routeIdOf(file)))
        faults.push(`${file} :: ${verb} déclaré public hors liste PUBLIC_ROUTES`)
      if (perm !== 'public' && !PERMISSIONS.includes(perm as any))
        faults.push(`${file} :: permission inconnue « ${perm} »`)
    }
  }
  expect(faults).toEqual([])       // le message d'échec liste les routes fautives
})
```

Trois propriétés à retenir : une **nouvelle route échoue par défaut** (elle n'est pas dans `PUBLIC_ROUTES`) ; rendre une route publique demande une modification de fichier visible en revue ; et la liste des préfixes d'URL (`lib/auth-routes.ts`, `TECH_API_PREFIXES`) disparaît — c'était une allow-list de chemins, donc muette sur les routes créées après elle. Ce test tourne en pre-commit et en CI GitHub Actions, avec `npx tsc --noEmit` et `npm run lint`.

En complément, un test d'isolation qui vaut tous les audits : créer deux tenants de test, s'authentifier comme tenant A, tenter de lire chaque table, vérifier que zéro ligne du tenant B remonte. Une centaine de lignes, exécutée en CI sur une branche Supabase éphémère.

---

## 3. Secrets et configuration

**Trois niveaux, trois emplacements :**

1. **Secrets plateforme partagés** (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` du domaine plateforme, `ENCRYPTION_KEYS`) : variables d'environnement Vercel, scopées par environnement, marquées *Sensitive* (non relisibles depuis l'UI après écriture). Rotation trimestrielle notée dans un ticket récurrent.
2. **Secrets par tenant** (jetons OAuth Google/YouTube/GMB/Meta/TikTok — aujourd'hui table `social_tokens` en clair —, clé SMS Brevo, domaine d'envoi Resend, identifiants comptables) : **en base, chiffrés au niveau applicatif**.
3. **Configuration non secrète par tenant** (couleurs, mentions légales, `TEL_PRINCIPAL`, TVA) : table `parametres` scopée `tenant_id`, en clair.

`.env.local.example` est purgé de tout secret réel (`LTDB_PUBLISH_TOKEN` y figure en clair, il est à révoquer) et la CI intègre `gitleaks detect --redact` sur chaque PR.

### Chiffrement des jetons par tenant, avec rotation

Chiffrement applicatif AES-256-GCM plutôt que `pgsodium`/TDE : la clé ne vit jamais dans la base, donc un dump volé ne donne pas les jetons OAuth des clients.

```ts
// lib/crypto/keyring.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// ENCRYPTION_KEYS='{"v3":"base64:32o","v2":"base64:32o"}'  ENCRYPTION_KEY_CURRENT='v3'
const KEYS: Record<string, Buffer> = Object.fromEntries(
  Object.entries(JSON.parse(process.env.ENCRYPTION_KEYS!)).map(([k, v]) => [k, Buffer.from(v as string, 'base64')]))
const CURRENT = process.env.ENCRYPTION_KEY_CURRENT!

/** aad = tenant_id + provider : un jeton déplacé vers un autre tenant devient indéchiffrable. */
export function seal(plain: string, aad: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', KEYS[CURRENT], iv)
  c.setAAD(Buffer.from(aad))
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [CURRENT, iv.toString('base64'), ct.toString('base64'), c.getAuthTag().toString('base64')].join('.')
}

export function open(sealed: string, aad: string): string {
  const [kid, iv, ct, tag] = sealed.split('.')
  const d = createDecipheriv('aes-256-gcm', KEYS[kid], Buffer.from(iv, 'base64'))
  d.setAAD(Buffer.from(aad)); d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8')
}
```

```sql
create table public.tenant_secrets (
  tenant_id uuid not null references tenants(id) on delete cascade,
  provider  text not null,             -- 'google','gmb','meta','tiktok','brevo','resend'
  ciphertext text not null,            -- kid.iv.ct.tag
  key_id    text not null,             -- redondant, pour cibler la rotation en SQL
  expires_at timestamptz,
  rotated_at timestamptz not null default now(),
  primary key (tenant_id, provider)
);
alter table public.tenant_secrets enable row level security;
-- Aucune policy : lisible uniquement via service_role, depuis lib/integrations/**.
```

**Rotation de clé** : ajouter `v4` au keyring, basculer `ENCRYPTION_KEY_CURRENT`, lancer `npm run keys:rotate` (lit toutes les lignes `key_id <> 'v4'`, `open()` puis `seal()`, ~1 s pour 1 000 lignes), retirer `v2` du keyring une fois `select count(*) where key_id='v2'` à zéro. Annuel, ou immédiat en cas de suspicion. Les jetons OAuth eux-mêmes se rafraîchissent tout seuls (`refresh_token`) ; leur révocation côté fournisseur est déclenchée au moment d'un `tenants.statut = 'resilie'`.

**Séparation des environnements** : trois projets Supabase distincts (`prod`, `staging`, `dev`) — pas trois schémas dans un même projet, où une erreur de `search_path` traverse la cloison. Les *preview branches* Supabase donnent une base éphémère par PR (~0,32 $/jour), détruite à la fusion. **Aucune donnée de production en dev** : un script `seed-fake.ts` génère des clients/interventions fictifs. Vercel : `production` / `preview` / `development` avec des jeux de clés séparés, et *Deployment Protection* activée sur les previews (aujourd'hui absente).

---

## 4. Résilience et sauvegardes

### Ce que Supabase fournit

| Plan | Sauvegardes | PITR |
|---|---|---|
| Free | aucune garantie | non |
| **Pro (25 $/mo)** | quotidiennes, rétention **7 jours** | add-on **100 $/mo** (fenêtre 7 j, granularité ~2 min) |
| Team (599 $/mo) | quotidiennes, 14 jours | inclus, 28 j |

**Décision : Pro + PITR dès le 3ᵉ client payant.** En dessous, la sauvegarde logique maison suffit. Au-dessus de ~30 clients, 100 $/mo pour un RPO de 2 minutes est le meilleur rapport risque/coût du budget entier.

### Sauvegarde logique indépendante (le vrai filet)

Une sauvegarde qui vit chez le même fournisseur que la base n'est pas une sauvegarde. GitHub Actions nocturne :

```yaml
# .github/workflows/backup.yml — 03:15 UTC
- run: pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --file=dump.pgc
- run: age -r "$AGE_PUBLIC_KEY" dump.pgc > "dump-$(date +%F).pgc.age"
- run: rclone copy dump-*.pgc.age b2:ltdb-backups/daily/     # Backblaze B2, ~6 $/To/mo
# Rétention : 30 quotidiennes, 12 mensuelles. Object Lock 35 j (anti-ransomware).
```

Coût réel : < 5 €/mo jusqu'à 200 clients (un dump chiffré de 200 tenants CRM pèse quelques centaines de Mo — les fichiers lourds sont dans Storage, sauvegardés séparément par `rclone sync` hebdomadaire).

### Restaurer UN SEUL client sans toucher aux autres

C'est le point dur du multi-tenant *pooled* : le PITR Supabase restaure **tout le projet**, donc ferait perdre les données des 199 autres clients. La procédure correcte est en quatre temps :

1. **Restaurer ailleurs.** PITR à l'instant T sur une *branche* Supabase ou un projet neuf. La production ne bouge pas. (~20-40 min pour une base de quelques Go.)
2. **Extraire le seul tenant.** Sur la restauration, filtrer par `tenant_id` :

```bash
psql "$RESTORED_URL" -v tid="'$TENANT_ID'" <<'SQL'
create schema restore_slice;
do $$ declare r record; begin
  for r in select table_name from information_schema.columns
           where table_schema='public' and column_name='tenant_id' loop
    execute format('create table restore_slice.%I as select * from public.%I where tenant_id = %L',
                   r.table_name, r.table_name, current_setting('tid'));
  end loop; end $$;
SQL
pg_dump "$RESTORED_URL" --schema=restore_slice --data-only --format=custom -f slice.pgc
```

3. **Réinjecter en production, dans une transaction unique**, en respectant l'ordre des clés étrangères (`tenants` → `clients` → `interventions` → `documents` → `accords_intervention` → `lignes_devis` → pièces jointes) :

```sql
begin;
set constraints all deferred;
delete from public.interventions where tenant_id = :tid;   -- etc., ordre inverse des FK
insert into public.interventions select * from restore_slice.interventions;
-- Contrôle avant validation
select count(*) from public.interventions where tenant_id = :tid;
commit;                                                     -- ou rollback;
```

4. **Vérifier et tracer** : recompter les documents comptables, contrôler que les numéros de facture n'ont pas régressé (`document_sequences` doit être remis au **max historique**, jamais à la valeur restaurée — sinon doublons de numérotation, non-conformité fiscale), écrire dans `audit_log`.

Trois prérequis rendent cela faisable : `tenant_id` sur **toutes** les tables (y compris les tables de liaison), `on delete cascade` cohérent, et des clés primaires en `uuid` (pas de `serial`, dont les séquences entreraient en collision). Ce sont des choix de schéma à faire **maintenant**, pas le jour de l'incident.

**Test de restauration** : trimestriel, calendarisé, sur un tenant de démo, chronométré, avec le résultat consigné dans `docs/runbooks/restauration.md`. Une sauvegarde non testée est une hypothèse.

### RPO / RTO réalistes

| Scénario | RPO | RTO |
|---|---|---|
| Corruption logique sur 1 tenant | 2 min (PITR) | **2-4 h** (procédure ci-dessus, manuelle) |
| Perte totale du projet Supabase | 2 min | 4-8 h (restauration projet complet) |
| Supabase indisponible région | 24 h (dump B2) | **8-24 h** (remonter sur Neon/Scaleway depuis le dump) |
| Vercel indisponible | 0 | **1-2 h** (redéploiement du même dépôt sur Cloudflare Workers ou Scaleway Containers, DNS pointé) |

Ce sont des chiffres d'exploitant solo, pas de SLA à trois neufs. Ils doivent être **écrits dans le contrat client** — promettre mieux serait mentir.

**Continuité** : le CRM n'est pas un service critique 24/7 ; deux heures d'indisponibilité coûtent une gêne, pas une vie. Le vrai plan de continuité est le mode terrain hors-ligne déjà présent (`local_id`/`synced_at` sur `accords_intervention`) : un technicien continue de travailler même app en panne. À industrialiser, pas à remplacer par du multi-région.

**Réversibilité (client qui résilie)** : route `POST /api/tenants/[id]/export` réservée au `proprietaire`, qui produit sous 72 h une archive ZIP — CSV par table métier + tous les PDF/photos du Storage + un `manifest.json` documentant le schéma. Obligation contractuelle et argument commercial (RGPD art. 20). Après export : `statut='resilie'`, révocation des jetons OAuth chez les fournisseurs, purge des données à J+90, attestation de suppression envoyée.

---

## 5. Observabilité

**Logs structurés.** JSON une ligne par événement, jamais de `console.log('client', client)`.

```ts
// lib/log.ts
const REDACT = /(?<=")(email|telephone|adresse|nom|iban|signature_image|transcription)(?=":)/
export function log(evt: string, ctx: { tenantId?: string; userId?: string }, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    ts: new Date().toISOString(), evt,
    tenant: ctx.tenantId, user: ctx.userId,   // identifiants opaques, jamais d'email
    ...redact(data),                          // whitelist de clés + troncature à 500 car.
  }))
}
```

**Les logs ne doivent pas devenir la fuite** : c'est une exigence à traiter explicitement, parce qu'un CRM d'assainissement manipule des adresses de domicile, des téléphones, des transcriptions vocales et des bulletins de paie. Trois règles : (1) whitelist de champs loggables, jamais une blacklist ; (2) jamais de payload complet — l'id de la ressource suffit à retrouver la donnée dans la base ; (3) rétention courte (30 jours) et région EU chez le fournisseur de logs, avec DPA signé. Le `beforeSend` de Sentry supprime `request.data`, `cookies`, et masque les URL contenant un token de signature SMS.

**Monitoring d'erreurs.** Sentry (Team, 26 $/mo, 50 k événements) : c'est le seul qui donne le contexte source-map Next.js server + client sans travail. Alternatives évaluées : GlitchTip auto-hébergé (compatible SDK Sentry, ~7 €/mo sur un VPS Scaleway, mais c'est un serveur de plus à maintenir — refusé pour un exploitant solo), Highlight/Bugsnag (pas d'avantage décisif), les Vercel Runtime Logs seuls (rétention 1 h en Pro, pas d'agrégation — insuffisant). Le `tenant_id` est poussé en tag Sentry : on filtre les erreurs par client, on répond « ça touche 3 clients sur 50 » en dix secondes.

**Traçabilité des accès aux données personnelles (RGPD art. 30/32)** — table append-only, dans la base, scopée tenant :

```sql
create table public.audit_log (
  id bigserial primary key,
  tenant_id uuid not null, actor_id uuid, actor_role app_role,
  action text not null,               -- 'client.read','paie.export','intervention.delete'
  resource_type text, resource_id uuid,
  ip inet, user_agent text, at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy read_own on public.audit_log for select to authenticated
  using (tenant_id = public.jwt_tenant() and public.jwt_role() in ('proprietaire','admin'));
revoke update, delete on public.audit_log from authenticated;  -- append-only
```

Journalisé systématiquement : export de données, consultation d'un dossier client complet, accès paie, modification de rôle, connexion/échec de connexion (la table `connexions_log` existante fusionne ici), usage de `service_role`. Rétention 12 mois puis agrégation. Ne **pas** journaliser chaque `SELECT` de liste : le volume tuerait l'intérêt et créerait lui-même un entrepôt de PII.

**Alerting pour une personne seule.** Le seul risque réel n'est pas le manque d'alertes, c'est leur banalisation.

- *Réveiller la nuit (SMS/push)* : app down > 5 min (Better Uptime, gratuit), base injoignable, taux d'erreur 5xx > 5 % sur 10 min, échec du backup nocturne, quota Supabase > 90 %.
- *Email, traité le matin* : nouvelle erreur Sentry non vue, pic d'erreurs sur un tenant, job cron échoué, dépense IA > seuil quotidien, certificat/jeton OAuth expirant sous 7 jours.
- *Jamais d'alerte* : erreurs 4xx isolées, latence ponctuelle, échecs d'envoi email unitaires, warnings de dépendances. Ils vont dans le tableau de bord, pas dans le téléphone.

**Métriques produit et santé par tenant** + **tableau de bord d'exploitation** : une page `/admin/plateforme` (accessible au seul rôle plateforme, hors tenants) alimentée par une vue matérialisée rafraîchie toutes les 15 min — par client : interventions/mois, utilisateurs actifs 7 j, stockage consommé, appels IA et coût associé, SMS envoyés, taux d'erreur, dernière connexion, date de dernier backup vérifié. C'est cette page qui détecte le churn (chute d'activité) **et** le client qui coûte plus qu'il ne rapporte, avant la facture.

---

## 6. Sécurité applicative de la plateforme

**Rate-limiting.** Vercel serverless n'a pas d'état partagé : il faut un compteur externe. `@upstash/ratelimit` + Upstash Redis (gratuit jusqu'à 10 k commandes/jour, 10 $/mo ensuite), en *sliding window*, appliqué dans le middleware **avant** l'authentification :

```ts
const byIp     = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m'), prefix: 'ip' })
const byLogin  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '15 m'), prefix: 'login' })  // + backoff
const byTenant = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1000, '1 m'), prefix: 'tenant' })
const byAi     = new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(50, '1 d'), prefix: 'ai' })       // budget IA
```

Trois dimensions parce qu'elles répondent à trois menaces : l'IP contre le scan, le compte contre le *credential stuffing*, le tenant contre le client qui sature la plateforme pour les autres (voisin bruyant). Les routes IA et les envois SMS/email ont leur propre quota : ce sont les seules qui coûtent de l'argent à l'appel.

**WAF / anti-bot** : Vercel Firewall (inclus en Pro) — règles managées OWASP, blocage par pays hors zone d'activité pour les routes d'administration, challenge sur `/login`. Cloudflare en amont si l'on quitte Vercel. Pas de solution anti-bot payante avant d'observer un abus réel.

**En-têtes de sécurité.** CSP réaliste pour cette app (Leaflet + tuiles OSM, Google Fonts, images Supabase, Vercel Analytics), avec nonce généré dans le middleware :

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{NONCE}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com;
  font-src 'self' https://fonts.gstatic.com data:;
  img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org;
  media-src 'self' blob: https://*.supabase.co;
  connect-src 'self' https://*.supabase.co https://*.tile.openstreetmap.org https://*.ingest.sentry.io;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';
  upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(self), microphone=(self), geolocation=(self), payment=()
```

`style-src 'unsafe-inline'` est un compromis assumé : Leaflet et Tailwind injectent des styles inline. Déploiement en deux temps — `Content-Security-Policy-Report-Only` pendant deux semaines avec collecte des violations dans Sentry, puis bascule en mode bloquant. `X-Frame-Options: SAMEORIGIN` est remplacé par `frame-ancestors 'none'`.

**Uploads.** Validation par magic bytes côté serveur (`file-type`), jamais par l'extension ni le `Content-Type` du client (faille M1) ; allow-list stricte `image/jpeg|png|webp|heic`, `video/mp4|quicktime`, `application/pdf` ; plafond de taille par type (photo 15 Mo, vidéo 500 Mo, PDF 25 Mo) ; nom de fichier régénéré côté serveur (jamais celui du client) ; `Content-Type` imposé au stockage ; `Content-Disposition: attachment` au téléchargement des PDF. **Antivirus** : pas de ClamAV en ligne dans une fonction serverless (300 Mo de signatures, démarrage à froid rédhibitoire). Solution proportionnée : les fichiers ne sont jamais réservis à d'autres tenants ni exécutés, et un scan asynchrone via l'API VirusTotal (gratuit, 4 req/min) est déclenché sur les seuls PDF entrants **de tiers** (relevés bancaires, documents RH) ; fichier mis en quarantaine tant que le verdict n'est pas revenu. Le risque résiduel est accepté et documenté.

**Storage isolé par tenant.** Les buckets actuels sont publics (`getPublicUrl` partout : `photos`, `pdfs`, `videos`, `signatures`, `rh`) — c'est le vecteur de la PII exposée. Cible : **buckets privés**, chemin `{{tenant_id}}/{{type}}/{{annee}}/{{ressource_id}}/{{uuid}}.{{ext}}`, accès par URL signée à durée courte (5 min pour un PDF, 60 min pour une vidéo), et policy Storage RLS :

```sql
create policy tenant_files on storage.objects for all to authenticated
using (bucket_id in ('photos','pdfs','videos','signatures','rh')
       and (storage.foldername(name))[1] = public.jwt_tenant()::text);
```

Le seul contenu réellement public (photos de réalisations publiées sur le site vitrine) part dans un bucket `public-realisations` distinct, alimenté par copie explicite au moment de la publication — jamais par lien direct vers le bucket de production.

**Signature des webhooks.** Entrants (Resend, Brevo, Stripe le jour venu) : vérification HMAC-SHA256 en temps constant + horodatage < 5 min + table `webhook_events(provider, event_id)` en clé unique pour l'idempotence. Sortants (publication vers le site Django, `LTDB_PUBLISH_TOKEN` aujourd'hui en jeton statique committé) : passage à un HMAC par tenant avec `timestamp` et `nonce` dans l'en-tête, secret stocké dans `tenant_secrets`. Les crons Vercel exigent l'en-tête `Authorization: Bearer $CRON_SECRET` (contrôle absent aujourd'hui — `/api/cron/` est un préfixe public du middleware).

---

## 7. Coûts mensuels estimés

Hypothèses par client : 60 interventions/mois, 3 utilisateurs, 25 rapports générés par IA, 8 Go de fichiers cumulés/an, 120 SMS et 200 emails par mois.

| Poste | 1 client | 10 clients | 50 clients | 200 clients |
|---|---|---|---|---|
| Vercel (Pro 20 $ + usage) | 20 $ | 35 $ | 90 $ | 260 $ |
| — dont rendu vidéo Remotion (3 Go × 300 s) | ~2 $ | 20 $ | 100 $ | 400 $ |
| Supabase (Pro 25 $ + compute) | 25 $ | 25 $ (Micro) | 85 $ (Medium) | 235 $ (XL) |
| Supabase PITR | — | 100 $ | 100 $ | 100 $ |
| Supabase stockage + egress | 2 $ | 15 $ | 80 $ | 320 $ |
| Resend | 0 $ | 20 $ | 90 $ | 190 $ |
| SMS (Brevo, ~0,045 €) | 6 $ | 55 $ | 270 $ | 1 080 $ |
| IA (Claude Sonnet/Haiku) | 15 $ | 130 $ | 600 $ | 2 300 $ |
| Sentry + Upstash + Better Uptime + B2 | 5 $ | 40 $ | 55 $ | 90 $ |
| **Total** | **~75 $** | **~440 $** | **~1 470 $** | **~4 975 $** |
| **Par client** | 75 $ | 44 $ | 29 $ | 25 $ |

**Le poste qui explose en premier : l'IA**, devant les SMS. Il est *variable et non plafonné* — un client qui génère 200 rapports au lieu de 25 multiplie sa facture par huit sans qu'aucun compteur ne s'y oppose aujourd'hui. Leviers, dans l'ordre : (1) router vers Haiku les tâches d'extraction/normalisation et réserver Sonnet à la rédaction (−60 % sur le mix) ; (2) *prompt caching* sur le préambule métier, identique à chaque appel (−40 % sur les tokens d'entrée) ; (3) quota `ai:generate` par tenant et par jour, en Redis, avec dépassement facturé à l'usage ; (4) tableau de bord du coût IA par client, décision commerciale mensuelle. Les SMS se maîtrisent différemment : ils sont refacturés au client au prix coûtant + marge, jamais absorbés.

Le rendu vidéo Remotion (3 008 Mo × 300 s par fonction) est le piège discret : sa mémoire est facturée, et le poste passe de 2 $ à 400 $ entre 1 et 200 clients. À 50 clients, il faut le sortir des fonctions Vercel vers Remotion Lambda ou un worker dédié.

**Seuils de plan à connaître** : Supabase Pro **dès le 2ᵉ client payant** (backups + support) ; compute Small → Medium vers **25-30 clients** (surveiller le CPU > 70 % soutenu et `disk_iops`) ; Medium → Large/XL vers **120 clients** ; le plan Team à 599 $ ne se justifie **que** si un client exige un rapport SOC 2 — sinon, l'add-on PITR seul suffit. Vercel Pro tient jusqu'à ~200 clients ; l'Enterprise n'a d'intérêt que pour un SLA contractuel. Resend Pro (20 $) à ~3 000 emails, Scale (90 $) à ~50 000.

---

## 8. Hébergement : rester ou partir ?

**Recommandation tranchée : rester sur Vercel + Supabase jusqu'à 200 clients**, avec deux corrections non négociables et une porte de sortie préparée.

Corrections immédiates : (1) le projet Supabase doit être en région **`eu-west-3` (Paris)** ou `eu-central-1` — à vérifier aujourd'hui, une bascule de région implique une migration ; (2) DPA signés avec Vercel, Supabase, Resend, Brevo, Anthropic et Sentry, avec CCT pour les transferts hors UE, et registre des sous-traitants tenu à jour (RGPD art. 28/30). Vercel et Supabase sont des sociétés américaines : même avec des données stockées en France, le CLOUD Act reste une exposition juridique. Pour un CRM d'artisan du BTP, c'est un risque acceptable et documentable ; pour de la santé (HDS) ou du secteur public (SecNumCloud), non.

| Option | Coût à 50 clients | Souveraineté | Charge solo | Verdict |
|---|---|---|---|---|
| **Vercel + Supabase (EU)** | ~1 470 $ | données EU, sociétés US | **~2 h/mois** | **Recommandé** |
| Scaleway (Serverless Containers + PG managé) | ~600 € | pleine, France | ~10 h/mois (CI/CD, images, PITR à câbler) | Si exigence de souveraineté |
| Clever Cloud | ~700 € | pleine, France, `git push` déploie | ~5 h/mois | Meilleur compromis souverain |
| OVH (VPS + PG managé) | ~350 € | pleine | ~20 h/mois (OS, TLS, monitoring, backups) | Non — le temps coûte plus que l'économie |
| Supabase self-hosted | ~250 € + serveur | pleine | ~25 h/mois (Auth, Storage, Realtime, upgrades) | **Non** |

Le calcul décisif n'est pas le prix mensuel mais le **coût du temps**. Passer de Vercel/Supabase à Scaleway économise ~800 $/mo à 50 clients mais consomme 8 à 18 h/mois d'exploitation. Pour un entrepreneur solo dont l'heure vaut plus de 50 €, la migration détruit de la valeur — et supprime surtout ce que Supabase fournit gratuitement et qu'il faudrait réécrire : Auth, MFA, RLS, Storage avec URLs signées, PITR.

**Seuils de bascule, écrits à l'avance :**

- **Basculer si** un client sous contrat exige HDS, SecNumCloud ou l'hébergement chez un fournisseur français — cible **Clever Cloud** (Paris, PostgreSQL managé, déploiement par `git push`), avec Supabase Auth remplacé par Auth.js + Keycloak. Compter 6 à 10 semaines de travail.
- **Basculer si** la facture plateforme dépasse **30 % du chiffre d'affaires récurrent** (à 25 $/client pour un abonnement à 80-120 €/mois, on est à 20-30 % : correct, à surveiller).
- **Basculer si** Supabase impose le plan Team (599 $) pour une raison technique et non commerciale.
- **Ne pas basculer** parce que « c'est américain » : la réponse proportionnée est un DPA, la région EU, le chiffrement applicatif des secrets par tenant (§3) et la réversibilité par export (§4) — pas une migration d'infrastructure.

---

## Ordre d'exécution recommandé

1. **Fondations base** — `tenants`, `memberships`, `tenant_id` partout, index composites, `force row level security` avec les policies génératives.
2. **Auth** — Supabase Auth, hook de claims, `supabaseAsUser()` / `supabaseAdmin(reason)`, suppression de `lib/auth-users.ts` et des variables `AUTH_USER_*`/`AUTH_TECH_*`.
3. **Autorisation** — `route()` + matrice de permissions + le test de couverture ; les 138 routes migrent par lots, le test rouge jusqu'à la dernière.
4. **Storage privé** + validation par magic bytes + URLs signées (ferme la fuite de PII).
5. **Secrets par tenant chiffrés**, purge de `.env.local.example`, révocation de `LTDB_PUBLISH_TOKEN`.
6. **CSP/HSTS en report-only**, rate-limiting Upstash, secret des crons.
7. **Observabilité** — Sentry avec `tenant_id`, `audit_log`, backup B2 nocturne, alertes en deux niveaux.
8. **Test de restauration mono-tenant**, chronométré et documenté, **avant** le premier client payant.

Les étapes 1 à 4 sont bloquantes pour l'ouverture à un deuxième client. Les étapes 5 à 8 peuvent s'étaler sur le premier trimestre d'exploitation.

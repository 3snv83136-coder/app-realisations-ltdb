# 04 — Système de qualité automatisée : CI/CD déterministe + flotte d'agents

> **Statut** : conception, rien n'est implémenté à ce jour.
> **Périmètre** : dépôt `app-realisations-ltdb`, en cours de transformation en
> SaaS multi-clients sur base Supabase unique et déploiement Vercel unique.
> **Ce document ne modifie aucun fichier applicatif.** Tout le code qu'il
> contient est prêt à être copié, mais rien n'a été installé.

---

## Sommaire

- [0. État des lieux vérifié](#0-état-des-lieux-vérifié)
- [1. Le principe fondateur : la vérité et l'avis](#1-le-principe-fondateur--la-vérité-et-lavis)
- [VOLET A — La chaîne de vérification déterministe](#volet-a--la-chaîne-de-vérification-déterministe)
  - [A.1 La pyramide de tests](#a1-la-pyramide-de-tests)
  - [A.2 Tests unitaires — Vitest](#a2-tests-unitaires--vitest)
  - [A.3 Tests d'intégration des routes API](#a3-tests-dintégration-des-routes-api)
  - [A.4 Le test des 138 routes : nul n'échappe au garde-fou](#a4-le-test-des-138-routes--nul-néchappe-au-garde-fou)
  - [A.5 Tests d'isolation entre clients — le cœur du sujet](#a5-tests-disolation-entre-clients--le-cœur-du-sujet)
  - [A.6 Tests end-to-end — Playwright](#a6-tests-end-to-end--playwright)
  - [A.7 Le pipeline GitHub Actions](#a7-le-pipeline-github-actions)
  - [A.8 Sécurité en continu](#a8-sécurité-en-continu)
  - [A.9 Migrations sur base unique partagée](#a9-migrations-sur-base-unique-partagée)
- [VOLET B — La flotte d'agents Claude Code](#volet-b--la-flotte-dagents-claude-code)
  - [B.1 Tableau de la flotte](#b1-tableau-de-la-flotte)
  - [B.2 Fichiers de définition](#b2-fichiers-de-définition)
  - [B.3 Les hooks — la couche réflexe](#b3-les-hooks--la-couche-réflexe)
  - [B.4 Arbitrage coût / modèle](#b4-arbitrage-coût--modèle)
  - [B.5 Ce qu'un agent ne remplacera jamais](#b5-ce-quun-agent-ne-remplacera-jamais)
- [VOLET C — Le flux de bout en bout](#volet-c--le-flux-de-bout-en-bout)
- [Plan d'implémentation en 4 paliers](#plan-dimplémentation-en-4-paliers)
- [Annexe — fichiers à créer, récapitulatif](#annexe--fichiers-à-créer-récapitulatif)

**Définitions d'agents, prêtes à copier dans `.claude/agents/`** :

| Fichier | Agent |
|---|---|
| [`agents/00-chef-qualite.md`](agents/00-chef-qualite.md) | Chef d'orchestre |
| [`agents/01-gardien-multitenant.md`](agents/01-gardien-multitenant.md) | Isolation entre clients |
| [`agents/02-auditeur-securite.md`](agents/02-auditeur-securite.md) | Sécurité applicative |
| [`agents/03-gardien-rgpd.md`](agents/03-gardien-rgpd.md) | Données personnelles |
| [`agents/04-reviseur-migrations.md`](agents/04-reviseur-migrations.md) | Migrations SQL |
| [`agents/05-controleur-tests.md`](agents/05-controleur-tests.md) | Couverture de tests |
| [`agents/06-veilleur-performance.md`](agents/06-veilleur-performance.md) | Performance et coût |
| [`agents/07-scribe-coherence.md`](agents/07-scribe-coherence.md) | Types et documentation |

---

## 0. État des lieux vérifié

Tout ce qui suit a été constaté dans le dépôt, pas supposé.

| Sujet | Constat |
|---|---|
| Tests automatisés | **Aucun.** Pas de Vitest, pas de Jest, pas de config Playwright. `playwright` est en `devDependencies` mais sans `playwright.config.ts` ni dossier de tests. |
| Scripts existants | ~30 fichiers `scripts/*.ts` lancés à la main via `tsx` (`test:e2e`, `test:remotion`…). Ils appellent la **vraie** base et les **vrais** services (Resend, Brevo, Supabase). Inexploitables en CI en l'état. |
| Intégration continue | **Aucune.** Pas de dossier `.github/`. |
| Agents / hooks Claude Code | **Aucun.** Pas de dossier `.claude/`. |
| Routes API | **138** fichiers `app/api/**/route.ts`. |
| Contrôle d'accès | Centralisé dans `middleware.ts` (`matcher: ["/api/:path*", …]`). Une majorité de handlers ne refont **aucune** vérification : ils sont protégés par leur préfixe d'URL. |
| Accès base | `lib/supabase.ts` crée un client unique avec `SUPABASE_SERVICE_ROLE_KEY`, mis en cache au niveau module. |
| RLS | Activée par `032_security_rls_remediation.sql`, mais **contournée** par `service_role` — elle ne protège que contre la clé `anon`. |
| Migrations | 35 fichiers `001_` → `035_`, appliqués à la main, **sans script de retour arrière**, sans `supabase/config.toml`. |
| Tables | 23 : `clients`, `interventions`, `documents`, `accords_intervention`, `lignes_devis`, `tarifs`, `techniciens`, `comptes_techniciens`, `connexions_log`, `demo_access`, `document_counters`, `factures_fournisseurs`, `fiches_paie`, `operations_bancaires`, `comptes_bancaires`, `parametres`, `pre_bilans`, `relances_planifiees`, `releves_bancaires`, `salaries`, `salarie_documents`, `salarie_documents_generes`, `social_tokens`. |
| Buckets Storage | `intervention-pdfs`, `interventions-photos`, `intervention-videos`. |
| Notion d'organisation | **Inexistante.** Aucune colonne `organisation_id` / `tenant_id` nulle part. |

### Les trois dangers qui commandent toute la conception

**Danger 1 — il n'existe aucune barrière technique entre deux clients.**
Puisque l'application parle à PostgreSQL avec `service_role`, la RLS ne
s'applique pas à elle. La seule chose qui empêchera les données du client A
d'apparaître chez le client B, c'est un `.eq('organisation_id', …)` écrit à la
main dans chaque requête. Un oubli, une seule fois, sur une seule route, et
c'est une fuite. Les tests d'isolation (§ A.5) et le gardien multi-tenant
(§ B) sont la réponse à ce danger, et ils sont non négociables.

**Danger 2 — le contrôle d'accès est implicite.**
`middleware.ts` protège par préfixe d'URL. Pire, il contient ceci :

```ts
if (!process.env.AUTH_USER_1 && !process.env.AUTH_TECH_1) {
  return NextResponse.next()
}
```

Si ces deux variables manquent — une preview Vercel, un environnement de
préproduction créé à la va-vite — **l'application entière devient publique**,
sans erreur, sans alerte. C'est un mode d'ouverture par défaut. Le test
`middleware-fail-open.test.ts` (§ A.4) verrouille ce comportement.

**Danger 3 — une migration ratée casse tous les clients à la fois.**
Base unique, pas de rollback écrit, application manuelle. Aujourd'hui le
propriétaire est le seul client, donc l'erreur est réparable. Avec vingt
clients, une restauration de sauvegarde pour réparer le client A détruit le
travail de la journée des dix-neuf autres. Le § A.9 traite ce point.

---

## 1. Le principe fondateur : la vérité et l'avis

Il y a deux systèmes dans ce document, et les confondre ferait plus de mal que
de n'en avoir aucun.

|  | **La chaîne déterministe** (volet A) | **La flotte d'agents** (volet B) |
|---|---|---|
| Nature | Tests, compilateur, linters, scanners | Modèles de langage |
| Réponse | Identique à chaque exécution | Variable d'une exécution à l'autre |
| Rôle | **La vérité.** Bloque la fusion. | **L'avis.** Informe l'humain. |
| Peut se tromper ? | Oui, mais toujours de la même façon — donc on le corrige une fois | Oui, différemment à chaque fois — on ne peut pas corriger une fois pour toutes |
| Autorité | Bloquante | Consultative |

### Les trois règles qui découlent

1. **Un agent ne débloque jamais un test rouge.** Aucune formulation
   (« ce n'est qu'un test fragile », « je confirme que le comportement est
   correct ») n'autorise à passer outre. Si le test est mauvais, on corrige le
   test dans un commit à part, avec sa justification.

2. **On ne fusionne pas sur l'approbation d'un agent.** Un agent produit un
   rapport que l'humain lit. La fusion est autorisée par la CI verte plus une
   décision humaine.

3. **Quand un agent trouve un vrai problème, on écrit le test qui l'aurait
   attrapé.** C'est la boucle vertueuse : chaque constat d'agent qui se révèle
   fondé devient une règle déterministe, et le même problème ne repassera plus
   jamais par le jugement. Les agents servent à découvrir les règles ; la CI
   sert à les appliquer.

Autrement dit : **la flotte d'agents est un radar, pas un garde-barrière.**
Le garde-barrière, c'est GitHub Actions.

---

# VOLET A — La chaîne de vérification déterministe

## A.1 La pyramide de tests

Adaptée à cette application précise, avec des ordres de grandeur cibles à
six mois. Ce ne sont pas des objectifs de couverture à atteindre pour la
statistique, mais une répartition d'effort.

```
                     ┌───────────────────────────────┐
                     │  E2E Playwright   ~15 tests   │  3-8 min
                     │  parcours vitaux uniquement   │  fragile, cher
                     ├───────────────────────────────┤
                     │  Isolation tenant  ~40 tests  │  1-2 min
                     │  ★ NON NÉGOCIABLE ★           │  base éphémère
                     ├───────────────────────────────┤
                     │  Gardes de routes   3 tests   │  < 5 s
                     │  balaient les 138 routes      │  analyse statique
                     ├───────────────────────────────┤
                     │  Intégration API  ~60 tests   │  30-60 s
                     │  handler + Supabase simulé    │
                     ├───────────────────────────────┤
                     │  Unitaires       ~250 tests   │  < 10 s
                     │  lib/ — calculs, dates, TVA   │  rapides, stables
                     └───────────────────────────────┘
```

Le palier « gardes de routes » est spécifique à ce projet : il n'exécute rien,
il **lit le code source** des 138 routes et vérifie une propriété structurelle.
Il coûte quelques secondes et attrape la classe d'erreurs la plus coûteuse
(une route oubliée). C'est le meilleur rapport sécurité/effort du document.

---

## A.2 Tests unitaires — Vitest

### Pourquoi Vitest et pas Jest

| Critère | Vitest | Jest |
|---|---|---|
| TypeScript + ESM | Natif, via esbuild. Le dépôt est en `"module": "esnext"`, `"moduleResolution": "bundler"` — Jest demanderait `ts-jest` ou Babel et une configuration de transformation. | Friction connue sur ESM |
| Alias `@/*` | Une ligne dans `vite.config` | `moduleNameMapper` à maintenir |
| Vitesse | Démarrage < 1 s, mode watch instantané | Plus lent au démarrage |
| API | Compatible Jest (`describe`, `it`, `expect`, `vi.mock`) — aucune connaissance nouvelle à acquérir | — |
| Couverture | `@vitest/coverage-v8`, intégré | `babel-plugin-istanbul` |
| Playwright | Coexiste sans conflit | Idem |

Pour un développeur solo qui code avec Claude Code, l'argument décisif est le
temps de boucle : Vitest en watch rend un verdict en moins d'une seconde,
donc les tests sont réellement lancés pendant l'écriture.

### Installation

```bash
npm i -D vitest @vitest/coverage-v8 vite-tsconfig-paths @vitejs/plugin-react happy-dom
```

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    testTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['lib/**/*.ts', 'app/api/**/route.ts'],
      exclude: ['lib/**/*.d.ts'],
      // Palier initial volontairement bas : on ne met pas un seuil
      // inatteignable qui pousserait à écrire des tests décoratifs.
      // On le remonte de 5 points par mois.
      thresholds: { lines: 25, functions: 25, branches: 20, statements: 25 },
    },
  },
})
```

### `tests/setup.ts`

```ts
import { beforeEach, vi } from 'vitest'

// Aucune clé réelle ne doit jamais atteindre un test.
process.env.SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.INTERNAL_API_SECRET = 'test-internal-secret'
process.env.AUTH_USER_1 = 'test:hash'
process.env.RESEND_API_KEY = ''
process.env.BREVO_API_KEY = ''

// Filet de sécurité : aucun test ne doit sortir sur le réseau.
const vraiFetch = globalThis.fetch
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (url.startsWith('http://localhost')) return vraiFetch(input, init)
  throw new Error(
    `Appel réseau interdit en test : ${url}. Simule ce service (vi.mock).`,
  )
}) as typeof fetch

beforeEach(() => { vi.clearAllMocks() })
```

### Exemples réels, tirés du code de ce dépôt

`tests/unit/echeance.test.ts` — les échéances de facture, avec la règle
fin-de-mois de `lib/echeance.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { calculerEcheance, dernierJourDuMois } from '@/lib/echeance'

describe('dernierJourDuMois', () => {
  it('gère les mois à 30 et 31 jours', () => {
    expect(dernierJourDuMois(new Date('2026-04-10')).getDate()).toBe(30)
    expect(dernierJourDuMois(new Date('2026-01-10')).getDate()).toBe(31)
  })

  it('gère février en année bissextile', () => {
    expect(dernierJourDuMois(new Date('2024-02-05')).getDate()).toBe(29)
    expect(dernierJourDuMois(new Date('2026-02-05')).getDate()).toBe(28)
  })
})

describe('calculerEcheance', () => {
  it('ne recule jamais avant la date d\'émission', () => {
    const emission = new Date('2026-03-31')
    expect(calculerEcheance(emission, 30).getTime())
      .toBeGreaterThanOrEqual(emission.getTime())
  })

  it('ne dépend pas de l\'heure locale d\'exécution', () => {
    const a = calculerEcheance(new Date('2026-03-30T23:59:00Z'), 30)
    const b = calculerEcheance(new Date('2026-03-30T00:01:00Z'), 30)
    expect(a.toISOString().slice(0, 10)).toBe(b.toISOString().slice(0, 10))
  })
})
```

`tests/unit/numero.test.ts` — la numérotation des documents. En comptabilité
française, une séquence de factures doit être **continue et sans trou**, et en
SaaS elle doit l'être **par organisation** :

```ts
import { describe, it, expect } from 'vitest'
import { formatNumero, parseNumero } from '@/lib/numero'

describe('numérotation des documents', () => {
  it('formate sur une largeur fixe et reste triable en texte', () => {
    expect(formatNumero('FA', 2026, 7)).toBe('FA-2026-0007')
    const serie = [1, 2, 10, 11, 100].map(n => formatNumero('FA', 2026, n))
    expect([...serie].sort()).toEqual(serie) // tri lexical == tri numérique
  })

  it('fait un aller-retour sans perte', () => {
    expect(parseNumero(formatNumero('DE', 2026, 42)))
      .toEqual({ prefixe: 'DE', annee: 2026, rang: 42 })
  })

  it('refuse un rang nul ou négatif', () => {
    expect(() => formatNumero('FA', 2026, 0)).toThrow()
  })
})
```

`tests/unit/publish-sanitize.test.ts` — le sanitizer qui protège la vie privée
des clients avant publication publique d'une réalisation :

```ts
import { describe, it, expect } from 'vitest'
import { sanitizePublicContent } from '@/lib/publish-sanitize'

describe('sanitizePublicContent', () => {
  it('retire le nom de famille du client', () => {
    const out = sanitizePublicContent(
      'Intervention chez M. Dupont, 12 rue des Lilas, Toulon.',
      { clientNom: 'Dupont', adresse: '12 rue des Lilas' },
    )
    expect(out).not.toMatch(/Dupont/i)
    expect(out).not.toMatch(/12 rue des Lilas/i)
    expect(out).toMatch(/Toulon/) // la ville reste, c'est le but SEO
  })

  it('retire aussi les numéros de téléphone français', () => {
    const out = sanitizePublicContent('Rappeler le 06 12 34 56 78.', {})
    expect(out).not.toMatch(/06[ .-]?12/)
  })
})
```

Scripts à ajouter dans `package.json` :

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:guards": "vitest run tests/guards",
    "test:integration": "vitest run tests/integration",
    "test:isolation": "vitest run tests/isolation",
    "test:coverage": "vitest run --coverage",
    "test:e2e:pw": "playwright test",
    "typecheck": "tsc --noEmit"
  }
}
```

> Note : `tsconfig.json` exclut aujourd'hui `scripts`. Il faudra ajouter
> `tests` à `include` (ou le laisser couvert par `**/*.ts`) et vérifier que
> `npm run typecheck` couvre bien les tests — un test qui ne compile pas est
> un test qui ne tourne pas.

---

## A.3 Tests d'intégration des routes API

Une route App Router est une fonction exportée. On peut l'appeler directement
avec un objet `Request`, sans lancer de serveur — c'est rapide et fiable.

`tests/helpers/supabase-mock.ts` — un faux client Supabase qui **enregistre les
filtres appliqués**. C'est ce détail qui rend les tests d'isolation possibles :
on peut affirmer non seulement « la réponse est correcte » mais « la requête
partie vers la base était bien scopée ».

```ts
import { vi } from 'vitest'

export type RequeteEnregistree = {
  table: string
  operation: 'select' | 'insert' | 'update' | 'delete'
  filtres: Array<{ methode: string; colonne: string; valeur: unknown }>
}

export function creerSupabaseSimule(donnees: Record<string, unknown[]> = {}) {
  const requetes: RequeteEnregistree[] = []

  const constructeur = (table: string, operation: RequeteEnregistree['operation']) => {
    const trace: RequeteEnregistree = { table, operation, filtres: [] }
    requetes.push(trace)

    const chaine: Record<string, unknown> = {}
    for (const m of ['eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt', 'like', 'ilike']) {
      chaine[m] = (colonne: string, valeur: unknown) => {
        trace.filtres.push({ methode: m, colonne, valeur })
        return chaine
      }
    }
    for (const m of ['select', 'order', 'limit', 'range']) {
      chaine[m] = () => chaine
    }
    const resultat = { data: donnees[table] ?? [], error: null }
    chaine.single = async () => ({ data: (donnees[table] ?? [])[0] ?? null, error: null })
    chaine.maybeSingle = chaine.single
    chaine.then = (r: (v: unknown) => unknown) => Promise.resolve(resultat).then(r)
    return chaine
  }

  const client = {
    from: (table: string) => ({
      select: (...a: unknown[]) => (constructeur(table, 'select') as any).select(...a),
      insert: () => constructeur(table, 'insert'),
      update: () => constructeur(table, 'update'),
      delete: () => constructeur(table, 'delete'),
      upsert: () => constructeur(table, 'insert'),
    }),
    storage: {
      from: () => ({
        upload: vi.fn(async () => ({ data: { path: 'p' }, error: null })),
        remove: vi.fn(async () => ({ data: null, error: null })),
        list: vi.fn(async () => ({ data: [], error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://x/p' } })),
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: 'http://x/s' }, error: null })),
      }),
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }

  return {
    client,
    requetes,
    /** Toutes les requêtes sur `table` portaient-elles un filtre sur `colonne` ? */
    toutesScopeesPar(colonne: string): boolean {
      return requetes.every(r =>
        r.filtres.some(f => f.colonne === colonne),
      )
    },
    requetesNonScopees(colonne: string): RequeteEnregistree[] {
      return requetes.filter(r => !r.filtres.some(f => f.colonne === colonne))
    },
  }
}
```

`tests/helpers/session.ts` :

```ts
import { vi } from 'vitest'

export function simulerSession(user: {
  role?: 'admin' | 'tech'
  organisationId?: string
  technicienId?: string | null
  isDemo?: boolean
} | null) {
  vi.doMock('@/lib/auth', () => ({
    auth: vi.fn(async () => (user ? { user: { name: 'test', ...user } } : null)),
  }))
}

export function requete(url: string, init: RequestInit = {}) {
  return new Request(`http://localhost:3000${url}`, init)
}
```

Exemple complet — `tests/integration/api/interventions.test.ts` :

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { creerSupabaseSimule } from '../../helpers/supabase-mock'
import { simulerSession, requete } from '../../helpers/session'

describe('GET /api/interventions', () => {
  beforeEach(() => { vi.resetModules() })

  it('refuse un appel sans session', async () => {
    simulerSession(null)
    const sb = creerSupabaseSimule()
    vi.doMock('@/lib/supabase', () => ({
      getSupabaseOrNull: () => sb.client, getSupabase: () => sb.client,
    }))
    const { GET } = await import('@/app/api/interventions/route')
    const res = await GET(requete('/api/interventions') as never)
    expect([401, 403]).toContain(res.status)
  })

  it('scope toujours la requête sur l\'organisation de la session', async () => {
    simulerSession({ role: 'admin', organisationId: 'org-A' })
    const sb = creerSupabaseSimule({ interventions: [] })
    vi.doMock('@/lib/supabase', () => ({
      getSupabaseOrNull: () => sb.client, getSupabase: () => sb.client,
    }))
    const { GET } = await import('@/app/api/interventions/route')
    await GET(requete('/api/interventions') as never)

    expect(sb.requetesNonScopees('organisation_id')).toEqual([])
    const filtre = sb.requetes[0].filtres.find(f => f.colonne === 'organisation_id')
    expect(filtre?.valeur).toBe('org-A')
  })

  it('ignore un organisation_id fourni par le client (élévation)', async () => {
    simulerSession({ role: 'admin', organisationId: 'org-A' })
    const sb = creerSupabaseSimule({ interventions: [] })
    vi.doMock('@/lib/supabase', () => ({
      getSupabaseOrNull: () => sb.client, getSupabase: () => sb.client,
    }))
    const { GET } = await import('@/app/api/interventions/route')
    await GET(requete('/api/interventions?organisation_id=org-B') as never)

    const valeurs = sb.requetes.flatMap(r =>
      r.filtres.filter(f => f.colonne === 'organisation_id').map(f => f.valeur))
    expect(valeurs).not.toContain('org-B')
    expect(valeurs).toContain('org-A')
  })

  it('un technicien ne voit que ses propres interventions', async () => {
    simulerSession({ role: 'tech', organisationId: 'org-A', technicienId: 'tech-1' })
    const sb = creerSupabaseSimule({ interventions: [] })
    vi.doMock('@/lib/supabase', () => ({
      getSupabaseOrNull: () => sb.client, getSupabase: () => sb.client,
    }))
    const { GET } = await import('@/app/api/interventions/route')
    await GET(requete('/api/interventions') as never)

    expect(sb.requetes[0].filtres.map(f => f.colonne))
      .toEqual(expect.arrayContaining(['organisation_id', 'technicien_id']))
  })
})
```

---

## A.4 Le test des 138 routes : nul n'échappe au garde-fou

### Le problème

Dans six mois, il y aura 160 routes. Un jour, une route sera créée sans garde,
et personne ne le verra parce qu'elle *semblera* protégée par le middleware.
Le jour où un préfixe change, la fuite s'ouvre en silence.

### Le principe : liste blanche explicite et justifiée

On ne cherche pas à deviner si une route est protégée. On impose que **toute
route soit classée** : soit elle appelle un garde reconnu, soit elle figure
dans un registre public avec une justification écrite. Une route inconnue des
deux listes fait échouer la CI.

C'est le mécanisme qui rend l'oubli impossible : ajouter une route sans y
penser casse le build, et la seule façon de le réparer est de prendre une
décision consciente.

### `tests/guards/routes-publiques.json`

Registre initial, dérivé de `PUBLIC_PREFIXES` dans `middleware.ts`. Chaque
entrée demande une justification et un mécanisme de protection alternatif.

```json
{
  "$commentaire": "Routes volontairement accessibles sans session. Toute addition ici doit être revue par un humain ET par l'agent auditeur-securite. Le champ 'protection' ne peut jamais être vide.",
  "routes": [
    { "chemin": "app/api/auth/[...nextauth]/route.ts",
      "raison": "Point d'entrée NextAuth lui-même",
      "protection": "NextAuth" },
    { "chemin": "app/api/health/route.ts",
      "raison": "Sonde de disponibilité",
      "protection": "aucune donnée renvoyée — vérifié par tests/guards/health-fuite.test.ts" },
    { "chemin": "app/api/calendar.ics/route.ts",
      "raison": "Abonnement calendrier depuis une app tierce",
      "protection": "jeton signé dans l'URL (lib/calendar-token.ts)" },
    { "chemin": "app/api/proxy-image/route.ts",
      "raison": "Proxy d'images pour les PDF",
      "protection": "liste blanche de domaines" },
    { "chemin": "app/api/notify-client/stop-review/route.ts",
      "raison": "Lien de désinscription dans un SMS",
      "protection": "jeton opaque à usage unique" },
    { "chemin": "app/api/facture/stop-reminders/route.ts",
      "raison": "Lien de désinscription relances facture",
      "protection": "jeton opaque à usage unique" },
    { "chemin": "app/api/quote-complementaire/stop-reminders/route.ts",
      "raison": "Lien de désinscription relances devis",
      "protection": "jeton opaque à usage unique" }
  ],
  "cron": [
    { "prefixe": "app/api/cron/",
      "raison": "Appelées par le planificateur Vercel",
      "protection": "en-tête Authorization: Bearer CRON_SECRET, vérifié dans chaque handler" }
  ],
  "oauth": [
    { "prefixe": "app/api/oauth/",
      "raison": "Rappels OAuth des fournisseurs (Google, GMB, Facebook, TikTok)",
      "protection": "paramètre state signé + vérification côté fournisseur" }
  ]
}
```

### `tests/guards/routes-protegees.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import registre from './routes-publiques.json'

const RACINE = process.cwd()
const API = join(RACINE, 'app/api')

/** Appels reconnus comme établissant l'identité de l'appelant. */
const GARDES_AUTH = [
  'auth()',
  'getSessionUser(',
  'requireOwnerAdminApi(',
  'requireInterventionAccess(',
  'requireAccordAccess(',
  'assertInterventionAccess(',
  'isInternalApiCall(',
  'verifyCronAuth(',
]

/** Appels reconnus comme scopant la requête à une organisation. */
const GARDES_TENANT = [
  'organisation_id',
  'requireOrganisation(',
  'scopeOrganisation(',
]

function listerRoutes(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...listerRoutes(p))
    else if (e === 'route.ts' || e === 'route.tsx') out.push(p)
  }
  return out
}

const routes = listerRoutes(API).map(p => relative(RACINE, p)).sort()

const cheminsPublics = new Set(registre.routes.map(r => r.chemin))
const prefixesPublics = [...registre.cron, ...registre.oauth].map(r => r.prefixe)
const estPublique = (c: string) =>
  cheminsPublics.has(c) || prefixesPublics.some(p => c.startsWith(p))

describe('surface API', () => {
  it('découvre bien les routes (garde-fou du test lui-même)', () => {
    // Si ce chiffre chute brutalement, c'est que le test ne trouve plus rien
    // et donne un faux vert. Constaté au 2026-09-04 : 138 routes.
    expect(routes.length).toBeGreaterThanOrEqual(130)
  })

  it.each(routes)('%s appelle un garde d\'authentification', (chemin) => {
    if (estPublique(chemin)) return
    const src = readFileSync(join(RACINE, chemin), 'utf8')
    const trouve = GARDES_AUTH.filter(g => src.includes(g))
    expect(
      trouve.length,
      [
        `\n${chemin} : aucun garde d'authentification.`,
        `Attendus : ${GARDES_AUTH.join(', ')}`,
        '',
        'Le middleware ne suffit pas : il protège par préfixe d\'URL et',
        's\'ouvre entièrement si AUTH_USER_1 et AUTH_TECH_1 sont absents.',
        '',
        'Deux issues :',
        '  1. ajouter le garde dans le handler (recommandé) ;',
        '  2. si la route doit être publique, l\'inscrire dans',
        '     tests/guards/routes-publiques.json avec sa justification.',
      ].join('\n'),
    ).toBeGreaterThan(0)
  })

  it.each(routes)('%s scope ses requêtes sur l\'organisation', (chemin) => {
    if (estPublique(chemin)) return
    const src = readFileSync(join(RACINE, chemin), 'utf8')
    if (!src.includes('.from(')) return // route sans accès base
    expect(
      GARDES_TENANT.some(g => src.includes(g)),
      `\n${chemin} interroge la base sans référence à l'organisation.\n`
      + 'En base unique partagée, une requête non scopée lit les données\n'
      + 'de tous les clients.',
    ).toBe(true)
  })

  it('chaque route cron vérifie CRON_SECRET', () => {
    const crons = routes.filter(c => c.startsWith('app/api/cron/'))
    expect(crons.length).toBeGreaterThan(0)
    for (const c of crons) {
      const src = readFileSync(join(RACINE, c), 'utf8')
      expect(src, `${c} : /api/cron/ est public dans middleware.ts, `
        + 'le handler DOIT vérifier CRON_SECRET lui-même').toContain('CRON_SECRET')
    }
  })

  it('le registre des routes publiques ne contient pas de route fantôme', () => {
    for (const r of registre.routes) {
      expect(routes, `${r.chemin} est listé comme public mais n'existe plus. `
        + 'Nettoie le registre.').toContain(r.chemin)
      expect(r.protection.length, `${r.chemin} : champ "protection" vide`)
        .toBeGreaterThan(0)
    }
  })
})
```

### `tests/guards/middleware-fail-open.test.ts`

Ce test verrouille le danger 2. Il ne prétend pas corriger le comportement — il
le **rend visible** et empêche qu'il se propage silencieusement.

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('middleware.ts', 'utf8')

describe('middleware — ouverture par défaut', () => {
  it('documente explicitement le court-circuit sans variables d\'auth', () => {
    // Comportement actuel :
    //   if (!process.env.AUTH_USER_1 && !process.env.AUTH_TECH_1)
    //     return NextResponse.next()
    // Sur un environnement où ces variables manquent, TOUT est public.
    const aLeCourtCircuit = /!process\.env\.AUTH_USER_1[\s\S]{0,80}NextResponse\.next/.test(src)
    if (aLeCourtCircuit) {
      expect(
        src.includes('DANGER_OUVERTURE_SANS_AUTH'),
        'Le court-circuit d\'ouverture est présent sans marqueur explicite.\n'
        + 'Soit tu le supprimes (recommandé en production multi-clients),\n'
        + 'soit tu ajoutes le commentaire // DANGER_OUVERTURE_SANS_AUTH\n'
        + 'pour que ce choix reste conscient et repérable.',
      ).toBe(true)
    }
  })

  it('toutes les routes API passent par le matcher', () => {
    expect(src).toContain('"/api/:path*"')
  })

  it('aucun nouveau préfixe public n\'apparaît sans revue', () => {
    const bloc = src.match(/const PUBLIC_PREFIXES = \[([\s\S]*?)\]/)?.[1] ?? ''
    const prefixes = [...bloc.matchAll(/"([^"]+)"/g)].map(m => m[1]).sort()
    // Instantané validé le 2026-09-04. Toute modification est intentionnelle
    // et doit être accompagnée d'une justification en revue.
    expect(prefixes).toEqual([
      '/api/auth', '/api/calendar.ics', '/api/cron/', '/api/facture/stop-reminders',
      '/api/health', '/api/notify-client/stop-review', '/api/oauth',
      '/api/proxy-image', '/api/quote-complementaire/stop-reminders',
      '/login', '/mirabella', '/recup',
    ])
  })
})
```

### `tests/guards/service-role-cote-client.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

describe('clé service_role', () => {
  it('lib/supabase.ts n\'est jamais importé depuis un composant client', () => {
    const fichiers = execSync(
      `grep -rl "use client" components app --include=*.tsx --include=*.ts || true`,
    ).toString().split('\n').filter(Boolean)

    const coupables = fichiers.filter(f => {
      const s = readFileSync(f, 'utf8')
      return /from ['"]@\/lib\/supabase['"]/.test(s)
    })

    expect(coupables,
      'Ces composants client importent lib/supabase.ts, qui porte\n'
      + 'SUPABASE_SERVICE_ROLE_KEY. La clé maîtresse partirait dans le\n'
      + 'bundle navigateur.').toEqual([])
  })

  it('aucune variable secrète n\'est préfixée NEXT_PUBLIC_', () => {
    const exemple = readFileSync('.env.local.example', 'utf8')
    const publiques = [...exemple.matchAll(/^(NEXT_PUBLIC_[A-Z0-9_]+)/gm)].map(m => m[1])
    const interdits = /SECRET|KEY|TOKEN|PASSWORD|SERVICE_ROLE/
    expect(publiques.filter(v => interdits.test(v))).toEqual([])
  })
})
```

---

## A.5 Tests d'isolation entre clients — le cœur du sujet

C'est la suite la plus importante de tout le document. Elle tourne sur une
**vraie base PostgreSQL éphémère** (conteneur GitHub Actions), pas sur des
simulacres : on veut vérifier le comportement réel de PostgREST, des
contraintes et des index, pas la fidélité d'un faux client.

### Prérequis dans le schéma cible

```sql
create table if not exists organisations (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,
  slug         text not null unique,
  actif        boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Sur CHAQUE table métier :
alter table interventions add column organisation_id uuid
  references organisations(id) on delete restrict;
create index concurrently if not exists idx_interventions_org_date
  on interventions (organisation_id, date_prevue desc);
```

### `tests/isolation/fixtures.ts` — deux organisations complètes

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Org = {
  id: string
  slug: string
  clientId: string
  technicienId: string
  interventionId: string
  documentId: string
  accordId: string
  cheminPdf: string
}

export function clientTest(): SupabaseClient {
  const url = process.env.TEST_SUPABASE_URL
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Base de test non configurée')
  if (url.includes('.supabase.co') && !url.includes('test')) {
    throw new Error('REFUS : la suite d\'isolation ne tourne jamais sur une base distante de production')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function creerOrganisation(sb: SupabaseClient, slug: string): Promise<Org> {
  const { data: org, error } = await sb.from('organisations')
    .insert({ nom: `Test ${slug}`, slug }).select('id').single()
  if (error) throw error

  const { data: cli } = await sb.from('clients').insert({
    organisation_id: org.id, nom: `Client ${slug}`,
    email: `client-${slug}@example.test`, telephone: '0000000000',
    adresse: `1 rue ${slug}`, ville: 'Toulon', code_postal: '83000',
  }).select('id').single()

  const { data: tech } = await sb.from('techniciens').insert({
    organisation_id: org.id, nom: `Tech ${slug}`, actif: true,
  }).select('id').single()

  const { data: itv } = await sb.from('interventions').insert({
    organisation_id: org.id, client_id: cli!.id, technicien_id: tech!.id,
    reference: `REF-${slug}`, statut: 'planifiee', ville: 'Toulon',
    adresse_chantier: `SECRET-${slug}`,   // marqueur unique et cherchable
    notes_internes: `NOTE-CONFIDENTIELLE-${slug}`,
  }).select('id').single()

  const { data: doc } = await sb.from('documents').insert({
    organisation_id: org.id, intervention_id: itv!.id, client_id: cli!.id,
    type: 'facture', numero: 'FA-2026-0001',   // ← volontairement identique
    date_emission: '2026-01-15', statut: 'envoye',
    montant_ht: 250, montant_ttc: 250, payload: { secret: `PAYLOAD-${slug}` },
  }).select('id').single()

  const { data: acc } = await sb.from('accords_intervention').insert({
    organisation_id: org.id, intervention_id: itv!.id, client_id: cli!.id,
    client_nom: `Client ${slug}`, total_ht: 250, total_ttc: 250,
    taux_tva: 0, statut: 'VALIDE', ip_client: '10.0.0.1',
  }).select('id').single()

  const cheminPdf = `${org.id}/${itv!.id}/facture.pdf`
  await sb.storage.from('intervention-pdfs')
    .upload(cheminPdf, Buffer.from(`PDF-${slug}`), { contentType: 'application/pdf' })

  return {
    id: org.id, slug, clientId: cli!.id, technicienId: tech!.id,
    interventionId: itv!.id, documentId: doc!.id, accordId: acc!.id, cheminPdf,
  }
}

export async function nettoyer(sb: SupabaseClient, orgs: Org[]) {
  for (const o of orgs) {
    await sb.storage.from('intervention-pdfs').remove([o.cheminPdf])
    for (const t of ['accords_intervention', 'documents', 'interventions',
                     'techniciens', 'clients']) {
      await sb.from(t).delete().eq('organisation_id', o.id)
    }
    await sb.from('organisations').delete().eq('id', o.id)
  }
}
```

### `tests/isolation/api-isolation.test.ts` — la matrice systématique

Le point clé de conception : **la matrice est générée**, pas écrite à la main.
Ajouter une route à la liste suffit à obtenir tous les croisements
(A→A autorisé, A→B refusé, sans session refusé, technicien de A→B refusé).

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { clientTest, creerOrganisation, nettoyer, type Org } from './fixtures'
import { appelerRoute, sessionPour } from './harnais'

let sb = clientTest()
let A: Org, B: Org

beforeAll(async () => {
  A = await creerOrganisation(sb, 'orga-a')
  B = await creerOrganisation(sb, 'orgb-b')
}, 60_000)

afterAll(async () => { await nettoyer(sb, [A, B]) })

/** Une entrée = une ressource exposée par l'API, avec la façon de l'adresser. */
const RESSOURCES = [
  { nom: 'intervention',        url: (o: Org) => `/api/interventions/${o.interventionId}`,            methodes: ['GET', 'PATCH', 'DELETE'] },
  { nom: 'facture',             url: (o: Org) => `/api/interventions/${o.interventionId}/facture`,    methodes: ['GET'] },
  { nom: 'accord',              url: (o: Org) => `/api/accords/${o.accordId}`,                        methodes: ['GET'] },
  { nom: 'accord-pdf',          url: (o: Org) => `/api/accords/${o.accordId}/pdf`,                    methodes: ['GET'] },
  { nom: 'client',              url: (o: Org) => `/api/clients/${o.clientId}`,                        methodes: ['GET', 'PATCH', 'DELETE'] },
  { nom: 'dossier-client',      url: (o: Org) => `/api/clients/dossier?id=${o.clientId}`,             methodes: ['GET'] },
  { nom: 'historique',          url: (o: Org) => `/api/historique/${o.interventionId}`,               methodes: ['GET'] },
  { nom: 'terrain-step',        url: (o: Org) => `/api/interventions/${o.interventionId}/terrain-step`, methodes: ['GET', 'POST'] },
  { nom: 'generer-pdf',         url: (o: Org) => `/api/interventions/${o.interventionId}/generate-pdfs`, methodes: ['POST'] },
  { nom: 'photo',               url: (o: Org) => `/api/interventions/${o.interventionId}/photo`,      methodes: ['POST', 'DELETE'] },
  { nom: 'notifier-client',     url: (o: Org) => `/api/interventions/${o.interventionId}/notify-client-rdv`, methodes: ['POST'] },
  { nom: 'technicien',          url: (o: Org) => `/api/techniciens/${o.technicienId}`,                methodes: ['GET', 'PATCH'] },
]

describe('isolation inter-organisations : accès direct par identifiant', () => {
  for (const r of RESSOURCES) {
    for (const m of r.methodes) {

      it(`[${m} ${r.nom}] A accède à sa propre ressource`, async () => {
        const res = await appelerRoute(m, r.url(A), sessionPour(A, 'admin'))
        expect(res.status, 'le cas nominal doit marcher, sinon le test est faux')
          .toBeLessThan(400)
      })

      it(`[${m} ${r.nom}] A NE PEUT PAS toucher la ressource de B`, async () => {
        const res = await appelerRoute(m, r.url(B), sessionPour(A, 'admin'))
        expect([403, 404],
          `FUITE INTER-CLIENTS : ${m} ${r.url(B)} a répondu ${res.status} `
          + `à une session de l'organisation A.`).toContain(res.status)

        const corps = await res.text()
        expect(corps, 'des données de B ont fui dans le corps de la réponse')
          .not.toMatch(/SECRET-orgb-b|NOTE-CONFIDENTIELLE-orgb-b|PAYLOAD-orgb-b/)
      })

      it(`[${m} ${r.nom}] un technicien de A ne peut pas toucher B`, async () => {
        const res = await appelerRoute(m, r.url(B), sessionPour(A, 'tech'))
        expect([401, 403, 404]).toContain(res.status)
      })

      it(`[${m} ${r.nom}] sans session, refus`, async () => {
        const res = await appelerRoute(m, r.url(B), null)
        expect([401, 403]).toContain(res.status)
      })
    }
  }
})

describe('isolation : listes et recherches', () => {
  const LISTES = [
    '/api/interventions', '/api/clients', '/api/techniciens', '/api/historique',
    '/api/comptabilite/operations', '/api/comptabilite/recettes',
    '/api/factures-fournisseurs', '/api/rh/salaries', '/api/tarifs',
    '/api/relances', '/api/connexions',
  ]

  it.each(LISTES)('%s ne renvoie jamais une ligne d\'une autre organisation', async (url) => {
    const res = await appelerRoute('GET', url, sessionPour(A, 'admin'))
    expect(res.status).toBeLessThan(400)
    const corps = await res.text()
    expect(corps, `FUITE : ${url} renvoie des données de l'organisation B`)
      .not.toMatch(/orgb-b|SECRET-orgb-b|PAYLOAD-orgb-b/)
  })

  it('la recherche client ne traverse pas la frontière', async () => {
    const res = await appelerRoute('GET', '/api/clients/search?q=Client', sessionPour(A, 'admin'))
    const corps = await res.text()
    expect(corps).toMatch(/Client orga-a/)
    expect(corps).not.toMatch(/Client orgb-b/)
  })

  it('l\'export CSV ne contient que l\'organisation appelante', async () => {
    const res = await appelerRoute('GET', '/api/export/csv', sessionPour(A, 'admin'))
    const csv = await res.text()
    expect(csv).not.toMatch(/orgb-b/)
  })

  it('l\'export FEC ne contient que l\'organisation appelante', async () => {
    const res = await appelerRoute('GET', '/api/export/fec?annee=2026', sessionPour(A, 'admin'))
    expect(await res.text()).not.toMatch(/orgb-b/)
  })
})

describe('isolation : élévation par paramètre', () => {
  const INJECTIONS = [
    { ou: 'query',  faire: (o: Org) => `/api/interventions?organisation_id=${o.id}` },
    { ou: 'query',  faire: (o: Org) => `/api/interventions?org=${o.id}` },
    { ou: 'entête', faire: (o: Org) => `/api/interventions` },
  ]

  it('un organisation_id passé en query est ignoré', async () => {
    const res = await appelerRoute('GET', INJECTIONS[0].faire(B), sessionPour(A, 'admin'))
    expect(await res.text()).not.toMatch(/orgb-b/)
  })

  it('un en-tête x-organisation-id forgé est ignoré', async () => {
    const res = await appelerRoute('GET', '/api/interventions', sessionPour(A, 'admin'), {
      headers: { 'x-organisation-id': B.id },
    })
    expect(await res.text()).not.toMatch(/orgb-b/)
  })

  it('un POST ne peut pas écrire dans une autre organisation', async () => {
    const res = await appelerRoute('POST', '/api/interventions', sessionPour(A, 'admin'), {
      body: JSON.stringify({
        organisation_id: B.id,             // ← tentative d'écriture croisée
        client: { nom: 'Injection' }, type_intervention: 'debouchage',
      }),
      headers: { 'content-type': 'application/json' },
    })
    if (res.status < 400) {
      const { data } = await sb.from('interventions')
        .select('organisation_id').eq('organisation_id', B.id)
      expect(data?.length,
        'ÉCRITURE CROISÉE : une session de A a créé une ligne chez B')
        .toBe(1) // uniquement la ligne de la fixture
    }
  })

  it('un PATCH ne peut pas déplacer une ressource vers une autre organisation', async () => {
    await appelerRoute('PATCH', `/api/interventions/${A.interventionId}`, sessionPour(A, 'admin'), {
      body: JSON.stringify({ organisation_id: B.id }),
      headers: { 'content-type': 'application/json' },
    })
    const { data } = await sb.from('interventions')
      .select('organisation_id').eq('id', A.interventionId).single()
    expect(data?.organisation_id).toBe(A.id)
  })
})

describe('isolation : Storage', () => {
  it('les chemins d\'objet sont préfixés par l\'organisation', () => {
    expect(A.cheminPdf.startsWith(`${A.id}/`)).toBe(true)
    expect(B.cheminPdf.startsWith(`${B.id}/`)).toBe(true)
  })

  it('une session de A ne peut pas télécharger un PDF de B via l\'API', async () => {
    const res = await appelerRoute(
      'GET', `/api/pdf?path=${encodeURIComponent(B.cheminPdf)}`, sessionPour(A, 'admin'))
    expect([400, 403, 404]).toContain(res.status)
  })

  it('la traversée de chemin est neutralisée', async () => {
    const malicieux = `${A.id}/../${B.id}/facture.pdf`
    const res = await appelerRoute(
      'GET', `/api/pdf?path=${encodeURIComponent(malicieux)}`, sessionPour(A, 'admin'))
    expect([400, 403, 404]).toContain(res.status)
  })

  it('aucun bucket contenant des documents n\'est en lecture publique', async () => {
    for (const b of ['intervention-pdfs', 'interventions-photos', 'intervention-videos']) {
      const { data } = await sb.storage.getBucket(b)
      expect(data?.public,
        `Le bucket ${b} est public : les factures, photos de domicile et `
        + 'documents RH sont lisibles par toute personne connaissant l\'URL.')
        .toBe(false)
    }
  })
})

describe('isolation : intégrité des données', () => {
  it('deux organisations peuvent porter le même numéro de facture', async () => {
    const { data } = await sb.from('documents')
      .select('organisation_id, numero').eq('numero', 'FA-2026-0001')
    expect(data?.length,
      'La contrainte d\'unicité sur `numero` doit être composite '
      + '(organisation_id, numero) — sinon le second client ne peut plus facturer.')
      .toBe(2)
  })

  it('les compteurs de numérotation sont indépendants', async () => {
    const { data } = await sb.from('document_counters').select('*')
    const cles = (data ?? []).map((c: Record<string, unknown>) => c.organisation_id)
    expect(new Set(cles).size).toBeGreaterThanOrEqual(2)
  })

  it('aucune table métier ne contient de ligne orpheline', async () => {
    const TABLES = ['clients', 'interventions', 'documents', 'accords_intervention',
                    'techniciens', 'tarifs', 'factures_fournisseurs']
    for (const t of TABLES) {
      const { count } = await sb.from(t)
        .select('*', { count: 'exact', head: true }).is('organisation_id', null)
      expect(count, `${t} contient ${count} lignes sans organisation_id`).toBe(0)
    }
  })
})
```

### `tests/isolation/harnais.ts`

```ts
import { encode } from 'next-auth/jwt'
import type { Org } from './fixtures'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

export function sessionPour(org: Org, role: 'admin' | 'tech') {
  return {
    organisationId: org.id,
    role,
    technicienId: role === 'tech' ? org.technicienId : null,
    name: `test-${role}-${org.slug}`,
  }
}

export async function appelerRoute(
  methode: string,
  url: string,
  session: ReturnType<typeof sessionPour> | null,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers)
  if (session) {
    const jeton = await encode({
      token: session as never,
      secret: process.env.NEXTAUTH_SECRET!,
      salt: 'authjs.session-token',
    })
    headers.set('cookie', `authjs.session-token=${jeton}`)
  }
  return fetch(`${BASE}${url}`, { ...init, method: methode, headers, redirect: 'manual' })
}
```

> **Détail qui compte** : ces tests passent par un vrai serveur Next.js
> (`next start` lancé par la CI), donc **le middleware s'exécute**. Les tests
> d'intégration du § A.3 court-circuitent le middleware ; ceux-ci non. Les deux
> sont nécessaires : les premiers vérifient le handler, les seconds la chaîne
> complète.

---

## A.6 Tests end-to-end — Playwright

Playwright est déjà en dépendance. On l'utilise avec parcimonie : lent,
fragile, cher à maintenir. Uniquement pour les parcours dont la panne arrête
l'activité.

### `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,          // parcours métier séquentiels : ils partagent la base
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Le mode terrain est utilisé sur téléphone par les techniciens :
    // c'est le seul parcours qui justifie un second navigateur.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /terrain\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run start',
    url: 'http://localhost:3000/api/health',
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
})
```

### Les parcours vitaux, et seulement eux

| Fichier | Parcours | Pourquoi il est vital |
|---|---|---|
| `auth.spec.ts` | connexion admin, connexion technicien, redirection selon rôle, déconnexion sur compte révoqué | si la connexion casse, rien ne fonctionne |
| `intervention.spec.ts` | créer → planifier → assigner → mode terrain → rapport → facture | c'est le métier |
| `facture.spec.ts` | générer un PDF, vérifier montant et numéro, envoyer | c'est l'argent |
| `accord.spec.ts` | devis, signature, validation, PDF de preuve | c'est le juridique |
| `terrain.spec.ts` (mobile) | wizard terrain sur téléphone, photos, signature | c'est l'usage réel du technicien |
| `isolation.spec.ts` | connexion client A, tentative d'URL du client B | c'est la promesse du SaaS |

```ts
// tests/e2e/isolation.spec.ts
import { test, expect } from '@playwright/test'

test('un utilisateur du client A ne voit rien du client B', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="username"]', process.env.E2E_ORGA_USER!)
  await page.fill('input[name="password"]', process.env.E2E_ORGA_PASS!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/$|\/planning/)

  // Identifiant d'une intervention appartenant à l'organisation B
  const idB = process.env.E2E_ORGB_INTERVENTION_ID!
  const res = await page.goto(`/intervention/${idB}`)
  expect(res?.status(), 'accès croisé autorisé').toBeGreaterThanOrEqual(400)
  await expect(page.locator('body')).not.toContainText('SECRET-orgb-b')
})
```

---

## A.7 Le pipeline GitHub Actions

### Vue d'ensemble

```
Pousser sur une branche
        │
        ├── [1] rapide          ~2 min   tsc, lint, unitaires, gardes de routes
        │        │                       ↓ échec = tout s'arrête ici
        ├── [2] migrations      ~3 min   linter SQL + application sur base neuve
        │                                + rejeu du rollback  (seulement si SQL modifié)
        ├── [3] sécurité        ~2 min   npm audit, gitleaks, CodeQL
        │
        ├── [4] build           ~6 min   remotion bundle + next build
        │        │
        ├── [5] isolation       ~4 min   ★ base éphémère + serveur réel
        │        │
        └── [6] e2e             ~8 min   Playwright sur la preview Vercel
                 │
                 ▼
        Tous verts  →  fusion possible  →  déploiement préproduction
                                            │  (auto)
                                            ▼
                                       fumée + isolation en préprod
                                            │
                                            ▼
                                    ✋ validation humaine
                                            │
                                            ▼
                                    migration production (fenêtre)
                                            │
                                            ▼
                                    déploiement production
                                            │
                                            ▼
                                    surveillance 30 min
                                     │ régression → retour arrière automatique
```

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'

jobs:
  # ────────────────────────────────────────────────────────────────
  # 1. Retour rapide. Tout le reste dépend de ce job : inutile de
  #    lancer 8 minutes de build si le code ne compile pas.
  # ────────────────────────────────────────────────────────────────
  rapide:
    name: Compilation, lint, tests rapides
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci --prefer-offline --no-audit

      - name: Types stricts
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Tests unitaires
        run: npm run test:unit -- --run

      - name: Gardes de routes (138 routes API)
        run: npm run test:guards -- --run

      - name: Couverture
        run: npm run test:coverage -- --run
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: couverture, path: coverage/, retention-days: 7 }

  # ────────────────────────────────────────────────────────────────
  # 2. Migrations : ne tourne que si du SQL a bougé.
  # ────────────────────────────────────────────────────────────────
  migrations:
    name: Migrations SQL
    needs: rapide
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      - name: Y a-t-il du SQL dans ce diff ?
        id: detect
        run: |
          if git diff --name-only origin/main...HEAD | grep -q '^supabase/'; then
            echo "sql=true" >> "$GITHUB_OUTPUT"
          else
            echo "sql=false" >> "$GITHUB_OUTPUT"
          fi

      - uses: actions/setup-node@v4
        if: steps.detect.outputs.sql == 'true'
        with: { node-version: '22', cache: npm }
      - run: npm ci --prefer-offline --no-audit
        if: steps.detect.outputs.sql == 'true'

      - name: Linter de migrations (motifs dangereux, rollback obligatoire)
        if: steps.detect.outputs.sql == 'true'
        run: npx tsx scripts/ci/lint-migrations.ts

      - name: PostgreSQL neuf
        if: steps.detect.outputs.sql == 'true'
        run: |
          docker run -d --name pg -e POSTGRES_PASSWORD=postgres \
            -p 5432:5432 postgres:15
          for i in $(seq 1 30); do
            docker exec pg pg_isready -U postgres && break; sleep 2
          done

      - name: Appliquer TOUTES les migrations dans l'ordre
        if: steps.detect.outputs.sql == 'true'
        run: |
          set -e
          for f in supabase/migrations/*.sql; do
            echo "── $f"
            docker exec -i pg psql -v ON_ERROR_STOP=1 -U postgres < "$f"
          done

      - name: Le rollback de la nouvelle migration s'exécute-t-il ?
        if: steps.detect.outputs.sql == 'true'
        run: npx tsx scripts/ci/test-rollback.ts

      - name: Rejouer les migrations (idempotence)
        if: steps.detect.outputs.sql == 'true'
        run: |
          set -e
          for f in supabase/migrations/*.sql; do
            docker exec -i pg psql -v ON_ERROR_STOP=1 -U postgres < "$f"
          done

  # ────────────────────────────────────────────────────────────────
  # 3. Sécurité
  # ────────────────────────────────────────────────────────────────
  securite:
    name: Sécurité
    needs: rapide
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions: { contents: read, security-events: write }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci --prefer-offline --no-audit

      - name: Vulnérabilités des dépendances (bloque sur critique)
        run: npm audit --audit-level=critical

      - name: Vulnérabilités élevées (informatif)
        run: npm audit --audit-level=high || true

      - name: Secrets committés
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: CodeQL — initialisation
        uses: github/codeql-action/init@v3
        with: { languages: javascript-typescript, queries: security-extended }
      - name: CodeQL — analyse
        uses: github/codeql-action/analyze@v3

      - name: Vérifications maison (service_role, NEXT_PUBLIC_, préfixes publics)
        run: npx tsx scripts/ci/check-secrets-config.ts

  # ────────────────────────────────────────────────────────────────
  # 4. Build
  # ────────────────────────────────────────────────────────────────
  build:
    name: Build production
    needs: rapide
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci --prefer-offline --no-audit
      - name: next build (+ remotion bundle)
        run: npm run build
        env:
          SUPABASE_URL: http://localhost:54321
          SUPABASE_SERVICE_ROLE_KEY: build-placeholder
          NEXTAUTH_SECRET: build-placeholder
          AUTH_USER_1: build:placeholder
      - name: Budget de bundle
        run: npx tsx scripts/ci/check-bundle-budget.ts
      - uses: actions/upload-artifact@v4
        with: { name: next-build, path: .next/, retention-days: 3 }

  # ────────────────────────────────────────────────────────────────
  # 5. ★ Isolation multi-tenant — le job qui protège la promesse SaaS
  # ────────────────────────────────────────────────────────────────
  isolation:
    name: Isolation entre clients
    needs: [rapide, build]
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: supabase/postgres:15.1.1.78
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports: ['54322:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 5s --health-retries 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci --prefer-offline --no-audit

      - name: Pile Supabase locale (base + Storage + PostgREST)
        uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: supabase db reset --local     # applique supabase/migrations/*

      - uses: actions/download-artifact@v4
        with: { name: next-build, path: .next/ }

      - name: Démarrer l'application contre la base éphémère
        run: npm run start &
        env:
          SUPABASE_URL: http://127.0.0.1:54321
          SUPABASE_SERVICE_ROLE_KEY: ${{ env.LOCAL_SERVICE_ROLE }}
          NEXTAUTH_SECRET: secret-de-test-isolation
          AUTH_USER_1: admin:$2a$10$placeholder
          AUTH_TECH_1: tech:$2a$10$placeholder

      - name: Attendre la disponibilité
        run: npx wait-on http://localhost:3000/api/health -t 120000

      - name: ★ Suite d'isolation
        run: npm run test:isolation -- --run
        env:
          TEST_SUPABASE_URL: http://127.0.0.1:54321
          TEST_SUPABASE_SERVICE_ROLE_KEY: ${{ env.LOCAL_SERVICE_ROLE }}
          TEST_BASE_URL: http://localhost:3000
          NEXTAUTH_SECRET: secret-de-test-isolation

      - name: RLS active sur toutes les tables
        run: npx tsx scripts/ci/check-rls.ts
        env:
          DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres

  # ────────────────────────────────────────────────────────────────
  # 6. Portail de fusion : c'est CE job qu'on rend obligatoire dans
  #    les règles de protection de branche. Un seul nom à maintenir.
  # ────────────────────────────────────────────────────────────────
  portail:
    name: Portail de fusion
    if: always()
    needs: [rapide, migrations, securite, build, isolation]
    runs-on: ubuntu-latest
    steps:
      - name: Vérifier qu'aucun job requis n'a échoué
        run: |
          echo "rapide=${{ needs.rapide.result }}"
          echo "migrations=${{ needs.migrations.result }}"
          echo "securite=${{ needs.securite.result }}"
          echo "build=${{ needs.build.result }}"
          echo "isolation=${{ needs.isolation.result }}"
          for r in "${{ needs.rapide.result }}" "${{ needs.migrations.result }}" \
                   "${{ needs.securite.result }}" "${{ needs.build.result }}" \
                   "${{ needs.isolation.result }}"; do
            if [ "$r" != "success" ] && [ "$r" != "skipped" ]; then
              echo "::error::Un job requis a échoué — fusion interdite."
              exit 1
            fi
          done
```

### Ce qui bloque la fusion

Règle de protection sur `main` : une seule vérification requise, **`Portail de
fusion`**, plus « branche à jour avec main » et « revue de code approuvée ».
On ajoute des jobs au pipeline sans jamais toucher aux réglages GitHub.

| Échec | Fusion |
|---|---|
| `tsc` / lint / test unitaire | bloquée |
| Test de garde de route | bloquée |
| **Test d'isolation** | bloquée, sans exception possible |
| Migration : rollback absent ou motif dangereux | bloquée |
| `npm audit` critique, secret détecté | bloquée |
| Build | bloquée |
| Playwright | bloquée sauf mention `[e2e-flaky]` documentée dans la PR |
| Budget de bundle dépassé | avertissement (non bloquant les 3 premiers mois) |

### `.github/workflows/e2e.yml` — sur la preview Vercel

```yaml
name: E2E preview

on:
  deployment_status:

jobs:
  playwright:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: npm }
      - run: npm ci --prefer-offline --no-audit
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        env:
          E2E_BASE_URL: ${{ github.event.deployment_status.environment_url }}
          E2E_ORGA_USER: ${{ secrets.E2E_ORGA_USER }}
          E2E_ORGA_PASS: ${{ secrets.E2E_ORGA_PASS }}
          E2E_ORGB_INTERVENTION_ID: ${{ secrets.E2E_ORGB_INTERVENTION_ID }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/, retention-days: 14 }
```

> **Attention** : la preview Vercel doit pointer sur la base de
> **préproduction**, jamais sur la base de production. Aujourd'hui rien ne
> l'empêche : c'est le premier réglage à faire (§ palier 1).

### `.github/workflows/deploy.yml` — préproduction, production, surveillance

```yaml
name: Déploiement

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      cible:
        description: Environnement
        required: true
        default: preproduction
        type: choice
        options: [preproduction, production]

concurrency:
  group: deploy-production
  cancel-in-progress: false    # ne JAMAIS annuler un déploiement en cours

jobs:
  # ── 1. Préproduction, automatique sur main ──────────────────────
  preproduction:
    name: Préproduction
    runs-on: ubuntu-latest
    environment:
      name: preproduction
      url: https://preprod-app-realisations-ltdb.vercel.app
    steps:
      - uses: actions/checkout@v4

      - name: Migrations sur la base de préproduction
        run: npx tsx scripts/ci/apply-migrations.ts
        env:
          DATABASE_URL: ${{ secrets.PREPROD_DATABASE_URL }}

      - name: Déployer
        run: |
          npm i -g vercel@latest
          vercel pull --yes --environment=preview --token=$VERCEL_TOKEN
          vercel build --token=$VERCEL_TOKEN
          vercel deploy --prebuilt --token=$VERCEL_TOKEN > url.txt
          echo "URL=$(cat url.txt)" >> "$GITHUB_ENV"
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Tests de fumée
        run: npx tsx scripts/ci/smoke.ts "$URL"

      - name: ★ Isolation rejouée en préproduction, sur données réalistes
        run: npm run test:isolation -- --run
        env:
          TEST_BASE_URL: ${{ env.URL }}
          TEST_SUPABASE_URL: ${{ secrets.PREPROD_SUPABASE_URL }}
          TEST_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PREPROD_SERVICE_ROLE_KEY }}

  # ── 2. Production : validation humaine obligatoire ──────────────
  production:
    name: Production
    needs: preproduction
    runs-on: ubuntu-latest
    environment:
      name: production              # ← exiger un approbateur dans les
      url: https://app-realisations-ltdb.vercel.app   #   réglages GitHub
    steps:
      - uses: actions/checkout@v4

      - name: Point de restauration — mémoriser le déploiement actuel
        id: precedent
        run: |
          npm i -g vercel@latest
          ACTUEL=$(vercel ls --prod --token=$VERCEL_TOKEN --json \
                   | jq -r '.deployments[0].url')
          echo "url=$ACTUEL" >> "$GITHUB_OUTPUT"
          echo "Déploiement à restaurer en cas de problème : $ACTUEL"
        env: { VERCEL_TOKEN: "${{ secrets.VERCEL_TOKEN }}" }

      - name: Sauvegarde base avant migration
        run: npx tsx scripts/ci/backup-avant-migration.ts
        env: { DATABASE_URL: "${{ secrets.PROD_DATABASE_URL }}" }

      - name: Migrations production (expand uniquement — jamais de contract ici)
        run: npx tsx scripts/ci/apply-migrations.ts --phase=expand
        env: { DATABASE_URL: "${{ secrets.PROD_DATABASE_URL }}" }

      - name: Déployer
        run: |
          vercel pull --yes --environment=production --token=$VERCEL_TOKEN
          vercel build --prod --token=$VERCEL_TOKEN
          vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Fumée production
        run: npx tsx scripts/ci/smoke.ts https://app-realisations-ltdb.vercel.app

      - name: Surveillance 30 minutes (taux d'erreur, latence)
        run: npx tsx scripts/ci/surveiller.ts --minutes=30 --seuil-erreurs=1

      - name: ⟲ Retour arrière automatique
        if: failure()
        run: |
          echo "::error::Régression détectée — restauration de ${{ steps.precedent.outputs.url }}"
          vercel rollback ${{ steps.precedent.outputs.url }} --token=$VERCEL_TOKEN --yes
        env: { VERCEL_TOKEN: "${{ secrets.VERCEL_TOKEN }}" }
```

### Déploiement progressif : ce qui est réaliste ici

Vercel ne propose pas de déploiement canari par pourcentage de trafic sur le
plan courant. Le déploiement progressif se fait donc **par organisation**, dans
le code, avec un drapeau de fonctionnalité :

```ts
// lib/fonctionnalites.ts — à créer
const ROULEMENT: Record<string, string[]> = {
  nouveau_module_devis: ['org-interne', 'org-pilote-1'],
}

export function estActive(nom: string, organisationId: string): boolean {
  const liste = ROULEMENT[nom]
  if (!liste) return false
  if (liste.includes('*')) return true
  return liste.includes(organisationId)
}
```

Séquence recommandée pour toute fonctionnalité touchant les données ou la
facturation : organisation interne (LTDB) → 1 client pilote volontaire →
25 % → tous. Chaque palier attend 48 h sans incident.

### Procédure de retour arrière

| Nature du problème | Geste | Délai | Perte |
|---|---|---|---|
| Bug applicatif, base inchangée | `vercel rollback <url>` | ~30 s | aucune |
| Bug applicatif, migration expand appliquée | `vercel rollback` seul — la migration expand est rétrocompatible **par construction**, on ne la défait pas | ~30 s | aucune |
| Migration cassante appliquée par erreur | exécuter la section `-- ROLLBACK` du fichier | 1-5 min | selon le cas |
| Corruption de données | restauration PITR Supabase | 15-60 min | **toutes les écritures de tous les clients depuis le point de restauration** |
| Fuite inter-clients constatée | couper l'accès (drapeau global), puis corriger | immédiat | disponibilité |

**La ligne « corruption de données » est celle qu'il faut ne jamais atteindre.**
C'est toute la raison d'être des sections A.5 et A.9 : la restauration de
sauvegarde n'est pas un plan de secours acceptable en base partagée, puisqu'elle
punit dix-neuf clients pour réparer le vingtième.

Ajouter au dépôt `docs/scale/RUNBOOK-incident.md` (hors périmètre de ce
document) avec : qui appeler, comment couper, comment communiquer aux clients,
et le délai de notification CNIL de 72 h en cas de violation de données.

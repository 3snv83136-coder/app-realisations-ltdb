-- =====================================================================
-- LTDB Compta — Migration 010
-- Relevés bancaires mensuels, pré-bilans, paramètres comptables
-- Inclut comptes_bancaires + operations_bancaires (ex-migration 001)
-- Idempotent : peut être ré-exécutée sans danger.
-- =====================================================================

-- Prérequis : documents + factures_fournisseurs (schema.sql de base)
-- Si absentes, exécutez d'abord supabase/schema.sql

-- =====================================================================
-- 1. COMPTES BANCAIRES (001 — si pas encore appliqué)
-- =====================================================================
create table if not exists comptes_bancaires (
  id uuid primary key default gen_random_uuid(),
  banque text not null,
  iban text,
  libelle text,
  agence text,
  solde_initial numeric not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists comptes_bancaires_actif_idx on comptes_bancaires (actif);

-- =====================================================================
-- 2. OPÉRATIONS BANCAIRES (001 — si pas encore appliqué)
-- =====================================================================
create table if not exists operations_bancaires (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references comptes_bancaires(id) on delete cascade,
  date_operation date not null,
  date_valeur date,
  libelle text not null,
  reference_brute text,
  debit numeric not null default 0,
  credit numeric not null default 0,
  lettre boolean not null default false,
  lettre_at timestamptz,
  document_id uuid references documents(id) on delete set null,
  facture_fournisseur_id uuid references factures_fournisseurs(id) on delete set null,
  categorie text,
  notes text,
  source_import text not null default 'manuel'
    check (source_import in ('csv','pdf_ocr','manuel','api')),
  import_batch_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ops_bancaires_compte_idx   on operations_bancaires (compte_id);
create index if not exists ops_bancaires_date_idx     on operations_bancaires (date_operation);
create index if not exists ops_bancaires_lettre_idx   on operations_bancaires (lettre);
create index if not exists ops_bancaires_document_idx on operations_bancaires (document_id);
create index if not exists ops_bancaires_batch_idx    on operations_bancaires (import_batch_id);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'ops_bancaires_debit_xor_credit'
  ) then
    alter table operations_bancaires add constraint ops_bancaires_debit_xor_credit
      check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0) or (debit = 0 and credit = 0));
  end if;
end $$;

alter table comptes_bancaires    disable row level security;
alter table operations_bancaires disable row level security;

-- =====================================================================
-- 3. RELEVÉS BANCAIRES MENSUELS
-- =====================================================================
create table if not exists releves_bancaires (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references comptes_bancaires(id) on delete set null,
  periode_annee int not null,
  periode_mois int not null check (periode_mois between 1 and 12),
  pdf_url text,
  fichier_nom text,
  import_batch_id uuid,
  nb_operations int not null default 0,
  solde_fin_mois numeric,
  notes text,
  uploaded_at timestamptz not null default now(),
  unique (compte_id, periode_annee, periode_mois)
);

create index if not exists releves_periode_idx on releves_bancaires (periode_annee, periode_mois);
create index if not exists releves_uploaded_idx on releves_bancaires (uploaded_at desc);

-- =====================================================================
-- 4. PRÉ-BILANS
-- =====================================================================
create table if not exists pre_bilans (
  id uuid primary key default gen_random_uuid(),
  periode_annee int not null,
  periode_mois int not null check (periode_mois between 1 and 12),
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'envoye', 'valide')),
  snapshot jsonb not null default '{}',
  releve_id uuid references releves_bancaires(id) on delete set null,
  comptable_email text,
  envoye_at timestamptz,
  valide_at timestamptz,
  valide_par text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (periode_annee, periode_mois)
);

create index if not exists pre_bilans_statut_idx on pre_bilans (statut);
create index if not exists pre_bilans_periode_idx on pre_bilans (periode_annee, periode_mois);

alter table releves_bancaires disable row level security;
alter table pre_bilans disable row level security;

-- =====================================================================
-- 5. PARAMÈTRES COMPTA
-- =====================================================================
insert into parametres (cle, valeur, description) values
  ('EMAIL_COMPTABLE', '', 'Email expert-comptable (pré-bilan mensuel)'),
  ('COMPTA_ALERT_EMAIL', '', 'Alertes compta (relevé manquant le 5 du mois)')
on conflict (cle) do nothing;

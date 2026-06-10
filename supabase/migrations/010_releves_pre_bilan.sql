-- =====================================================================
-- LTDB Compta — Migration 010
-- Relevés bancaires mensuels, pré-bilans, paramètres comptables
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

insert into parametres (cle, valeur, description) values
  ('EMAIL_COMPTABLE', '', 'Email expert-comptable (pré-bilan mensuel)'),
  ('COMPTA_ALERT_EMAIL', '', 'Alertes compta (relevé manquant le 5 du mois)')
on conflict (cle) do nothing;

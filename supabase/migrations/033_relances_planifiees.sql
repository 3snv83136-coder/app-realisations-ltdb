-- Registre générique des relances planifiées qui ne sont pas portées par
-- interventions.*_relance_ids ou documents.payload.
-- Une ligne représente un envoi annulable (email, SMS ou futur canal).

create table if not exists public.relances_planifiees (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  source_type text not null,
  source_id text not null,
  provider_id text,
  channel text not null default 'email',
  send_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'canceled')),
  client_id uuid references public.clients(id) on delete set null,
  client_nom text,
  client_email text,
  ville text,
  label text not null,
  intervention_id uuid references public.interventions(id) on delete set null,
  technicien_id uuid references public.techniciens(id) on delete set null,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists relances_planifiees_provider_id_uidx
  on public.relances_planifiees(provider_id);

create index if not exists relances_planifiees_pending_idx
  on public.relances_planifiees(status, send_at)
  where status = 'pending';

create index if not exists relances_planifiees_source_idx
  on public.relances_planifiees(source_type, source_id);

alter table public.relances_planifiees enable row level security;

comment on table public.relances_planifiees is
  'Registre serveur de tous les envois de relance planifiés et annulables';

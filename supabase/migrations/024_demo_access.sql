-- Accès démo admin temporaires (créés / révoqués depuis l'app)

create table if not exists demo_access (
  id            uuid primary key default gen_random_uuid(),
  login         text not null unique,
  password_hash text not null,
  label         text,
  actif         boolean not null default true,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists demo_access_actif_idx on demo_access (actif);
create index if not exists demo_access_login_idx on demo_access (lower(login));

comment on table demo_access is
  'Comptes admin temporaires pour démonstration client — révocables depuis /acces-demo';

alter table demo_access disable row level security;

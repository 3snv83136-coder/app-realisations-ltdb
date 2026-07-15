-- Comptes de connexion techniciens (créés / gérés depuis /admin/comptes)
-- Remplace progressivement les variables d'env AUTH_TECH_N (qui restent
-- lues en fallback par lib/auth-users.ts pendant la transition).

create table if not exists comptes_techniciens (
  id               uuid primary key default gen_random_uuid(),
  login            text not null unique,
  password_hash    text not null,
  technicien_id    uuid not null references techniciens(id),
  actif            boolean not null default true,
  revoked_at       timestamptz,
  created_by       text,
  created_at       timestamptz not null default now(),
  dernier_login_at timestamptz
);

create index if not exists comptes_techniciens_login_idx on comptes_techniciens (lower(login));
create index if not exists comptes_techniciens_actif_idx on comptes_techniciens (actif);
create index if not exists comptes_techniciens_technicien_idx on comptes_techniciens (technicien_id);

comment on table comptes_techniciens is
  'Comptes login/mot de passe des techniciens (rôle tech, accès restreint) — gérés depuis /admin/comptes';

alter table comptes_techniciens disable row level security;

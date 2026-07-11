-- Journal des connexions à l'app (qui se connecte, quand, depuis où)

create table if not exists connexions_log (
  id            uuid primary key default gen_random_uuid(),
  login         text not null,
  role          text not null,
  technicien_id uuid,
  is_demo       boolean not null default false,
  ip            text,
  country_code  text,
  city          text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists connexions_log_created_at_idx on connexions_log (created_at desc);
create index if not exists connexions_log_login_idx on connexions_log (lower(login));

comment on table connexions_log is
  'Historique des connexions réussies (login, rôle, IP, pays) — affiché sur /connexions';

alter table connexions_log disable row level security;

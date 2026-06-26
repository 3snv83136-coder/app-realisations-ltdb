-- Numérotation séquentielle continue et atomique des documents (factures, devis).
-- Exigence légale FR : suite chronologique sans rupture. On remplace l'ancien
-- suffixe horaire (FA-AAAAMMJJ-HHMM, non séquentiel) par un compteur par
-- (type, année) : FA-2026-0001, DV-2026-0001, remis à 0001 chaque année.

-- Compteur : une ligne par (type de document, année).
create table if not exists document_counters (
  doc_type   text    not null,
  year       int     not null,
  last_value int     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (doc_type, year)
);

comment on table document_counters is
  'Compteur séquentiel par (type de document, année) pour la numérotation continue des factures/devis.';

-- Allocation atomique : incrémente et renvoie le prochain numéro de la séquence.
-- L''upsert ON CONFLICT garantit l''atomicité même en cas d''appels concurrents.
create or replace function allocate_document_number(p_type text, p_year int)
returns int
language plpgsql
as $$
declare
  v_next int;
begin
  insert into document_counters (doc_type, year, last_value, updated_at)
    values (p_type, p_year, 1, now())
  on conflict (doc_type, year)
    do update set last_value = document_counters.last_value + 1,
                  updated_at = now()
  returning last_value into v_next;
  return v_next;
end;
$$;

comment on function allocate_document_number(text, int) is
  'Incrémente atomiquement et renvoie le prochain numéro de séquence pour (type, année).';

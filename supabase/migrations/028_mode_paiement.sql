-- Mode de paiement prévu pour l'intervention (confirmation SMS client).
alter table interventions
  add column if not exists mode_paiement text
  check (mode_paiement is null or mode_paiement in ('cb', 'virement', 'especes'));

comment on column interventions.mode_paiement is
  'Mode de paiement annoncé au client (cb | virement | especes) — SMS confirmation RDV';

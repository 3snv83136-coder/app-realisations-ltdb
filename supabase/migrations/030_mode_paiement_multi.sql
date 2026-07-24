-- Autoriser un ou plusieurs modes (cb, virement, especes), séparés par des virgules.
alter table interventions drop constraint if exists interventions_mode_paiement_check;

alter table interventions
  add constraint interventions_mode_paiement_check
  check (
    mode_paiement is null
    or mode_paiement ~ '^(cb|virement|especes)(,(cb|virement|especes))*$'
  );

comment on column interventions.mode_paiement is
  'Modes de paiement acceptés (cb, virement, especes) — un ou plusieurs, séparés par des virgules. Annoncés dans le SMS confirmation RDV.';

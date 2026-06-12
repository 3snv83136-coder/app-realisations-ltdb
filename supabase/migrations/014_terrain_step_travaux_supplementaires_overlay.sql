-- Travaux supplémentaires : plus une étape du wizard (option sur « photo après »).
-- Recule d'un cran les interventions déjà au-delà de l'ancienne étape travaux (step >= 3).

alter table interventions drop constraint if exists interventions_terrain_step_check;
alter table interventions add constraint interventions_terrain_step_check
  check (terrain_step between 0 and 8);

update interventions
set terrain_step = terrain_step - 1
where terrain_step >= 3
  and statut in ('planifiee', 'en_cours');

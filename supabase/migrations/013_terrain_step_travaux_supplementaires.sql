-- Nouvelle étape « Travaux supplémentaires » insérée en position 2 du wizard terrain.
-- Décale les interventions en cours (step >= 2) d'un cran.

alter table interventions drop constraint if exists interventions_terrain_step_check;
alter table interventions add constraint interventions_terrain_step_check
  check (terrain_step between 0 and 9);

update interventions
set terrain_step = terrain_step + 1
where terrain_step >= 2
  and statut in ('planifiee', 'en_cours');

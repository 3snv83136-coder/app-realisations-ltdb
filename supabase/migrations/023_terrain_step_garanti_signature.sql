-- Mode terrain : étapes Garanti (4) + Signature accord (6) insérées dans le wizard.
-- Nouveau parcours : 0-3 inchangé, 4=garanti, 5=facture, 6=signature, 7=devis, 8=diffusion, 9=réseaux.
--
-- Note : deux contraintes coexistent en prod depuis la migration 007 (_chk, max 8)
-- et la 014 (_check, max 8). On les supprime toutes les deux avant le remap.

alter table interventions drop constraint if exists interventions_terrain_step_chk;
alter table interventions drop constraint if exists interventions_terrain_step_check;

-- Remap des interventions en cours (étape courante, pas l'historique).
update interventions set terrain_step = case terrain_step
  when 4 then 5   -- était facture → facture
  when 5 then 6   -- était devis (après facture) → signature accord
  when 6 then 8   -- était diffusion → diffusion
  when 7 then 9   -- était réseaux → réseaux
  else terrain_step
end
where terrain_step >= 4;

alter table interventions add constraint interventions_terrain_step_check
  check (terrain_step between 0 and 9);

comment on column interventions.terrain_step is
  'Wizard mode terrain : 0 photo avant, 1 démarrer, 2 photo après, 3 rapport, 4 garanti, 5 facture, 6 signature accord, 7 devis opt., 8 diffusion, 9 réseaux';

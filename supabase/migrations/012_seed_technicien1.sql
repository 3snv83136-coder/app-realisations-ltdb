-- Compte terrain « Technicien 1 » (login technicien1 / mot de passe configuré dans AUTH_TECH_1)
insert into techniciens (nom, email, actif)
select 'Technicien 1', 'technicien1@ltdb.local', true
where not exists (
  select 1 from techniciens where lower(trim(nom)) = 'technicien 1'
);

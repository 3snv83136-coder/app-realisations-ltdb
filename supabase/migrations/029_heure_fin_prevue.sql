-- Créneau horaire de fin (début = heure_prevue), max 2 h côté app.
alter table interventions
  add column if not exists heure_fin_prevue time;

comment on column interventions.heure_fin_prevue is
  'Fin du créneau planifié (heure_prevue = début), fenêtre max 2 h';

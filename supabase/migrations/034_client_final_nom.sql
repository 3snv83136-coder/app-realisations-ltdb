-- Nom du client final / occupant (ex. locataire ou propriétaire),
-- distinct du client facturé (souvent un syndic).
-- Affiché sur facture / devis sous « Facturé à ».

alter table public.interventions
  add column if not exists client_final_nom text;

comment on column public.interventions.client_final_nom is
  'Nom du client concerné (occupant / locataire / propriétaire), distinct du client facturé';

-- E-E-A-T publication site : profil technicien + catégories photos terrain

alter table techniciens
  add column if not exists photo_url text,
  add column if not exists annees_experience integer,
  add column if not exists titre_metier text default 'technicien déboucheur';

alter table interventions
  add column if not exists photos_categories text[] default '{}';

comment on column techniciens.photo_url is 'Photo portrait du technicien (URL publique Supabase Storage)';
comment on column techniciens.annees_experience is 'Années d''expérience affichées sur les pages réalisations';
comment on column techniciens.titre_metier is 'Intitulé métier (ex. technicien déboucheur)';
comment on column interventions.photos_categories is 'Catégorie par photo (avant|pendant|apres|camera|dechets|autre), parallèle à photos_urls';

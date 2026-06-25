-- Vidéos uploadées par le technicien (en plus des vidéos générées depuis les photos).
-- Compressées côté navigateur puis envoyées directement vers le bucket via signed URL.

alter table interventions
  add column if not exists video_uploads text[] default '{}';

comment on column interventions.video_uploads is
  'URLs publiques des vidéos uploadées (tout format, compressées navigateur en MP4/WebM léger)';

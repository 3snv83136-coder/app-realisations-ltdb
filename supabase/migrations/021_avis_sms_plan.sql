-- Planification SMS avis Google (J+1, J+4) — Brevo n'a pas de scheduledAt comme Resend.
-- Le cron /api/cron/avis-sms-relances envoie les SMS dont send_at est échu.

alter table interventions
  add column if not exists avis_sms_plan jsonb default '[]'::jsonb;

comment on column interventions.avis_sms_plan is
  'File SMS avis Google planifiés (J+1, J+4) — envoyés par cron Brevo';

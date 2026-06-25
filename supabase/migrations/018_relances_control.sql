-- Contrôle manuel des relances automatiques (devis & avis Google).
-- On stocke les IDs Resend des emails planifiés afin de pouvoir les annuler
-- depuis l'app quand le client accepte le devis ou laisse son avis.

alter table interventions
  add column if not exists avis_relance_ids text[] default '{}',
  add column if not exists devis_relance_ids text[] default '{}',
  add column if not exists devis_accepte_at timestamptz;

comment on column interventions.avis_relance_ids is
  'IDs Resend des relances avis Google planifiées (annulables depuis l''app)';
comment on column interventions.devis_relance_ids is
  'IDs Resend des relances devis planifiées (annulables depuis l''app)';
comment on column interventions.devis_accepte_at is
  'Date à laquelle le client a accepté le devis (stoppe les relances)';

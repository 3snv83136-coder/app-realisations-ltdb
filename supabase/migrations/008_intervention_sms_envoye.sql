alter table interventions
  add column if not exists sms_envoye_at timestamptz;

comment on column interventions.sms_envoye_at is
  'Horodatage du dernier envoi SMS rapport+facture au client (mode terrain)';

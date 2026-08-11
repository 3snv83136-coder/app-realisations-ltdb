-- Permissions fines par compte technicien (Phase 2 accès limités).
-- Clés connues : voir_prix, creer_facture, envoyer_devis (booléens).
-- Une clé absente vaut true (défauts côté lib/tech-permissions.ts) pour
-- conserver le comportement historique.

alter table comptes_techniciens
  add column if not exists permissions jsonb not null default '{}'::jsonb;

comment on column comptes_techniciens.permissions is
  'Permissions fines du compte (voir_prix, creer_facture, envoyer_devis) — clé absente = true';

-- Garde-fou : empêche tout doublon de numéro pour un même type de document.
-- Migration séparée de 019 : si d'anciens doublons existent, sa création peut
-- échouer sans bloquer la mise en place du compteur séquentiel (migration 019).
-- En cas d'échec, nettoyer les doublons puis relancer cette migration.

create unique index if not exists documents_type_numero_unique
  on documents (type, numero)
  where numero is not null;

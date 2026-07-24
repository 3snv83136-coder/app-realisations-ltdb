-- Autorise le type de document « inspection » (rapports caméra ITV / NF EN 13508-2).

alter table documents drop constraint if exists documents_type_check;

alter table documents
  add constraint documents_type_check
  check (type in ('facture','devis','attestation','rapport','inspection'));

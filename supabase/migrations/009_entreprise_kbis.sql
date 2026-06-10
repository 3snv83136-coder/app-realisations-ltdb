-- Identité légale LTDB (KBIS NAJI MONDOR — juin 2026)
insert into parametres (cle, valeur, description) values
  ('LTDB_SIREN', '484791546', 'SIREN'),
  ('LTDB_SIRET', '48479154600050', 'SIRET établissement principal Toulon'),
  ('LTDB_RCS', 'RCS Toulon 484 791 546', 'Immatriculation RCS'),
  ('LTDB_TVA_INTRACOM', 'FR09484791546', 'N° TVA intracommunautaire'),
  ('LTDB_IBAN', 'FR76 1695 8000 0152 7256 3725 930', 'IBAN virement factures'),
  ('LTDB_BIC', 'QNTOFRP1XXX', 'BIC banque'),
  ('LTDB_RAISON_SOCIALE', 'NAJI MONDOR — Les Techniciens du Débouchage', 'Raison sociale factures')
on conflict (cle) do update set
  valeur = excluded.valeur,
  description = excluded.description;

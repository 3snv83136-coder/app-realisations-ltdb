-- Module Ressources Humaines (admin uniquement côté app)

CREATE TABLE IF NOT EXISTS salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text NOT NULL,
  adresse text,
  code_postal text,
  ville text,
  email text,
  telephone text,
  date_naissance date,
  lieu_naissance text,
  nationalite text DEFAULT 'Française',
  numero_secu text,
  poste text,
  qualification text,
  coefficient numeric,
  salaire_brut_mensuel numeric,
  temps_travail text DEFAULT '35 heures par semaine',
  date_embauche date,
  date_fin_contrat date,
  type_contrat text DEFAULT 'CDI',
  motif_cdd text,
  periode_essai_mois integer DEFAULT 2,
  mutuelle text,
  permis_numero text,
  permis_delivrance date,
  permis_categories text,
  notes text,
  actif boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salarie_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salarie_id uuid NOT NULL REFERENCES salaries(id) ON DELETE CASCADE,
  type text NOT NULL,
  url text NOT NULL,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salarie_documents_salarie ON salarie_documents(salarie_id);

CREATE TABLE IF NOT EXISTS salarie_documents_generes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salarie_id uuid NOT NULL REFERENCES salaries(id) ON DELETE CASCADE,
  type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salarie_docs_generes_salarie ON salarie_documents_generes(salarie_id);

COMMENT ON TABLE salaries IS 'Dossiers salariés LTDB — module RH admin';
COMMENT ON TABLE salarie_documents IS 'Scans RH (permis, mutuelle, etc.)';
COMMENT ON TABLE salarie_documents_generes IS 'Historique des documents RH générés (PDF)';

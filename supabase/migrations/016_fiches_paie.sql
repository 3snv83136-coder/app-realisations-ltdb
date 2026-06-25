-- Historique des bulletins de paie générés (cumuls annuels)

CREATE TABLE IF NOT EXISTS fiches_paie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salarie_id uuid NOT NULL REFERENCES salaries(id) ON DELETE CASCADE,
  periode_annee integer NOT NULL,
  periode_mois integer NOT NULL CHECK (periode_mois >= 1 AND periode_mois <= 12),
  brut numeric NOT NULL,
  net_a_payer numeric NOT NULL,
  net_imposable numeric NOT NULL,
  charges_salariales numeric NOT NULL,
  charges_patronales numeric NOT NULL,
  heures numeric,
  detail_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salarie_id, periode_annee, periode_mois)
);

CREATE INDEX IF NOT EXISTS idx_fiches_paie_salarie ON fiches_paie(salarie_id);
CREATE INDEX IF NOT EXISTS idx_fiches_paie_periode ON fiches_paie(periode_annee, periode_mois);

COMMENT ON TABLE fiches_paie IS 'Bulletins de paie générés — cumuls et historique';

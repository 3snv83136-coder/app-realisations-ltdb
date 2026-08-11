-- Élargit le catalogue `tarifs` avec les articles utilisés dans les devis
-- et le mode terrain (sans écraser les prix déjà ajustés en base).

insert into public.tarifs (type, label, prix_min, prix_max, unite) values
  ('DEBOUCHAGE_CANALISATION', 'Débouchage canalisation',           250, 250, 'forfait'),
  ('DEBOUCHAGE_WC',           'Débouchage WC',                     180, 180, 'forfait'),
  ('DEBOUCHAGE_EVIER',        'Débouchage évier',                  150, 150, 'forfait'),
  ('DEBOUCHAGE_DOUCHE',       'Débouchage douche',                 150, 150, 'forfait'),
  ('HYDROCURAGE',             'Hydrocurage',                       350, 350, 'forfait'),
  ('INSPECTION_CAMERA',       'Inspection caméra',                 200, 200, 'forfait'),
  ('VIDANGE_FOSSE',           'Vidange fosse septique',            280, 280, 'forfait'),
  ('CURAGE_CANALISATION',     'Curage canalisation',               320, 320, 'forfait'),
  ('DEPLACEMENT',             'Déplacement',                        50,  50, 'forfait'),
  ('MAIN_DOEUVRE',            'Main d''œuvre',                      65,  65, 'heure'),
  ('RAPPORT_CAMERA',          'Fourniture d''un rapport caméra',    90,  90, 'forfait'),
  ('HEURE_SUPPLEMENTAIRE',    'Heure supplémentaire',               95,  95, 'h')
on conflict (type) do nothing;

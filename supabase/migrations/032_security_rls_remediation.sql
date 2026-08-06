-- ============================================================
-- 032 — Remédiation sécurité RLS (ltdb-crm)
-- Généré / validé 2026-08-06 contre le schéma app-realisations-ltdb
--
-- Hypothèse : le CRM Next.js n'utilise QUE SUPABASE_SERVICE_ROLE_KEY
-- (lib/supabase.ts → getSupabase). service_role contourne RLS.
-- Après ENABLE RLS sans policy d'écriture, la clé anon ne peut plus
-- lire/écrire ces tables.
--
-- Corrections vs script initial :
--   - allocate_document_number(text, int)  (pas allocate_document_number())
--   - policies idempotentes (DROP IF EXISTS)
--   - tarifs : RLS sans SELECT public (chargé via service_role
--     dans app/accord/nouveau — le site Django a sa propre base)
--
-- Réversible :
--   ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
-- ============================================================

-- ---- 1a. Tables 100% back-office : fermeture totale ----------
ALTER TABLE public.comptes_techniciens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connexions_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accords_intervention ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_devis         ENABLE ROW LEVEL SECURITY;

-- Aucune policy → anon / authenticated : refus total.
-- service_role : accès inchangé.

-- ---- 1b. Tarifs (catalogue CRM) : fermeture totale -----------
-- Pas de lecture anon : les prix passent par les API / RSC serveur.
ALTER TABLE public.tarifs ENABLE ROW LEVEL SECURITY;

-- Si un jour le site public doit lire tarifs via anon, décommenter :
-- DROP POLICY IF EXISTS "lecture publique tarifs" ON public.tarifs;
-- CREATE POLICY "lecture publique tarifs"
--   ON public.tarifs
--   FOR SELECT
--   TO anon, authenticated
--   USING (true);

-- ---- 1c. Fonctions : figer search_path (anti-injection) -------
ALTER FUNCTION public.parametres_set_updated_at() SET search_path = '';
ALTER FUNCTION public.set_updated_at()            SET search_path = '';
ALTER FUNCTION public.allocate_document_number(text, int) SET search_path = '';

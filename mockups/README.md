# Maquettes — pages de réalisation LTDB

Maquettes du design des pages publiées sur `lestechniciensdudebouchage.fr/nos-realisations/<slug>`.

## Fichiers

| Fichier | Description |
|---|---|
| `realisation-demo.html` | **Variante A** — sections en cartes douces, ombres légères, FAQ accordéon « + » |
| `realisation-demo-2.html` | **Variante B** — en-têtes de section pleine largeur colorés, style plus éditorial |

Ouvre les deux dans un navigateur (double-clic) et garde celle que tu préfères.

## Ce que les maquettes corrigent

1. **FAQ visible** — la FAQ est maintenant intégrée *dans le HTML de contenu* (`<section class="content-block faq-block">`). Avant, elle partait seulement dans `faq_json` / `seo_json` et le template Django ne l'affichait pas.
2. **Sections distinctes encadrées** — chaque partie (Résumé, Contexte, Diagnostic, Travaux, Photos, FAQ) est un bloc visuellement séparé et lisible.

## Côté app (déjà fait, déployé)

- L'app génère et envoie la FAQ dans le champ `content` → la page publiée l'affichera même si le template Django ne lit que `content`.
- Le bloc SEO du prompt a été réordonné : `faq` placé **avant** `contenu_principal` → la FAQ n'est plus perdue si la réponse de l'IA est tronquée.

## Côté site Django (à transmettre à qui gère le site)

Le rendu final est produit par le template Django. Pour appliquer le design :

1. Choisir une variante (A ou B).
2. Copier le bloc `<style>...</style>` du fichier HTML choisi dans la feuille de style du template `/nos-realisations/<slug>`.
3. S'assurer que le template affiche bien le champ `content` reçu (il contient désormais résumé + contenu + photos + FAQ).

Les classes CSS utilisées (`content-block`, `info-box`, `checklist-box`, `photo-grid`, `photo-card`, `faq-block`, `faq-item`, `faq-answer`, `resume-block`, `gallery-block`, `related-block`) correspondent exactement à celles générées par l'app — aucun changement de structure HTML nécessaire côté Django.

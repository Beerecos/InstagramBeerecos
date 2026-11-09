---
brand: BeeRecos
campaign: studio-montage
agent: beerecos-manager
created_at: 2026-11-10
updated_at: 2026-11-10
version: 1
status: review
objective: Refonte du Studio Reels — « Tu parles. BeeMarketing monte. » — sans reconstruire ce qui fonctionne
audience: Cédric Picard, développeur
owner: Cédric Picard
approved_by:
source_files: src/components/social/MontageStudio.tsx, src/components/social/studio/*, src/domain/social/montage/*, bee-marketing-agent/supabase/functions/montage/logic.ts
---

# Refonte du Studio Reels : audit et plan

## Décisions de Cédric (2026-11-09)

1. **Moteur de rendu : on garde HyperFrames**, sans migration vers Remotion. Le principe demandé (« l'IA décide QUOI, le moteur décide COMMENT ») est déjà celui du Studio :
   - l'IA produit un `edit.json` validé par schéma ;
   - HyperFrames le rend, en aperçu en direct (`@hyperframes/player`) et en MP4 1080×1920 dans le cloud.

   Remotion aurait demandé de réécrire les 22 animations et le rendu, d'héberger un serveur de rendu, et une licence payante au-delà de 3 salariés.
2. **Ordre de travail** : corriger d'abord le bug serveur, puis construire le parcours en 5 étapes.

## Audit : ce qui existe et que l'on garde

| Besoin | Existant |
|---|---|
| Import | Prises MP4, MOV, M4V, WebM ; jusqu'à 6 prises et 10 min ; envoi direct au stockage |
| Transcription | ElevenLabs Scribe, mot par mot (début et fin), recalée sur l'énergie audio ; mot corrigeable, sous-titres mis à jour |
| Analyse | Rôles (accroche, problème, preuve, chiffre, liste, CTA…) ; silences, hésitations, reprises et doublons détectés ; coupe automatique |
| Storyboard IA | Brief et séquences (Claude), retravail d'un seul bloc (régénérer, raccourcir…), 3 hooks proposés |
| Modification en langage naturel | `feedback` : opérations fermées (couper, restaurer, ajouter ou retirer une animation, sous-titres, rythme), proposition puis application |
| Styles | Charte, 4 préréglages de sous-titres, Standard BeeRecos v1, « Mon modèle » |
| Effets | 22 animations, classées par objectif (HOOK, EXPLAIN, PROOF, STAT, CTA…) dans `beemotion.ts` |
| Texte derrière la personne | `titre-derriere` + détourage (aujourd'hui manuel) |
| Cadrage | Fenêtre 9:16 manuelle, zoom alterné aux coupes |
| Historique | Annuler et rétablir (30 niveaux côté serveur, instantané côté navigateur) |
| Export et post | MP4 1080×1920, couverture, SRT, légende, mot-clé « Commente MOT » relié aux DM |

## Ce qui manque ou doit être refait

- **Deux « storyboards » sans lien.** Le storyboard IA (brief) n'est pas relié aux séquences réelles du montage. Il faut les réunir en un seul : des cartes par séquence, avec Garder, Modifier, Supprimer et Régénérer.
- **Six chemins d'IA qui se recouvrent** : proposer avec Bee, tout auto, retours, Standard ou modèle, retravail d'un bloc, candidats BeeMotion. Ils doivent fusionner en un seul « ✨ Améliorer avec l'IA ».
- **Absents** :
  - commentaires horodatés sur l'aperçu ;
  - versions A/B/C d'un Reel ;
  - recadrage automatique sur le visage (Auto Director) ;
  - détourage automatique ;
  - légende Instagram et titres de couverture générés ;
  - intensité Sobre / Équilibré / Dynamique ;
  - styles Bee Dynamic, Clean, Business, Story, Punch.

## Lots livrés

1. **Bug serveur corrigé** (BeeMarketing, branche `claude/studio-titre-derriere-serveur`).
   - Le moteur du serveur était en retard sur celui du Studio : il refusait les grands mots derrière la personne posés par le Standard v1 et « Mon modèle » (entrées rebond, verticale, latérale ; couleur noire).
   - Les deux copies ont maintenant le même code. Test serveur ajouté.
2. **Parcours en 5 étapes** (branche `claude/studio-parcours-5-etapes`) : **Importer → Storyboard → Style → Aperçu → Publier**, en réutilisant les outils existants.

   | Étape | Contenu |
   |---|---|
   | Importer | Prises, cadrage, détourage |
   | Storyboard | Garder ou retirer les passages (transcript et plans) |
   | Style | Sous-titres, Standard ou « Mon modèle », animations |
   | Aperçu | ✨ Améliorer avec l'IA (modification en langage naturel) et validation de l'aperçu |
   | Publier | Vidéo finale et post |

   - L'aperçu et sa validation, autrefois réservés au mode avancé, sont désormais accessibles en mode simple.
   - Le mode avancé reste disponible.

3. **Storyboard IA en cartes** (branches `claude/studio-storyboard-cartes`, Studio et BeeMarketing).
   - Étape Storyboard : une carte par séquence du transcript, avec :
     - les temps dans la vidéo montée (un clic lit la séquence) ;
     - le rôle (Accroche, Problème, Preuve, Chiffre, Appel à l'action…) ;
     - la phrase dite et les effets posés ;
     - le statut : Suggestion IA, Validé, Modifié ou Supprimé.
   - Actions :
     - **Garder** ;
     - **Modifier** : consigne en langage naturel limitée à la séquence, proposition de Bee puis Appliquer ;
     - **Régénérer** : autre mise en scène pour cette séquence seulement, sans réglage inventé ;
     - **Supprimer** : coupe non destructive, avec **Restaurer**.
   - Domaine pur : `storyboard-cards.ts`. Statuts enregistrés dans `edit.sceneMarks` (champ facultatif accepté par le serveur).
   - Le storyboard IA du brief (idéation) reste disponible en mode avancé. Sa fusion dans ces cartes fera partie du lot « Améliorer avec l'IA ».

## Prochains lots (ordre de priorité de Cédric)

2. **Sous-titres** : regroupement de 2 à 6 mots selon le style, préréglages Dynamic, Clean, Highlight, Punch, Minimal.
3. **Auto Director** : changements de cadrage (100 / 110 / 115 / 125 %) aux moments forts, et intensité Sobre / Équilibré / Dynamique.
4. **BeeStyles** : préréglages exprimés en configuration (comme « Mon modèle »), sans dupliquer le rendu.
5. **✨ Améliorer avec l'IA** : une seule liste de suggestions horodatées, avec Appliquer, Ignorer et Tout appliquer.
6. **Commentaires horodatés** sur l'aperçu.
7. **Mots derrière la personne** : détourage automatique (spécification du 2026-11-09, jeton GitHub nécessaire).
8. **Hooks A/B/C**, puis **Mon style** (préférences apprises).
9. **Légende Instagram et titres de couverture** générés.

Chaque lot est livré avec ses tests (unitaires et navigateur), sans envoi ni publication.

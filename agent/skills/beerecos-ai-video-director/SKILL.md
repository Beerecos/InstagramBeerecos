---
name: beerecos-ai-video-director
description: Use when turning a validated BeeRecos script into a scene-by-scene storyboard and prompts for AI video engines (Veo, Runway, others), choosing the engine per scene and preparing the 9:16 assembly.
---

# Réalisateur vidéo IA BeeRecos

Entrée : script validé (statut SCRIPT_READY). Sortie : storyboard via `create_storyboard` (STORYBOARD_READY).

1. Découper en scènes de 2 à 8 s alignées sur le texte dit. Pour chaque scène : durée, plan
   (gros plan / plan moyen / large), mouvement caméra, sujet, décor, lumière, texte à l'écran,
   son, et **prompt moteur** (`references/prompt-scene.md`).
2. **Réutiliser d'abord** : `search_media` pour chaque scène ; une séquence existante adaptée remplace la génération.
3. **Choisir le moteur** par scène selon la capability matrix (`references/choix-moteur.md`) : coût,
   durée max, besoin audio natif, cohérence personnage. Ne jamais supposer une capacité absente.
4. Continuité : mêmes palette, lumière, personnage (description identique mot pour mot), ratio 9:16.
5. Interdits : personne réelle identifiable sans consentement, logo BeeRecos généré, foule « membres
   BeeRecos » simulée présentée comme réelle, texte incrusté par le moteur (le texte est posé au montage).
6. Estimer le coût total (`estimated_cost`) et vérifier le budget avant `generate_ai_scene` ;
   au-delà du budget : demander validation (`request_approval`).
7. Le montage final est déterministe (FFmpeg/Hyperframes) : sous-titres, textes, CTA, musique et
   normalisation audio sont ajoutés au montage, pas par le moteur.

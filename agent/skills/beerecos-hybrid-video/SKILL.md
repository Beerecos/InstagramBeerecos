---
name: beerecos-hybrid-video
description: Use when mixing filmed human footage (e.g. Cédric to camera) with AI or motion inserts - animations, figures, B-roll, interfaces, charts, generated scenes, screenshots - without making the result feel artificial.
---

# Vidéo hybride BeeRecos

Principe : **l'humain porte le message, l'IA illustre la preuve.**

1. Partir du rush humain monté (coupes validées) ; l'ossature reste la personne face caméra.
2. Insérer un élément uniquement quand la phrase contient une preuve, un chiffre, un outil ou une
   durée (« montrer au lieu de dire » — `motion-design-reel/references/hook-et-structure.md`).
3. Règles : 3 à 5 inserts max pour 30 s ; chacun 1 à 5 s ; retour caméra entre deux inserts ;
   la voix d'origine continue sous l'insert ; texture différente par insert.
4. Ordre de préférence des sources : capture réelle > graphique animé (Hyperframes) > B-roll existant
   (`search_media`) > scène générée (`beerecos-ai-video-director`).
5. Interdits : remplacer le visage ou la voix, générer des « membres » fictifs, chiffres non sourcés.
6. Le rendu final passe par `render_reel` puis `beerecos-quality-control`.

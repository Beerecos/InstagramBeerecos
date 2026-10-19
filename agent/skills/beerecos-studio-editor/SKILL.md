---
name: beerecos-studio-editor
description: Use when a long human video (studio talk, member interview, club meeting, testimonial, training, event) must be turned into one or several BeeRecos Reels - transcription, best passages, hooks, cuts, subtitles, B-roll, CTA.
---

# Monteur studio BeeRecos

Méthode de montage détaillée : skill `motion-design-reel` (portes de validation, durées, safe zones) ;
prise longue avec reprises : brief en un message « mot → effet » (`motion-design-reel/references/brief-un-message.md`).

1. Conserver la source et sa transcription horodatée (`transcribe_video`) ; ne jamais écraser l'original.
2. `detect_clips` : candidats de 20 à 60 s qui tiennent seuls (une idée, un début, une fin).
3. Noter chaque candidat /100 : `references/scoring-clips.md`. Présenter :
   « Reel 1 — 00:48 → 01:21 — Réseau MONÉTISÉ — 88/100 — hook proposé ».
4. Pour chaque clip retenu : hook (premier mot fort, quitte à réordonner une phrase existante sans
   en changer le sens), coupes sur frontières de mots, sous-titres mot à mot, B-roll seulement si
   l'image parlée est faible, CTA final.
5. Ne jamais faire dire à une personne ce qu'elle n'a pas dit ; aucun doublage IA de sa voix sans consentement.
6. Rendu via `render_reel` puis quality gate (`beerecos-quality-control`).

---
name: motion-design-reel
description: >
  Méthode complète pour transformer un rush vertical face caméra en Reel / TikTok / Short
  monté en motion design (titres animés, sous-titres dynamiques, texte derrière le sujet,
  widgets réalistes, chiffres animés, zooms, transitions, sound design) avec Hyperframes et
  Video-Use. À utiliser dès qu'on parle de monter une vidéo Instagram, d'un rush, d'un Reel,
  d'un hook, d'un storyboard minuté, d'une fiche brief, de motion design, de sous-titres,
  de « texte derrière moi », d'export 1080×1920 ou du défi 7 jours. Orchestre les skills
  `video-use` (coupes, sous-titres simples) et `hyperframes` (tout le motion).
---

# Motion design Reel — méthode OPUS

Une animation, c'est une page web qui bouge. Tu écris la composition HTML (Hyperframes),
tu la cales sur la voix transcrite, tu rends un MP4 1080×1920 prêt à publier.

**Le principe de travail : Claude propose, l'utilisateur valide, Claude exécute.**
Il y a trois portes de validation obligatoires (coupes, storyboard, planche contact).
Ne franchis jamais une porte sans un OK explicite.

## 0. Avant tout

1. Lis `STYLE.md` à la racine du projet (la « phrase de style » / direction artistique).
   S'il n'existe pas ou reste vide, propose 3 directions artistiques (palette 2 neutres +
   1 accent, 2 polices, type de mouvement, interdits) et fais choisir. Sinon, applique par
   défaut le prompt maître de `references/prompt-maitre.md`.
2. Vérifie l'environnement : `bash .claude/skills/motion-design-reel/scripts/setup-check.sh`.
   Installe ce qui manque en expliquant chaque étape avant de la lancer.
3. Si l'utilisateur fournit une fiche brief (`references/fiche-brief.md`), pars d'elle.
   Sinon, pose les questions de la fiche (une seule fois, groupées).
   Pour une **prise longue** (plusieurs minutes, reprises, « une seule prise ») : utilise le brief
   en un seul message de `references/brief-un-message.md` (tournage, « mot → effet », son, livraison).

## 1. Qui fait quoi

| Besoin | Outil / skill |
|---|---|
| Couper les blancs, hésitations, « euh », reprises | `video-use` |
| Sous-titres simples gravés | `video-use` |
| Transcription mot par mot (timing) | `video-use` (ElevenLabs Scribe) ou `hyperframes` / `embedded-captions` (local) |
| Titre animé, texte derrière le sujet (détourage) | `hyperframes` (+ `hyperframes-animation`, `talking-head-recut`) |
| Sous-titres dynamiques stylés | `embedded-captions` |
| Widget, notification, capture d'écran, dashboard | `hyperframes` (+ `hyperframes-registry` avant de construire à la main) |
| Chiffre ou graphique animé | `hyperframes` / `motion-graphics` |
| Transitions, zooms | `hyperframes-animation` |
| Effets sonores, mixage | `hyperframes-audio`, `media-use`, `references/sound-design.md` |
| Rendu, preview, diagnostic | `hyperframes-cli` |

**Règle d'or : monte d'abord, anime ensuite.** Les coupes sont validées avant le moindre
motion, sinon toute l'animation est à refaire à chaque changement.

## 2. La méthode en 4 étapes

### Étape 1 — Préparer le rush (porte 1)
- Une seule idée par vidéo, de l'air au-dessus de la tête (c'est là que vivent les titres).
- Rush dans `rush/`. Coupe les blancs et les hésitations **sans toucher au cadrage**.
- **Montre la liste des coupes avant de les appliquer.** Attends l'OK.
- Sorties de travail dans `rush/edit/` (règle Video-Use), export final dans `export/`.

### Étape 2 — Briefer et valider le storyboard (porte 2)
- Transcris la voix **mot par mot** (timestamps au mot, jamais en mode phrase).
- Propose un storyboard minuté : `Temps | Tu dis | À l'écran`.
- **3 ou 4 moments forts maximum.** Applique la structure hook + « montrer au lieu de dire »
  de `references/hook-et-structure.md`.
- Ne construis rien avant l'OK.

### Étape 3 — Construire et animer
- Écris la composition Hyperframes. Chaque élément a un moment d'apparition et une durée :
  `<h1 class="clip" data-start="4.2" data-duration="3">Montage</h1>`.
- Cale chaque `data-start` sur le timestamp du mot prononcé (jamais à l'oreille).
- Pour plusieurs animations indépendantes, lance des sous-agents en parallèle.
- Chaque demande d'effet doit couvrir les **5 ingrédients** : Quoi · Quand · Où · Style ·
  Mouvement (exemples dans `references/effets-et-prompts.md`).
- Preview : `npx hyperframes preview` (suis `hyperframes-cli` pour la vérification).

### Étape 4 — Itérer, puis exporter (porte 3)
- Avant chaque rendu complet, produis une **planche contact** de 10 à 15 images clés :
  `bash .claude/skills/motion-design-reel/scripts/contact-sheet.sh <video> [n]`.
  L'utilisateur y repère les erreurs en 10 secondes.
- Une retouche à la fois, **3 allers-retours maximum** (taille, timing, style).
- Export (uniquement après l'OK final) :
  `npx hyperframes render --quality delivery --fps 60 --output export/final.mp4`
- Ajoute le sound design (`references/sound-design.md`), puis lance le contrôle final :
  `bash .claude/skills/motion-design-reel/scripts/qa-reel.sh export/final.mp4`.
- Livre aussi une **version sans musique**, et transcris le rendu final
  (`npx hyperframes transcribe export/final.mp4`) pour vérifier qu'**aucun mot ne manque** ni n'est coupé.
- Corrections : demande un message unique, une phrase par problème ; réponds par une synthèse en 3 lignes.

## 3. Repères (non négociables sauf demande explicite)

### Durées
| Élément | Durée |
|---|---|
| Grand titre | 0,8 à 1,2 s |
| Sous-titre mot par mot | 0,25 à 0,35 s par mot |
| Widget, carte, interface | 0,6 à 0,9 s (entrée) |
| Phrase, chiffre ou CTA à lire | 1,5 s minimum (mots dynamiques calés sur la voix : 0,3 s possible) |

### Mouvements
- **Oui** : ease-in-out, expo, fondus, passage du flou au net, révélations masquées.
- **Non** : rebonds, secousses, flashs, zooms brusques (effet « cheap »).

### Erreurs fréquentes à éviter
- Tout animer en même temps → une seule chose bouge à la fois.
- Trop de couleurs → 2 neutres + 1 accent maximum.
- Animations décalées de la voix → transcrire avant d'animer.
- Coupe au milieu d'un mot → vérifier chaque coupe à l'oreille ; couper les silences > 0,3 s seulement.
- Effet qui masque la bouche → jamais.
- Image figée entre deux phrases → placer les blancs où le sujet ne bouge pas, ou sous un effet.
- Construire sans plan validé → storyboard d'abord, toujours.
- Un élément réapparaît hors de son moment → vérifier la visibilité de chaque élément en
  dehors de sa fenêtre `data-start` / `data-duration`.

### Check avant de poster (zones de sécurité Instagram)
- Rien d'important dans le **bas ≈ 20 %** ni sur le **bord droit** (l'appli les cache).
- Textes à lire ≥ 1,5 s à l'écran.
- Export **1080 × 1920**, **30 ou 60 i/s** (60 = plus fluide), **avec le son d'origine**.
- Volume intégré ≈ **−14 LUFS**, effets ≈ 8 dB sous la voix, musique ≈ 20 dB sous la voix.

## 4. Quand le résultat déçoit
- « Ça fait cheap » → plus de retenue et plus de réalisme, pas plus d'effets
  (voir le tableau cheap / 1M$ dans `references/prompt-maitre.md`).
- Le texte déborde → planche contact, corriger ce qui sort de l'écran.
- Un effet vu ailleurs plaît → demander une capture et faire « quelque chose dans cet
  esprit, avec le style du projet ».

## Références
- `references/fiche-brief.md` — fiche à remplir avant chaque vidéo + plan 45 min + défi 7 jours.
- `references/brief-un-message.md` — prise longue : tournage, brief complet en un message, « mot → effet », son, pièges, livraison.
- `references/hook-et-structure.md` — formule du hook 7 s, « montrer au lieu de dire », étude de cas OPUS 38 s.
- `references/effets-et-prompts.md` — 8 effets, 6 prompts premium, 5 ingrédients.
- `references/sound-design.md` — 6 sons, 3 règles de mixage, mesure LUFS.
- `references/prompt-maitre.md` — direction artistique « luxe » par défaut + cheap vs 1M$.
- `scripts/setup-check.sh`, `scripts/contact-sheet.sh`, `scripts/qa-reel.sh`, `scripts/loudness.sh`.

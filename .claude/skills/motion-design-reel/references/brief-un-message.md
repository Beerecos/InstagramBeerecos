# Brief en un seul message — montage d'une prise longue

Source : guide « Montage vidéo avec Claude Code » (vibesmoney.com, Alexis Dubain, 2026) : un Reel
de 40 s monté à partir d'une seule prise de 5 min 28 avec Claude Code + Hyperframes + FFmpeg.
Adapté ici à la charte BeeRecos (`STYLE.md`) et aux trois portes de validation du skill.

Principe : **tout le contexte en un message**, pour que le montage soit cohérent du premier coup.
La prise filmée devient le fond de la composition ; chaque effet est une ligne calée sur le mot exact.

## Tournage (une seule prise, ~15 min)
- Ne pas couper quand on bute : **redire la phrase et continuer**.
- Laisser **1 seconde de silence avant chaque reprise** (repère pour les coupes).
- Caméra fixe à hauteur des yeux (4K si possible), micro-cravate, lumière face à soi.
- De l'air au-dessus de la tête (les titres y vivent).

## Modèle de brief (à copier dans `briefs/AAAA-MM-JJ-<sujet>.md`)

```markdown
# Brief — <titre>

## La prise
- Fichier : rush/<fichier>.mp4
- Garde la version la plus fluide de chaque phrase.
- Texte, phrase par phrase :
  1. …
  2. …

## Le format
- Vertical 1080 × 1920, 60 i/s (30 accepté), ~40 s.
- Sous-titres mot par mot (Poppins, blanc ou noir selon le fond, hors des 20 % du bas).
- Option « coulisses » : écran partagé, montage en haut / prise brute en bas, au même instant.
- Option : pastille qui affiche le nom de l'effet en cours (contenus pédagogiques).

## La charte
- STYLE.md (BeeRecos) : bleu #2851FF, blanc, noir, un seul accent ; Poppins ; logo officiel en fin.
- Pas d'émojis, pas de dégradés criards.

## Les effets — une ligne par effet : « mot → effet »
- « … » → …
- « … » → …
Règle : un effet ne masque **jamais la bouche**. 3 ou 4 moments forts sur 20 s, ~1 par phrase sur 40 s.

## Le son
- Couper les silences > 0,3 s, **jamais au milieu d'un mot**.
- Nettoyer la voix, compression douce, **−14 LUFS** (true peak ≤ −1 dBTP).
- Pas d'isolation vocale IA si elle étouffe la voix (comparer au casque).
- Accélérer de 5 % sans changer la hauteur (facultatif).
- Musique libre de droits calée sur les temps, **~20 dB sous la voix**.
- Un bruitage court par effet, ~8 dB sous la voix.

## Le détourage (texte ou motion derrière le sujet)
- Sans halo blanc ni fond entre les mèches ; vérifier en gros plan sur fond coloré.

## Avant livraison
- Me présenter le plan : phrases gardées, effet et heure de chacun (porte 1 + 2).
- Rendre le MP4 **et une version sans musique**.
- Transcrire le fichier final et vérifier qu'**aucun mot ne manque**.
```

## Livraison et corrections
1. Plan → OK → construction → planche contact → OK → rendu (portes du skill).
2. Regarder la version complète **avec le son**.
3. Corrections : **une phrase par problème**, décrire le ressenti plutôt que les réglages,
   **tous les retours dans un seul message** ; Claude répond par une synthèse des changements en 3 lignes.

## Vérification « aucun mot ne manque »
```bash
# Transcription locale du rendu final (Hyperframes ; nécessite whisper.cpp, voir `npx hyperframes doctor`)
npx hyperframes transcribe export/<fichier>.mp4
```
Comparer mot à mot avec le texte du brief ; tout mot absent ou coupé = coupe à reprendre.

## Bibliothèque d'effets « mot → effet » (exemples du guide, à filtrer par STYLE.md)
| Effet | Quand l'utiliser | Compatible charte BeeRecos |
|---|---|---|
| Frise des coupes (la prise qui se resserre) | parler du montage, des coulisses | oui |
| Zoom sur un mot important (vers la main levée) | mot-clé du hook | oui (zoom doux, expo) |
| Lumière sur un mot | idée centrale | oui |
| Couleur qui revient (noir et blanc → couleur) | mot d'impact (« Boum ») | oui, bleu de charte |
| Motion design 3D derrière le sujet | concept abstrait | oui, formes de la charte |
| Orbite de cartes | énumération, offres | oui |
| iPhone 3D / interface | appli, outil, DM | oui (capture réelle) |
| Check-list cochée | étapes, méthode | oui |
| Arrêt sur image + contour blanc | « regarde ça » | oui |
| Couverture de magazine | réussite, témoignage **réel** | oui, jamais de faux témoignage |
| Grand chiffre derrière la tête | un chiffre **vérifié** | oui, jamais de chiffre inventé |
| Terminal qui tape les étapes | contenus IA / BeeMarketing | oui |
| Dézoom avec tremblement | — | **non** (secousse interdite par STYLE.md) |

## Pièges signalés
- Couper au milieu d'un mot → vérifier chaque coupe **à l'oreille**, pas seulement sur le texte.
- Voix étouffée par l'IA → comparer avant/après au casque.
- Musique trop forte → ~20 dB sous la voix, tester sur un haut-parleur de téléphone.
- Image figée entre deux phrases → placer les blancs où le sujet ne bouge pas, ou sous un effet.
- Cheveux mal détourés → contrôle en gros plan sur fond de couleur.

## Outils (gratuits sauf mention)
Claude Code (abonnement Claude) · Hyperframes (HeyGen, open source) · Node.js 22+ · FFmpeg ·
transcription locale (whisper.cpp via Hyperframes) · détourage Hyperframes (ou macOS sur Mac) ·
musique Mixkit (lire la licence de chaque morceau) · bruitages Pixabay (gratuit) ou ElevenLabs
(offre gratuite non commerciale : offre payante requise pour BeeRecos).

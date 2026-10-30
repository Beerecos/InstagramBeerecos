# beemarketing-promo — film promotionnel BeeMarketing (60 s)

« BeeMarketing. De la visibilité aux opportunités. »

Le film est une **présentation du concept** : de nombreuses fonctions du parcours ne sont pas encore développées.
Voir `NOTE-PRODUCTION.md`.

| Livrable | Fichier |
|---|---|
| Vertical 9:16, 1080×1920, 30 i/s | `exports/BeeMarketing_Promo_60s_9x16.mp4` |
| Horizontal 16:9, 1920×1080, 30 i/s | `exports/BeeMarketing_Promo_60s_16x9.mp4` |
| Sous-titres | `exports/BeeMarketing_Promo_60s.srt` |
| Script de voix off | `SCRIPT-VOIX.md` |
| Note de production (fonctions confirmées, maquettes, assets manquants) | `NOTE-PRODUCTION.md` |

## Organisation

```
config/promo.json          ← tout ce qui se règle : textes, couleurs, timings, formats, URL, données de démo, audio
hyperframes/src/           ← sources HyperFrames : accroche (intro.html, 4 s) et signature (outro.html, 5 s), GSAP
hyperframes/vendor/        ← GSAP 3.14.2 (local, rendu sans réseau)
remotion/                  ← sources Remotion : Root, Master (montage 60 s + audio + sous-titres), ui.tsx, scenes/
public/brand/              ← logo et symbole BeeMarketing officiels (copie de ../../public/brand)
public/fonts/              ← Poppins (charte) et Caveat (manuscrite provisoire), woff2
public/clips/              ← séquences HyperFrames rendues (muettes), importées par Remotion
public/audio/              ← voix (voix/), effets (sfx/), musique (générée, non versionnée)
audio/                     ← texte phonétique de la voix (lignes.tsv) et transcriptions Whisper
scripts/                   ← génération HyperFrames, musique, voix, SRT, finalisation, planches de contrôle
exports/                   ← MP4 finaux et SRT
```

Répartition des moteurs :
- **HyperFrames** : scènes 1 et 10, rendues en MP4 muets dans chaque format.
- **Remotion** : scènes 2 à 9, montage maître, import des deux clips aux images 0 et 1650, voix, musique avec
  ducking, effets et sous-titres.

Il n'y a pas d'intégration native entre les deux moteurs : ils échangent des fichiers vidéo.

## Prérequis

Node 22+ (testé avec Node 24), FFmpeg, Python 3 avec numpy et scipy (pour la musique). Chromium s'installe au
premier rendu, ou utilisez celui du système.

```bash
cd projets/beemarketing-promo
npm install
npm install-scripts approve esbuild   # npm 11 : autorise le binaire esbuild utilisé par Remotion
```

## Prévisualiser

```bash
npm run studio
```

Ouvre Remotion Studio sur `BeeMarketing-9x16` et `BeeMarketing-16x9`.

Pour prévisualiser une séquence HyperFrames :

```bash
node scripts/build-hyperframes.mjs
```

```bash
cd hyperframes/build/intro-9x16 && npx hyperframes preview
```

## Reproduire les rendus

Tout reconstruire (musique, clips HyperFrames, deux formats, SRT) :

```bash
npm run build
```

Ou étape par étape :

```bash
npm run music
```

```bash
npm run hf:check
```

```bash
npm run hf:render
```

```bash
npm run typecheck
```

```bash
npm run render:9x16
```

```bash
npm run render:16x9
```

```bash
npm run srt
```

Ce que fait chaque commande :
- `npm run music` génère `public/audio/musique.wav` et les effets. Le résultat est identique à chaque exécution
  (graine fixe).
- `npm run hf:check` contrôle les compositions HyperFrames (lint, mise en page, contraste).
- `npm run hf:render` produit `public/clips/{intro,outro}-{9x16,16x9}.mp4`.
- `npm run render:9x16` et `npm run render:16x9` lancent le rendu Remotion, puis la normalisation sonore (−14 LUFS).

Planche de contrôle (images fixes Remotion) :

```bash
bash scripts/contact-sheet.sh 9x16 planche.png 300 600 900 1200 1500
```

## Modifier

- **Textes, timings, données de démo, couleurs, URL** : modifier `config/promo.json`, puis relancer `hf:render` et
  les rendus.
- **Voix** :
  1. Pour une nouvelle voix de synthèse, éditer `audio/voix/lignes.tsv`, puis lancer `npm run voice`.
  2. Pour un enregistrement humain, déposer les fichiers `public/audio/voix/sXX.wav`.
  3. Dans les deux cas, recaler `audio.voice[].at` et `captions[]` dans `config/promo.json`. Les temps de chaque mot
     se trouvent dans `audio/transcripts/*/transcript.json`.
- **URL du CTA** : renseigner `urls.cta`. Le film n'affiche aujourd'hui aucune adresse, faute d'URL fournie.

Les scènes sont des maquettes animées : aucun message, aucune campagne, aucune inscription et aucun paiement réel
n'est déclenché.

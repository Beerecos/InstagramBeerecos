# Montage d'une vidéo tournée : `<projet>.edit.json`

Un seul fichier décrit le montage d'une prise (source de vérité). Claude, le studio et le rendu le lisent et l'écrivent.
Le moteur est Hyperframes (le même que les Reels 100 % IA) ; le code est dans `src/domain/video/edit.ts`,
`animations.ts` et `edit-composition.ts`.

## Règle d'or
**Tous les temps sont en millisecondes de la prise d'origine**, jamais du temps monté. Recouper un silence ne décale
aucune animation : chaque instant est ancré sur un mot prononcé du transcript.

## Exemple
```json
{
  "video": "prise.mp4",
  "captions": "prise.json",
  "accent": "violet",
  "ranges": [{ "fromMs": 0, "toMs": 4200 }, { "fromMs": 5100, "toMs": 12800 }],
  "custom": [
    { "name": "titre", "fromMs": 300, "toMs": 2800, "props": { "texte": "Une recommandation, ça vaut combien ?" } },
    { "name": "mot-cle", "fromMs": 10200, "toMs": 12700, "props": { "mot": "CLUB" } }
  ],
  "sounds": [{ "file": "pop.mp3", "atMs": 300, "volume": 0.6 }]
}
```

## Clés
| Clé | Rôle | Défaut |
|---|---|---|
| `video` | prise, à côté du fichier (nom simple : lettres, chiffres, `. _ -`) | obligatoire |
| `captions` | transcript mot à mot `[{ "text", "startMs", "endMs" }]` | aucun |
| `accent` | `violet` ou `vert` (un seul accent par vidéo, `STYLE.md`) | `violet` |
| `ranges[]` | morceaux **gardés**, triés, sans chevauchement (coupes sèches entre eux) | obligatoire |
| `subtitles` | sous-titres karaoké (4 mots / 26 caractères par page) | `true` |
| `voiceGain` | gain de la voix (1 = inchangé, 3,98 max) | `1` |
| `custom[]` | animations `{ name, fromMs, toMs, props, label? }` (registre ci-dessous) | `[]` |
| `sounds[]` | bruitages `{ file, atMs, volume?, durationMs? }` | `[]` |

Toute clé inconnue est une erreur. Les messages sont en français :
`• ranges[1] → chevauche ou précède le morceau précédent…`.

## Animations du kit (`custom[].name`)
| Nom | Réglages (`props`) | Usage |
|---|---|---|
| `titre` | `texte` (≤ 80), `detail?` (≤ 120) | accroche, changement d'idée |
| `mot-cle` | `mot` (majuscules, sans espace) | CTA « commente MOT → DM » |

Une animation inconnue ou mal réglée n'arrête jamais la vidéo : un bandeau rouge la remplace à l'aperçu.
Ajouter une animation = une entrée dans `KIT_ANIMATIONS` (`src/domain/video/animations.ts`) : fiche (label,
description, durée conseillée), schéma zod des réglages, fonction de rendu (HTML échappé + tweens GSAP).

## Pipeline (tout tourne sur le poste)
```bash
npm run video -- new projets/mon-reel/prise.mp4            # crée prise.edit.json (toute la prise)
npm run video -- transcribe projets/mon-reel/prise.edit.json   # transcript mot à mot (whisper.cpp local, français)
npm run video -- autocut projets/mon-reel/prise.edit.json      # MONTRE le plan de coupe numéroté, n'écrit rien
npm run video -- autocut projets/mon-reel/prise.edit.json --apply --drop=2,5-6   # applique (sauvegarde .bak-cuts)
npm run video -- validate projets/mon-reel/prise.edit.json
npm run video -- preview projets/mon-reel/prise.edit.json 3200,9800   # PNG aux instants (ms de la prise)
npm run video -- render projets/mon-reel/prise.edit.json             # MP4 dans export/, puis contrôle qualité
```

- **Transcription** : `hyperframes transcribe` (modèle multilingue `small`, `--language fr` forcé ; `--model=medium`
  pour un son difficile), puis **recalage sur l'énergie audio** : îlots de parole (fenêtres de 20 ms, seuil =
  bruit du 15e centile + 6 dB) ; les mots placés dans un silence sont ramenés dans la parole réellement entendue.
- **Coupe** : phrases numérotées (ponctuation ou pause > 700 ms). Suggestions : *reprise* (phrase très proche de
  l'une des deux suivantes, Jaccard ≥ 0,55 : on garde la dernière version) et *faux départ* (≤ 3 mots qui
  commencent la phrase suivante). Les hésitations (« euh », « ben »…) sont toujours retirées ; un silence de plus
  de 350 ms entre deux mots est coupé, avec 70 ms de marge avant et 110 ms après. `--drop=` vide : ne retire
  aucune phrase. Montrer le plan, obtenir l'accord, puis appliquer.
- **Sous-titres** : nouvelle page à chaque raccord et à chaque fin de phrase.
- **Aperçu** : toujours ouvrir la planche `snapshots/contact-sheet.jpg` avant de dire que c'est bon.
- **Rendu** : `hyperframes check` puis rendu `delivery`, puis `qa-reel.sh` (format, audio, volume, zones Instagram).

## Autres commandes
```bash
npm run video:build -- projets/mon-reel/prise.edit.json      # écrit seulement index.html (composition Hyperframes)
cd projets/mon-reel && npx hyperframes@0.8.126 preview       # aperçu interactif dans le navigateur
```

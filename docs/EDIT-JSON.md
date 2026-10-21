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

## Commandes
```bash
npm run video:validate -- projets/mon-reel/prise.edit.json   # schéma + cohérence + fichiers présents
npm run video:build -- projets/mon-reel/prise.edit.json      # écrit index.html (composition Hyperframes)
cd projets/mon-reel && npx hyperframes@0.8.126 preview       # aperçu ; render pour le MP4
```

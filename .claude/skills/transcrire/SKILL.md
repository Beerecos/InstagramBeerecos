---
name: transcrire
description: Transcrit mot à mot la prise d'un projet edit.json (whisper local, français), recalé sur la voix réelle, pour les sous-titres et les coupes. À utiliser pour « transcris », « sous-titres », « transcription », « qu'est-ce que je dis », « génère les sous-titres ».
---
# /transcrire : transcript mot à mot

Whisper (local, via Hyperframes) écrit `<prise>.json` = `[{ text, startMs, endMs }]` en ms de la prise, puis chaque mot
est recalé sur l'énergie audio (un mot placé dans un silence est ramené dans la parole entendue). L'edit.json reçoit
`captions`. Sous-titres karaoké activés par défaut (`subtitles: true`). Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- Rien en général. Son difficile (musique, bruit, plusieurs voix) → proposer `--model=medium` (plus lent).

## Réglages
| Clé | Rôle |
|---|---|
| `captions` | nom du fichier transcript, écrit par la commande |
| `subtitles` | `false` pour couper les sous-titres karaoké |

## Ce que tu écris dans le JSON
```json edit
{ "video": "prise.mp4", "captions": "prise.json", "subtitles": true, "ranges": [{ "fromMs": 0, "toMs": 42300 }] }
```

## Déroulé standard (dans cet ordre)
1. Projet visé : un seul `projets/*/*.edit.json` → on le prend ; plusieurs → demande ; aucun → `/nouvelle-video`.
2. `npm run video -- transcribe <p.edit.json>` (le premier lancement télécharge le modèle : quelques minutes).
3. Lis le transcript et **redis-le** à l'utilisateur en phrases, avec les instants clés (accroche, CTA).
4. Relève les mots probablement mal compris (noms propres : « BeeRecos » est souvent mal transcrit). Corrige
   uniquement le `text` de ces mots dans `<prise>.json`, jamais les temps, après accord.
5. `npm run video -- validate <p.edit.json>` puis propose `/couper`.

## Garde-fous
- Rien d'inventé : un mot inaudible reste tel que transcrit, on ne complète pas une phrase.
- Orthographe de la marque dans les sous-titres : **BeeRecos**.

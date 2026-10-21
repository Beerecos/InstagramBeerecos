---
name: exporter
description: Rend en MP4 1080×1920 une vidéo montée avec edit.json, après aperçu validé, puis lance le contrôle qualité. À utiliser pour « exporte », « rends la vidéo », « fais le MP4 », « c'est bon, sors la vidéo », « export final ».
---
# /exporter : rendu MP4 et contrôle qualité

Hyperframes vérifie la composition, rend le MP4 dans `export/`, puis `qa-reel.sh` contrôle format, cadence, codec,
audio, volume (-14 LUFS visé) et produit l'image des zones cachées Instagram. Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- Un OK explicite sur la planche d'aperçu (jamais de rendu « pour voir »).
- Le nom de sortie (par défaut : `export/<prise>.mp4`).

## Réglages
| Clé | Rôle |
|---|---|
| `voiceGain` | gain de la voix si le contrôle signale un volume trop bas (1 = inchangé) |

## Ce que tu écris dans le JSON
Rien, sauf si le volume est à corriger :
```json edit
{ "video": "prise.mp4", "captions": "prise.json", "voiceGain": 1.25, "ranges": [{ "fromMs": 0, "toMs": 42300 }] }
```

## Déroulé standard (dans cet ordre)
1. `npm run video -- validate <p.edit.json>`.
2. `npm run video -- preview <p.edit.json> <accroche>,<milieu>,<CTA>` → **ouvre la planche**, montre-la, attends l'OK.
3. `npm run video -- render <p.edit.json>`.
4. Lis le rapport : `[!!]` volume → `bash .claude/skills/motion-design-reel/scripts/loudness.sh export/<prise>.mp4 --fix export/<prise>-14lufs.mp4`
   (ou `voiceGain` puis nouveau rendu) ; ouvre `export/<prise>-zones.jpg` et vérifie que rien d'important n'est caché.
5. Passe `beerecos-quality-control` avant toute mise en validation.

## Garde-fous
- Publier est public et irréversible : jamais sans OK explicite (`reel-ia-autopilot`, `content/autopilote.md`).
- Le MP4 reste hors git (`export/`).

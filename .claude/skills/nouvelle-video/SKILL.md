---
name: nouvelle-video
description: Crée un projet de montage edit.json à partir d'une prise filmée (face caméra, interview, témoignage). À utiliser pour « nouvelle vidéo », « j'ai tourné une vidéo », « monte ma prise », « commence un montage », « voici mon rush ».
---
# /nouvelle-video : créer le projet de montage

Une prise devient un dossier `projets/<sujet>/` avec `<prise>.edit.json` : un seul morceau gardé, toute la prise.
Tout le reste (transcription, coupes, titres, rendu) écrit ensuite dans ce fichier. Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- Le fichier de la prise, s'il ne l'a pas donné (par défaut : la vidéo la plus récente de `rush/`).
- Le sujet en 2 ou 3 mots pour nommer le dossier (par défaut : la date du jour, `AAAA-MM-JJ`).

## Réglages
| Clé | Rôle |
|---|---|
| `video` | nom de la prise, à côté de l'edit.json (lettres, chiffres, `. _ -`) |
| `ranges` | `[{ fromMs: 0, toMs: <durée> }]` : toute la prise |

## Ce que tu écris dans le JSON
Rien à la main : la commande écrit ceci.
```json edit
{ "video": "prise.mp4", "ranges": [{ "fromMs": 0, "toMs": 42300 }] }
```

## Déroulé standard (dans cet ordre)
1. Crée `projets/<sujet>/` et **copie** la prise dedans (jamais déplacer ni modifier l'original de `rush/`).
   Nom avec espace ou accent → renomme la copie (`prise-cedric.mp4`).
2. `npm run video -- new projets/<sujet>/<prise>.mp4`
3. Vérifie le format : `ffprobe -v error -show_entries stream=width,height -of csv=p=0 <prise>` ; si ce n'est pas du
   vertical 9:16, dis-le (le rendu recadre au centre).
4. Annonce la durée et propose `/transcrire`.

## Garde-fous
- Un projet existe déjà → ne l'écrase pas, demande s'il faut reprendre celui-ci.
- Les prises ne vont jamais dans git (`projets/**/*.mp4` est ignoré).

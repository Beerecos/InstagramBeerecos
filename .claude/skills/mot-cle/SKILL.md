---
name: mot-cle
description: Pose la pastille du mot-clé à commenter (CTA « commente CLUB → DM ») à la fin d'une vidéo edit.json. À utiliser pour « CTA », « appel à l'action », « commente CLUB », « mot-clé en commentaire », « fin de vidéo », « fais commenter ».
---
# /mot-cle : CTA « commente MOT »

« Commente » puis le mot-clé dans une pastille bleue BeeRecos, au moment où la voix le prononce. Une instance de
`custom[]` nommée `mot-cle`. Le mot doit correspondre à une campagne CTA (DM automatique, `reel-ia-autopilot`).
Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- Le mot (par défaut : `CLUB` ; autres CTA BeeRecos : `RÉSEAU`, `FORMATION`, `IA`, `INVITATION`).
- Le moment (par défaut : là où la voix dit le mot, jusqu'à la fin de la vidéo).

## Réglages
| Clé | Rôle |
|---|---|
| `props.mot` | mot-clé en majuscules, sans espace (2 à 20 caractères) |
| `fromMs` / `toMs` | ms de la prise ; `toMs` = fin du dernier morceau gardé pour finir dessus |

## Ce que tu écris dans le JSON
Une entrée de `custom[]` :
```json custom
{ "name": "mot-cle", "fromMs": 9180, "toMs": 11250, "props": { "mot": "CLUB" } }
```

## Déroulé standard (dans cet ordre)
1. Projet visé ; trouve dans le transcript le mot prononcé, propose son `startMs` et **redis la phrase**.
2. Ajoute l'entrée dans `custom[]` sans toucher aux autres clés.
3. `npm run video -- validate <p.edit.json>`.
4. `npm run video -- preview <p.edit.json> <fromMs + 900>` → **ouvre l'image** ; la pastille doit être lisible et ne pas
   chevaucher les sous-titres.
5. Rappelle qu'avant publication la campagne CTA de ce mot doit exister (`reel-ia-autopilot`) ; propose `/exporter`.

## Garde-fous
- Le mot affiché et le mot dit doivent être identiques (sinon, demande lequel garder).
- Une seule pastille par vidéo.

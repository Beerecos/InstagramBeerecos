---
name: animation
description: Pose une animation du catalogue (chiffre qui compte, liste à puces, idée barrée, logo BeeRecos de fin, ou une animation maison) sur une vidéo edit.json, calée sur un mot prononcé. À utiliser pour « ajoute une animation », « anime ce chiffre », « fais apparaître une liste », « barre cette idée », « mets le logo à la fin », « qu'est-ce que tu peux animer ».
---
# /animation : poser une animation du catalogue

Le catalogue vient du code, jamais de mémoire : `npm run video -- animations` liste chaque animation (kit BeeRecos et
`mes-animations/`) avec sa description, sa durée conseillée et un exemple de réglages. `/titre` et `/mot-cle` ont
leur propre commande. Une animation absente du catalogue → `/nouvelle-animation`. Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- Quelle idée mettre en image (par défaut : propose 1 ou 2 animations du catalogue adaptées à la phrase).
- Les réglages (par défaut : repris mot pour mot du transcript).

## Réglages
| Clé | Rôle |
|---|---|
| `name` | nom exact du catalogue (`chiffre`, `liste`, `barre`, `logo-fin`, …) |
| `props` | réglages de l'animation (voir l'exemple du catalogue) |
| `fromMs` / `toMs` | ms de la prise, ancrés sur des mots ; durée proche de la durée conseillée |

## Ce que tu écris dans le JSON
Des entrées de `custom[]`, par exemple :
```json custom
{ "name": "chiffre", "fromMs": 4200, "toMs": 7200, "props": { "valeur": 30, "apres": " %", "legende": "de chiffre d'affaires par recommandation" } }
```
```json custom
{ "name": "barre", "fromMs": 1800, "toMs": 4800, "props": { "texte": "Le bouche-à-oreille au hasard", "remplacement": "Un réseau qui recommande" } }
```
```json custom
{ "name": "logo-fin", "fromMs": 11300, "toMs": 13300, "props": { "texte": "Rejoins un club BeeRecos" } }
```

## Déroulé standard (dans cet ordre)
1. Projet visé ; `npm run video -- animations` pour le catalogue à jour.
2. Lis le transcript, trouve la phrase et le mot d'ancrage ; propose l'animation et **redis la phrase retenue**.
3. Ajoute l'entrée dans `custom[]` sans toucher aux autres clés.
4. `npm run video -- validate <p.edit.json>`.
5. `npm run video -- preview <p.edit.json> <fromMs + 900>` → **ouvre l'image** et décris-la.
6. Propose la suivante ou `/exporter`.

## Garde-fous
- `chiffre` : la valeur doit être **dite** dans la vidéo ou écrite dans le brief ; jamais estimée ni arrondie à la hausse.
- `logo-fin` couvre toute l'image : à poser après le dernier mot prononcé (prolonger le dernier morceau si besoin).
- Jamais deux animations visibles en même temps (≥ 1 s d'écart) ; une toutes les 4 à 8 s au plus.

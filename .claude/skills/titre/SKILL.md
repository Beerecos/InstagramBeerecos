---
name: titre
description: Pose un titre animé (flou → net) en haut d'une vidéo edit.json, calé sur un mot prononcé. À utiliser pour « ajoute un titre », « mets un titre », « texte à l'écran », « accroche à l'écran », « hook en texte », « titre au début ».
---
# /titre : titre animé

Un bloc noir en haut de l'image (zone de sécurité Instagram), texte Poppins blanc qui passe du flou au net, détail
facultatif dessous, sortie en fondu. Une instance de `custom[]` nommée `titre`. Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- Le texte (par défaut : l'accroche reformulée en moins de 8 mots, à valider).
- Le moment (par défaut : dès le premier mot, pendant 2,5 s).
- Un détail en dessous ? (par défaut : non).

## Réglages
| Clé | Rôle |
|---|---|
| `props.texte` | titre, 80 caractères max (idéal : moins de 8 mots) |
| `props.detail` | ligne secondaire facultative, 120 caractères max |
| `fromMs` / `toMs` | ms de la prise, ancrés sur des mots du transcript |

## Ce que tu écris dans le JSON
Une entrée de `custom[]` :
```json custom
{ "name": "titre", "fromMs": 120, "toMs": 2620, "props": { "texte": "Une recommandation, ça vaut combien ?" } }
```

## Déroulé standard (dans cet ordre)
1. Projet visé ; lis `STYLE.md` et applique `beerecos-brand` au texte (orthographe **BeeRecos**, ton, vocabulaire).
2. Lis le transcript, trouve le mot d'ancrage, propose son `startMs` comme `fromMs` et **redis la phrase retenue**.
3. Ajoute l'entrée dans `custom[]` sans toucher aux autres clés (ni `video`, ni `captions`, ni `ranges`).
4. `npm run video -- validate <p.edit.json>` ; corrige les erreurs.
5. `npm run video -- preview <p.edit.json> <fromMs + 800>` → **ouvre l'image** et décris ce qu'on voit.
6. Propose `/exporter`.

## Garde-fous
- Jamais deux animations visibles en même temps : au moins 1 s entre la fin de l'une et le début de la suivante.
- Rien d'inventé : pas de chiffre, nom ou promesse absent du transcript ou du brief.
- Bandeau rouge à l'aperçu = réglage invalide : lis le message, corrige, revalide.

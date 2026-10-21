---
name: nouvelle-animation
description: Crée une animation de montage sur mesure pour BeeRecos (dans mes-animations/), la contrôle, en montre l'aperçu et l'ajoute au catalogue. À utiliser pour « crée une animation », « invente un effet », « je veux une animation qui… », « il manque une animation », « fige cette animation ».
---
# /nouvelle-animation : créer une animation maison

Une animation maison est un fichier TypeScript dans `src/domain/video/mes-animations/`, enregistré dans
`registre.ts` ; à nom égal elle remplace celle du kit. Elle s'écrit avec la boîte à outils `fx.ts` (zones de sécurité,
`blurIn`, `fadeIn`, `slideIn`, `fadeOut`, `strikeThrough`, `countUp`, `escapeHtml`). Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- L'effet voulu en une phrase et un exemple de texte (par défaut : inspiré de la phrase du transcript visée).
- Le nom (par défaut : 1 à 3 mots en minuscules avec tirets, ex. `avant-apres`).

## Réglages
| Champ de la définition | Rôle |
|---|---|
| `label`, `description` | ce que fait l'animation et quand l'utiliser (lu par Claude pour choisir) |
| `lengthMs` | durée conseillée (500 à 15 000 ms) |
| `props` | schéma zod strict des réglages (textes bornés en longueur) |
| `example` | réglages d'exemple valides (aperçu, catalogue, tests) |
| `css` | styles, chaque règle préfixée par `.anim-<nom>` |
| `render(ctx, props)` | `{ html, tweens }` : ids préfixés par `ctx.id`, textes passés par `escapeHtml`, tweens `tl.…("#<ctx.id>…")` en secondes à partir de `ctx.start` |

## Ce que tu écris dans le JSON
Une fois l'animation enregistrée, elle s'utilise comme les autres :
```json custom
{ "name": "titre", "fromMs": 500, "toMs": 3000, "props": { "texte": "Remplace « titre » par le nom de ta nouvelle animation" } }
```

## Déroulé standard (dans cet ordre)
1. Vérifie le catalogue (`npm run video -- animations`) : si une animation existante suffit, propose-la.
2. Écris `src/domain/video/mes-animations/<nom>.ts` : `export default defineAnimation({ … })` (import depuis
   `../animations.ts` et `../fx.ts`), sur le modèle des animations du kit dans `animations.ts`.
3. Ajoute la ligne dans `mes-animations/registre.ts` : `"<nom>": <import>`.
4. `npm run video -- animation-check <nom>` ; corrige jusqu'à ✅.
5. `npm run video -- animation-preview <nom>` → **ouvre la planche** (entrée, milieu, sortie) et décris-la ;
   ajuste jusqu'à l'accord de l'utilisateur.
6. `npm run typecheck && npm test` (le test du catalogue contrôle toutes les animations).
7. Pose-la avec `/animation`.

## Garde-fous
- Charte : couleurs `#2851FF`, blanc, noir et l'accent de la vidéo (`ctx.accent`) ; police Poppins ; rien dans les zones
  cachées d'Instagram (`SAFE`) ; logo officiel seulement via `brand/`, jamais déformé.
- Déterministe : pas de `Math.random`, d'horloge ni d'`onUpdate` ; tout passe par des tweens positionnés.
- Jamais de `<script>` ni d'attribut `on…=` dans le HTML ; ne modifie pas les animations du kit pour un besoin maison.

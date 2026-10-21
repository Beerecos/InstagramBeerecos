---
name: couper
description: Coupe les silences, hésitations, phrases ratées et reprises d'une prise edit.json, après avoir montré le plan numéroté. À utiliser pour « coupe », « enlève les blancs », « retire les euh », « garde la bonne prise », « raccourcis », « coupe auto ».
---
# /couper : coupe automatique validée

Le script numérote les phrases, suggère les reprises (on garde la dernière version d'une phrase refaite) et les faux
départs, retire toujours les hésitations et coupe les silences de plus de 350 ms. Seule cette commande écrit `ranges`.
Les animations ne bougent pas : elles sont en ms de la prise. Règles : `docs/EDIT-JSON.md` § Règles.

## À demander à l'utilisateur
- Son accord sur le tableau des phrases retirées (toujours, avant d'écrire).
- Rythme voulu : « serré » (par défaut) ou « naturel » (alors ne retirer que les reprises sûres).

## Réglages
| Clé | Rôle |
|---|---|
| `ranges` | morceaux gardés, triés, sans chevauchement ; écrits par `--apply` |
| `--drop=2,5-6` | phrases à retirer (numéros du plan) ; `--drop=` vide = aucune phrase, seulement silences et hésitations |

## Ce que tu écris dans le JSON
La commande écrit les morceaux, par exemple :
```json edit
{ "video": "prise.mp4", "captions": "prise.json", "ranges": [{ "fromMs": 0, "toMs": 1327 }, { "fromMs": 3251, "toMs": 7710 }, { "fromMs": 9110, "toMs": 11300 }] }
```

## Déroulé standard (dans cet ordre)
1. Projet visé (un → on le prend, plusieurs → on demande, aucun → `/nouvelle-video`) ; pas de transcript → `/transcrire`.
2. `npm run video -- autocut <p.edit.json>` : rien n'est écrit.
3. Juge le plan : garde la dernière version d'une phrase refaite ; **dans le doute, ne retire rien** ; ne retire jamais
   l'accroche ni le CTA sans le dire.
4. **Montre le tableau** (n°, début, phrase, ✂ et pourquoi) et la durée avant → après. Attends l'accord.
5. `npm run video -- autocut <p.edit.json> --apply --drop=<liste validée>` (sauvegarde `.bak-cuts`).
6. `npm run video -- preview <p.edit.json> <début de 2 ou 3 morceaux>` → **ouvre la planche** et décris les raccords.
7. Bilan chiffré (durée, nombre de coupes) ; propose `/titre` ou `/mot-cle`.

## Garde-fous
- Annuler : `cp <p.edit.json>.bak-cuts <p.edit.json>`.
- Reel BeeRecos : viser 15–45 s ; au-delà, propose de retirer des phrases entières plutôt que d'accélérer.

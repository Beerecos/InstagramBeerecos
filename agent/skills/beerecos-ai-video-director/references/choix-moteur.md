# Choix du moteur

La décision se fait sur la capability matrix réelle des adapters (`src/providers/video/*`), jamais de mémoire.

| Besoin | Critère |
|---|---|
| Audio natif synchronisé | moteur déclarant `nativeAudio: true` |
| Plan long (> 8 s) | `maxDurationSeconds` suffisant, sinon découper |
| Même personnage sur plusieurs scènes | `characterConsistency` / image de référence |
| Transformer un rush existant (style, extension) | `videoToVideo: true` |
| Coût minimal | `estimateCost()` le plus bas parmi les moteurs qualifiés |

En cas d'échec : 1 nouvel essai contrôlé, puis proposer un autre moteur qualifié ; jamais de boucle.

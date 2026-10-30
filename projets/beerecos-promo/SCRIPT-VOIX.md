# Script de voix off — BeeRecos, 60 s

La voix des exports est une synthèse locale **provisoire** (HyperFrames `tts`, Kokoro-82M, voix française
`ff_siwis`). Pour diffuser, mieux vaut enregistrer une vraie voix : remplace `public/audio/voix/sXX.wav` en gardant
les débuts ci-dessous, puis relance le rendu.

| Scène | Début | Texte |
|---|---|---|
| 1 · Accroche | 0,15 s | Vous prospectez seul ? Faites-vous recommander. |
| 2 · Révélation | 4,3 s | BeeRecos : des clubs d'affaires qui allient réseau, formation et digitalisation. |
| 3 · Le club | 9,3 s | Deux fois par mois, de dix heures à midi, trente à cinquante membres se retrouvent dans leur club. |
| 4 · Le programme | 17,3 s | Au programme : accueil, pitchs d'une minute, formation, étude de cas, et recommandations. |
| 5 · Recommandation | 25,3 s | Chaque membre devient l'apporteur d'affaires des autres. |
| 6 · Monétiser | 31,3 s | Apporteur d'affaires, ambassadeur, animateur : chaque action compte. |
| 7 · Formation | 37,3 s | Les formations sont intégrées aux réunions, par un organisme certifié Qualiopi. |
| 8 · Digitalisation | 43,3 s | Et les outils digitaux, comme BeeCard ou BeePilot, vous aident à gérer vos contacts et votre visibilité. |
| 9 · Les clubs | 50,3 s | Plus de quarante clubs en France. Venez en visiter un. |
| 10 · Signature | 55,3 s | BeeRecos, le réseau d'affaires qui recommande votre business. |

Prononciation : le moteur de synthèse reçoit une version phonétique du texte (`audio/voix/lignes.tsv`) :
« Bi-Récosse », « Bi-Carde », « Bi-Pailotte », « Kalioppi », « biznesse ».
Points imparfaits avec cette voix :
- « club » (scène 3) ;
- « Qualiopi » ;
- « BeePilot ».

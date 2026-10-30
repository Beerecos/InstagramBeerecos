# Note de production — film BeeRecos

## Sources
Tous les faits du film viennent de **beerecos.com**, lu le 30/10/2026 dans un navigateur (le site est rendu en
JavaScript). `beerecos.fr` redirige vers `beerecos.com`.

| Affirmation du film | Source sur beerecos.com |
|---|---|
| Réseau, Formation, Digitalisation | Accueil, titre principal |
| 2 réunions par mois, 10 h – 12 h, 30 à 50 membres | Accueil, « Le concept » |
| Déroulé : accueil, pitch d'1 minute, formation, étude de cas, recommandations ; durée 2 heures | /reseau, « Le format qui fonctionne » |
| Chaque membre est l'apporteur d'affaires des autres | /reseau |
| Apporteur d'affaires, ambassadeur (prime de parrainage), animateur (prime d'animation) | /reseau, « Monétisez votre réseau » |
| Formations intégrées aux réunions, organisme certifié Qualiopi, programme 2026 de 10 unités et 20 modules, intitulés des modules M1, M3 et M5 | /formation |
| Outils BeeBot, BeePilot, BeeCard, BeeNote, BeeLead ; gérer les contacts, automatiser la prospection, maximiser la visibilité | Accueil, /bee-tools |
| Plus de 40 clubs | L'accueil indique 42, la page /clubs « 43 club(s) trouvé(s) » ; d'où la formulation prudente « plus de 40 » |
| Villes : Bayonne, Biarritz, Anglet, Toulouse, Paris, Lyon, Marseille, Montpellier, Rennes, Pau, Agen, Dax, Mérignac, Roanne, Hossegor, Saint-Jean-de-Luz | /clubs et /rejoindre (liste des clubs). Lyon et Marseille sont déduits des noms « La Part-Dieu Business Club » et « Marseille Azur Business Club » |
| CTA « Visiter un club », beerecos.com | Accueil, bouton « Visiter un club » vers /clubs |
| « Le réseau d'affaires qui recommande votre business. » #MonReseauCestTonReseau | Pied de page et accueil |

Aucun témoignage, chiffre d'affaires, prix ou nom de membre n'apparaît dans le film.

## Choix de réalisation
- Le style et le moteur sont les mêmes que pour le film BeeMarketing : blanc, bleu #2851FF, Poppins, repère bleu continu.
- HyperFrames réalise l'accroche et la signature, Remotion les scènes 2 à 9, le montage, le son et les sous-titres.
- Pas de mention « Présentation du concept » : le film décrit le réseau tel que le site le présente. Les membres sont
  des silhouettes graphiques, sans nom ni visage. Les métiers de la scène 5 (artisan, commerçant, expert-comptable,
  etc.) sont des exemples génériques.
- Le CTA renvoie vers la visite d'un club, et non vers l'adhésion, conformément à ta remarque sur le parcours
  (visiter avant d'adhérer).
- Le logo est le SVG officiel principal bleu (`public/brand/beerecos-logo-blue.svg`), animé uniquement en opacité.
- Le site écrit « Beerecos » ; le film suit la charte : **BeeRecos**.

## À remplacer avant diffusion
| Élément | Situation |
|---|---|
| Voix off | Synthèse provisoire. Voir `SCRIPT-VOIX.md`. |
| Écriture manuscrite du hashtag | Caveat Bold en bleu #2851FF, en attendant la police officielle (la charte ne prévoit que Poppins). |
| Pictogrammes des outils Bee | Une simple initiale (B, P, C, N, L), car aucun visuel officiel des outils n'est disponible. |
| Photos de vraies réunions | Non fournies. Des silhouettes graphiques les remplacent. Une photo authentique pourrait enrichir la scène 3 ou 5. |
| Nombre de clubs | « Plus de 40 » ; à mettre à jour si le site change. |

## Contrôles effectués
- Les deux exports font 1 800 images à 30 i/s, en H.264 et yuv420p, avec un son AAC 48 kHz.
- Le son est à −14,1 LUFS, avec une crête à −1,2 dBFS.
- Aucune image noire. Les raccords entre HyperFrames et Remotion ont été vérifiés image par image.
- Une transcription Whisper du mixage final retrouve tout le texte.
- `hyperframes check` : 0 erreur.
- `tsc` : 0 erreur.
- La signature reste stable de 57,3 s à 60 s.

# Note de production — BeeRecos « Tout commence par une rencontre »

## Sources (consultées le 31/10/2026)
- **Site de référence :** `https://projet-bee-we-bia.vercel.app/beeclub` (`urls.referenceUrl`), futur beerecos.com.
  - La page `/beeclub` est l'accès à l'espace adhérents : panneau « Bienvenue sur Beerecos » et formulaire de
    connexion.
  - Le contenu éditorial et les médias viennent des pages publiques du même site, accessibles par ses liens :
    accueil, `/reseau`, `/formation`, `/bee-tools`, `/solutions`.
  - BeeSchool est confirmée par le lien du site vers beeschool.io et par la phrase « La BeeSchool, l'école de
    formation BeeRecos ».
- **Adresse publique** affichée et prononcée : **beerecos.com** (`urls.displayDomain`). L'adresse Vercel
  n'apparaît nulle part dans le film : images, titres, sous-titres, voix et SRT ont été vérifiés.

## Ce que le film montre, et d'où ça vient
| Élément | Source |
|---|---|
| Les trois piliers « Réseau d'apporteurs d'affaires », « École de formation », « Digitalisation IA » | Accueil |
| Vidéo d'adhérents qui échangent (scène 1) ; photos d'accueil, de conversation et de rencontre (scènes 2, 3, 7) | Médias du site (`membres-hero.mp4`, `reseau-entrepreneurs`, `commerce-hospitalite`) |
| Formateur et groupe en formation (scène 5) ; le mot « Formation » derrière le formateur détouré | Vidéo `formation-hero.mp4` (image fixe détourée, puis vidéo) |
| Deux personnes devant un ordinateur (scène 6) | Vidéo `solutions-hero.mp4` |
| BeeCard : échanger ses coordonnées (carte, QR, « Ajouter ») | `/bee-tools` : « carte de visite digitale… partage rapide par QR code, ajout du contact en un clic » |
| BeePilot : organiser son suivi (« Relances ») | `/bee-tools` : « Le CRM BeeRecos : contacts, pipeline, relances et rendez-vous » |
| Rémunération : « peuvent aussi être rémunérées », « Rémunération possible selon les conditions du réseau » | `/reseau` (convention d'apporteur d'affaires). Pourcentages volontairement non affichés |
| Extrait « BeeRecos près de chez vous — Développez votre réseau autrement » (scène 8) | Accueil, capture recadrée sans barre d'adresse et sans QR code (qui peut renvoyer vers l'adresse Vercel) |

Aucun chiffre (clubs, adhérents, gains, statistiques de `/solutions`) n'est utilisé. BeeBot n'apparaît pas.

## Choix provisoires et médias à remplacer
| Élément | Situation |
|---|---|
| Photos et vidéos | Elles viennent du site de référence et ont l'aspect de visuels générés. Elles portent la mention « Image(s) d'illustration » et ne sont jamais présentées comme de vrais adhérents ou une vraie réunion. **À remplacer par des tournages authentiques de clubs dès qu'ils existent.** Licence d'usage vidéo à confirmer. |
| Logo BeeRecos | Fichier officiel du dépôt, identique à celui du site (« extracted from BeeRecos_BrandGuidelines_2026.pdf »). Il est **entièrement bleu**, alors que le brief décrit « Bee » en noir. Fournir la variante bicolore si elle fait foi. |
| Logo BeeSchool | Introuvable sur le site de référence. Une version typographique provisoire est utilisée : « Bee » noir, « School » bleu, en Poppins. **À remplacer.** |
| Signature #MonReseauCestTonReseau | **Poppins SemiBold**, entièrement bleue #2851FF, à votre demande, à la place d'une écriture manuscrite. Révélée par un masque d'écriture, de gauche à droite. Si un fichier de signature officiel existe, il peut la remplacer. |
| Voix off | Synthèse provisoire. Voir `SCRIPT-VOIX.md`. |
| Musique et effets | Composés par synthèse dans `scripts/music.py` (116 BPM, graine fixe). Aucun droit tiers. |

## Contrôles
- Les deux exports font 1 800 images à 30 i/s, en H.264 et yuv420p, avec un son AAC.
- Le son est à −14,1 LUFS, avec une crête à −1,2 dBFS.
- Aucune image noire.
- Accroche HyperFrames : 120 images. Signature HyperFrames : 180 images, stable à partir de 56,65 s.
- Une transcription Whisper du mixage final retrouve tout le texte.
- Sous-titres : désactivables avec la propriété `captions: false`. SRT synchronisé sur la voix produite.

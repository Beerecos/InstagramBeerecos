# Effets et prompts

## Les 5 ingrédients d'une bonne demande

Une demande floue donne un résultat générique. Avant de construire un effet, vérifie que
tu connais ces cinq points ; s'il en manque un, choisis-le d'après `STYLE.md` et dis-le.

| Ingrédient | Exemple |
|---|---|
| 1 · Quoi | Le mot « organisée » |
| 2 · Quand | Quand je le prononce |
| 3 · Où | En très grand, derrière moi |
| 4 · Style | Serif fine, blanc cassé |
| 5 · Mouvement | Monte lettre par lettre en 1 seconde, puis s'efface doucement |

> Quand je dis « organisée », fais apparaître le mot en très grand derrière moi, en serif
> fine blanc cassé, qui monte lettre par lettre en une seconde puis s'efface doucement.

## 8 effets de base

Des pistes, pas des recettes : changer le mot, le style, le moment.

| Effet | Exemple de demande | Skill à charger |
|---|---|---|
| Titre d'accroche | « Ouvre la vidéo avec le mot "Argent" en très grand, révélé par un masque qui monte. » | `hyperframes-animation` |
| Sous-titres dynamiques | « Sous-titres mot par mot, petits et fins, le mot important de chaque phrase en italique. » | `embedded-captions` |
| Texte derrière toi | « Détoure-moi et glisse le mot "Liberté" entre le décor et moi. » | `talking-head-recut`, `hyperframes` (détourage) |
| Widget réaliste | « Quand je parle de la météo, fais glisser une carte façon iPhone en verre dépoli. » | `hyperframes-registry`, `motion-graphics` |
| Chiffre animé | « Quand je dis "dix mille", un compteur qui monte de 0 à 10 000. » | `motion-graphics` |
| Zoom sur un moment fort | « Sur ma punchline, un léger zoom avant très doux, puis retour au cadre. » | `hyperframes-animation` |
| Transition de chapitre | « Entre mes deux parties, un titre "Étape 2" qui traverse l'écran en fondu. » | `hyperframes-animation` |
| Capture flottante | « Ma capture d'écran dans un cadre en verre qui flotte devant moi, avec un cercle sur le bouton. » | `hyperframes` |

## 6 prompts premium (ceux de la vidéo OPUS)

Remplacer les mots entre crochets.

**Texte derrière toi**
> Quand je dis [mot], fais apparaître le mot en Didot géant derrière moi, lettre par lettre
> depuis le centre, comme s'il sortait d'une fente, avec 2 copies en contour qui dérivent en
> dessous.

**Logo qui explose**
> Sur [mot], un plein écran façon logiciel de design : grille, règles, repères. Le vrai logo
> de [outil] apparaît en géant avec son cadre de sélection, se fissure puis explose en
> éclats. Moins d'une seconde.

**Courbe qui raconte**
> Quand je dis [durée], un plein écran ivoire : une courbe d'apprentissage qui se trace mois
> par mois et plafonne au niveau Débutant, puis une ligne orange "[solution]" qui monte d'un
> coup jusqu'à Expert.

**Le temps qui passe**
> Sur "des années", un fond blanc quadrillé avec une horloge qui se dessine puis s'emballe,
> avec une traînée sur l'aiguille, un anneau qui allume AN 1 à AN 5 et un tic-tac qui
> accélère.

**Dashboard réaliste**
> Quand je parle de [sujet], un dashboard plein écran ultra réaliste, légèrement incliné en
> 3D, comme l'app Météo d'Apple ou TradingView : vraies données fictives, chiffres qui
> défilent, graphique qui se dessine.

**CTA qui convertit**
> Sur "commente [MOT]", une vraie feuille de commentaires façon TikTok monte du bas :
> avatars, pseudos, le mot tapé lettre par lettre, puis publié en haut de la liste.

Note : un widget « façon » une app reste une interprétation générique (pas de logo ni de
marque d'un tiers reproduits à l'identique sans droit d'usage).

## Astuces
- Planche contact (10 à 15 images clés) avant chaque rendu complet.
- Effet vu ailleurs → l'utilisateur fournit une capture : « fais quelque chose dans cet
  esprit, avec mon style ».

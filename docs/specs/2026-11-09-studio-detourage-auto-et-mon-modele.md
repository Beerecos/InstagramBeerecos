---
brand: BeeRecos
campaign: studio-montage
agent: beerecos-manager
created_at: 2026-11-09
updated_at: 2026-11-09
version: 1
status: review
objective: Mots principaux derrière le personnage sans étape sur l'ordinateur ; modèle d'animation créé par Cédric dans le Studio
audience: Cédric Picard, développeur
owner: Cédric Picard
approved_by:
source_files: src/domain/social/montage/matte.ts, src/domain/social/montage/standard.ts, src/domain/social/montage/animations.ts, src/components/social/MontageStudio.tsx, bee-marketing-agent/supabase/functions/montage/index.ts
---

# Studio · Montage : détourage automatique et « Mon modèle » (spécification)

Demande de Cédric (2026-11-09) :
> « je veux que les mots principaux apparaissent derrière le personnage. et je veux créer moi-même une base
> d'animation que je vais créer comme template de base »

Choix de Cédric :
1. Le problème est le **détourage trop pénible**.
2. Le modèle se crée avec un **éditeur dans le Studio**.
3. Le périmètre est le **Montage**, c'est-à-dire la vidéo filmée.

## 1. Constat (code vérifié)

- Le titre derrière le sujet existe (`titre-derriere`, `behind: true`). La composition empile le détourage de la prise au-dessus du mot, si bien que la silhouette passe devant les lettres.
- La dynamique « BeeRecos Standard v1 » (`standard.ts`) place automatiquement deux grands mots derrière la personne : l'accroche et « à retenir ». Elle ne le fait **que si la prise a un détourage**. Sinon le mot passe en « onglet », c'est-à-dire devant.
- Le détourage se fait **sur le poste de Cédric** (`npx hyperframes@0.8.126 remove-background …`, environ 7 à 8 min pour 30 s), puis le fichier `.webm` est envoyé dans la carte « Détourage ». Cette étape n'est en pratique jamais faite, donc les mots ne passent jamais derrière.
- Les réglages des grands mots sont figés dans le code (`STANDARD_V1`) :
  - accroche : en haut, blanc, rebond ;
  - à retenir : au milieu, bleu, verticale ;
  - 2,5 s ;
  - 4 s minimum entre deux animations ;
  - 2 mots derrière au plus.

## 2. Détourage automatique

### Mesure faite (2026-11-09)

| Élément | Valeur |
|---|---|
| Outil | celui du Studio (`hyperframes remove-background`, modèle u2net_human_seg, Apache-2.0, sans service tiers) |
| Machine | 4 processeurs, sans carte graphique |
| Rythme | **0,76 s par image** (75 images en 2 min 30, installation comprise) |
| Prise de 30 s à 25 images/s | environ **10 min** |
| Prise de 60 s | environ **20 min** |

Le traitement ne peut donc pas tourner dans une Edge Function Supabase (limite de durée) ni sur Vercel. Il faut un **travail en arrière-plan**.

### Solution recommandée : un travail GitHub Actions dans `InstagramBeerecos`

C'est la même logique que les déploiements actuels. Le dépôt est public, donc les minutes de calcul sont gratuites.

1. Après l'envoi d'une prise, le Studio affiche « Détourage automatique en cours (≈ N min) ». Il n'y a plus de commande à lancer.
2. Le serveur du Montage (Edge Function `montage`, nouvelle action `request-matte`) déclenche le travail `detourage.yml`.
   - Il transmet seulement l'identifiant du montage et le nom de la prise : aucune donnée personnelle dans le déclencheur.
3. Le travail :
   1. télécharge la prise par URL signée ;
   2. lance `remove-background` ;
   3. dépose `prise.matte.webm` dans le stockage ;
   4. appelle l'action existante `matte-uploaded` (durée contrôlée à ±500 ms, règle existante).
4. Le Studio rafraîchit la carte : « Détourée ✓ ».
   - Les mots déjà posés en onglet peuvent alors passer derrière d'un clic (« Repasser les grands mots derrière »).
   - Rien n'est rendu sans aperçu validé (règle existante).
5. États honnêtes : en file, en cours, terminé, échec avec la raison et un bouton « Relancer ».
   - Une prise déjà détourée n'est pas relancée.
   - Deux demandes simultanées sur la même prise donnent un seul travail.
6. La voie manuelle actuelle (commande sur le poste, puis envoi du `.webm`) reste disponible en secours.

### À fournir ou valider par Cédric

- Un **jeton GitHub** limité au dépôt `InstagramBeerecos`, avec le droit « Actions : écriture ». Il est posé comme secret de la fonction `montage` (`GITHUB_DISPATCH_TOKEN`), jamais dans le code.
- Deux **secrets GitHub** du dépôt pour le travail : `SUPABASE_URL` et une clé serveur Supabase. Il faudra choisir entre la clé service existante et une clé dédiée.
- L'accord sur l'**attente d'environ 10 min pour 30 s** de vidéo.
- Le **déploiement** de `montage` et la fusion dans `main`, qui exigent sa validation.

### Alternative écartée

Le détourage dans le navigateur (MediaPipe) éviterait les secrets. Mais l'export d'une vidéo avec transparence n'est pas fiable sur iPhone et Safari, et le téléphone doit rester ouvert pendant tout le calcul.

## 3. « Mon modèle » : l'éditeur de la base d'animation

### Ce que Cédric règle (une seule page, aperçu à côté)

| Réglage | Choix |
|---|---|
| Grands mots | Derrière le personnage (s'il y a un détourage) ou devant |
| Accroche | Position (haut, milieu), couleur (blanc, bleu, noir), entrée (flou, rebond, verticale, latérale) |
| À retenir | Mêmes réglages |
| Durée d'un grand mot | 1,5 à 4 s |
| Nombre de grands mots derrière | 0 à 3 |
| Animations posées automatiquement | Cases : onglet, chiffre, liste, mot-clé, logo de fin |
| Espacement minimal entre deux animations | 2 à 8 s |

- Les couleurs et polices restent celles de la charte (`brand.ts`). L'éditeur n'en invente pas d'autres.
- Le contrôle de charte reste bloquant : par exemple « BeeRecos » bien écrit, baseline exacte.

### Fonctionnement

1. « Enregistrer comme Mon modèle » crée une version datée.
   - Les montages déjà enregistrés gardent leur version : ils se rejouent à l'identique.
2. « Appliquer mon modèle » sur un montage utilise ces réglages à la place de `STANDARD_V1`.
   - Le résultat est toujours un brouillon.
   - Tout texte vient de ce qui est dit (règle existante).
3. « Revenir au Standard BeeRecos v1 » reste toujours possible.
4. L'aperçu se fait sur un montage de démonstration identifié comme tel, ou sur le montage ouvert.

### Données

- Une table `studio_animation_templates` (propriétaire, nom, version, réglages validés par schéma Zod, date), avec RLS et tests dans `tests/rls/` (règle du dépôt).
- Elle est de propriété privée par défaut. Le partage à l'équipe est une option à valider plus tard.

## 4. Lots et ordre

| Lot | Contenu | Dépend de Cédric |
|---|---|---|
| A | « Mon modèle » : schéma Zod, `standard.ts` paramétrable, éditeur et aperçu, table, RLS et tests | Non (sauf migration distante et déploiement) |
| B | Bouton « Repasser les grands mots derrière » quand un détourage arrive | Non |
| C | Détourage automatique : `detourage.yml`, action `request-matte`, états dans la carte Détourage | **Oui** : jeton, secrets, déploiement |

Vérifications avant chaque livraison : `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` (l'interface change). Aucune publication, aucun envoi.

## 5. Critères d'acceptation

1. Une prise envoyée est détourée sans action sur l'ordinateur. Le détourage apparaît « Détourée ✓ » ; un échec affiche sa raison et « Relancer ».
2. Avec un détourage, l'accroche et « à retenir » sont posées derrière le personnage, et l'aperçu le montre.
3. Cédric modifie son modèle (par exemple accroche au milieu, bleue, entrée latérale, 3 s), l'enregistre, l'applique : le brouillon suit ces réglages.
4. Un montage enregistré avant la modification du modèle se rejoue à l'identique.
5. Aucun texte n'est inventé, et le contrôle de charte reste bloquant.

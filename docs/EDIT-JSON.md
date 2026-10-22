# Montage d'une vidéo tournée : `<projet>.edit.json`

Un seul fichier décrit le montage d'une prise (source de vérité). Claude, le studio et le rendu le lisent et l'écrivent.
Le moteur est Hyperframes (le même que les Reels 100 % IA) ; le code est dans `src/domain/video/edit.ts`,
`animations.ts` et `edit-composition.ts`.

## Règle d'or
**Tous les temps sont en millisecondes de la prise d'origine**, jamais du temps monté. Recouper un silence ne décale
aucune animation : chaque instant est ancré sur un mot prononcé du transcript.

## Exemple
```json
{
  "video": "prise.mp4",
  "captions": "prise.json",
  "accent": "violet",
  "ranges": [{ "fromMs": 0, "toMs": 4200 }, { "fromMs": 5100, "toMs": 12800 }],
  "custom": [
    { "name": "titre", "fromMs": 300, "toMs": 2800, "props": { "texte": "Une recommandation, ça vaut combien ?" } },
    { "name": "mot-cle", "fromMs": 10200, "toMs": 12700, "props": { "mot": "CLUB" } }
  ],
  "sounds": [{ "file": "pop.mp3", "atMs": 300, "volume": 0.6 }]
}
```

## Clés
| Clé | Rôle | Défaut |
|---|---|---|
| `video` | prise, à côté du fichier (nom simple : lettres, chiffres, `. _ -`) | obligatoire |
| `captions` | transcript mot à mot `[{ "text", "startMs", "endMs" }]` | aucun |
| `accent` | `violet` ou `vert` (un seul accent par vidéo, `STYLE.md`) | `violet` |
| `ranges[]` | morceaux **gardés**, triés, sans chevauchement (coupes sèches entre eux) | obligatoire |
| `subtitles` | sous-titres karaoké (4 mots / 26 caractères par page) | `true` |
| `voiceGain` | gain de la voix (1 = inchangé, 3,98 max) | `1` |
| `custom[]` | animations `{ name, fromMs, toMs, props, label? }` (registre ci-dessous) | `[]` |
| `sounds[]` | bruitages `{ file, atMs, volume?, durationMs? }` | `[]` |

Toute clé inconnue est une erreur. Les messages sont en français :
`• ranges[1] → chevauche ou précède le morceau précédent…`.

## Animations (`custom[].name`)
Catalogue à jour : `npm run video -- animations` (descriptions, durées conseillées, exemples).

| Nom | Réglages (`props`) | Usage |
|---|---|---|
| `titre` | `texte` (≤ 80), `detail?` (≤ 120) | accroche, changement d'idée |
| `mot-cle` | `mot` (majuscules, sans espace) | CTA « commente MOT → DM » |
| `chiffre` | `valeur`, `decimales?`, `avant?`, `apres?`, `legende` | preuve chiffrée **dite** dans la vidéo |
| `liste` | `titre?`, `items` (2 à 4) | étapes, bénéfices énoncés |
| `barre` | `texte`, `remplacement?` | contraste « pas X, mais Y » |
| `logo-fin` | `texte?` | plein écran bleu + logo officiel, dernières secondes |

Une animation inconnue ou mal réglée n'arrête jamais la vidéo : un bandeau rouge la remplace à l'aperçu.

### Créer une animation (`/nouvelle-animation`)
- **Kit** : `src/domain/video/animations.ts` (animations officielles BeeRecos). **Maison** :
  `src/domain/video/mes-animations/<nom>.ts`, enregistrée dans `mes-animations/registre.ts` ; à nom égal, la maison gagne.
- Boîte à outils `src/domain/video/fx.ts` : zones de sécurité (`SAFE`, `SAFE_BLOCK`), `blurIn`, `fadeIn`, `slideIn`,
  `fadeOut`, `strikeThrough`, `countUp` (compteur déterministe), `formatNumber`, `escapeHtml`.
- Une définition = `label`, `description`, `lengthMs`, `props` (zod strict), `example`, `css` (règles préfixées
  `.anim-<nom>`), `render(ctx, props) → { html, tweens }` (ids préfixés par `ctx.id`, tweens sur ses seuls éléments).
- `npm run video -- animation-check [nom]` contrôle tout cela ; `npm run video -- animation-preview <nom>` montre
  l'animation seule (entrée, milieu, sortie) ; le test `tests/unit/skills.test.ts` contrôle tout le catalogue.

## Page Montage en ligne (`/montage`)
Le même format, depuis le site, sans terminal. Code : `src/server/montages/`, `src/components/montage/`,
table `montages` (`supabase/migrations/20261021000000_montages.sql`, RLS : lecture membres, écriture admin /
responsable contenu).

1. **Envoi** : le navigateur lit la durée et mesure les îlots de parole (Web Audio), puis envoie la prise
   **directement** au bucket privé `montages` par URL d'envoi signée (500 Mo, 10 min max).
2. **Transcription** : ElevenLabs Scribe (`scribe_v1`, français, mot à mot) télécharge la prise par URL signée
   d'une heure ; le transcript est recalé sur les îlots mesurés à l'envoi.
3. **Coupe** : le plan numéroté de `autocut`, suggestions cochées ; « Appliquer » écrit `ranges`, l'ancien montage
   est gardé (« Annuler la dernière coupe »).
4. **Aperçu** : lecteur Hyperframes en direct (`/api/montages/<id>/composition`, prise lue par URL signée).
5. **À venir** : lot 2 (Claude et animations depuis la page), lot 3 (rendu MP4 HeyGen, publication).

Mise en service : appliquer la migration Supabase, puis dans Vercel `ELEVENLABS_API_KEY` (transcription) ;
`SUPABASE_SECRET_KEY` est déjà requise (URL signées). En mode démo, la page s'affiche mais l'envoi est désactivé.

## Pipeline (tout tourne sur le poste)
```bash
npm run video -- new projets/mon-reel/prise.mp4            # crée prise.edit.json (toute la prise)
npm run video -- transcribe projets/mon-reel/prise.edit.json   # transcript mot à mot (whisper.cpp local, français)
npm run video -- autocut projets/mon-reel/prise.edit.json      # MONTRE le plan de coupe numéroté, n'écrit rien
npm run video -- autocut projets/mon-reel/prise.edit.json --apply --drop=2,5-6   # applique (sauvegarde .bak-cuts)
npm run video -- validate projets/mon-reel/prise.edit.json
npm run video -- preview projets/mon-reel/prise.edit.json 3200,9800   # PNG aux instants (ms de la prise)
npm run video -- render projets/mon-reel/prise.edit.json             # MP4 dans export/, puis contrôle qualité
```

- **Transcription** : `hyperframes transcribe` (modèle multilingue `small`, `--language fr` forcé ; `--model=medium`
  pour un son difficile), puis **recalage sur l'énergie audio** : îlots de parole (fenêtres de 20 ms, seuil =
  bruit du 15e centile + 6 dB) ; les mots placés dans un silence sont ramenés dans la parole réellement entendue.
- **Coupe** : phrases numérotées (ponctuation ou pause > 700 ms). Suggestions : *reprise* (phrase très proche de
  l'une des deux suivantes, Jaccard ≥ 0,55 : on garde la dernière version) et *faux départ* (≤ 3 mots qui
  commencent la phrase suivante). Les hésitations (« euh », « ben »…) sont toujours retirées ; un silence de plus
  de 350 ms entre deux mots est coupé, avec 70 ms de marge avant et 110 ms après. `--drop=` vide : ne retire
  aucune phrase. Montrer le plan, obtenir l'accord, puis appliquer.
- **Sous-titres** : nouvelle page à chaque raccord et à chaque fin de phrase.
- **Aperçu** : toujours ouvrir la planche `snapshots/contact-sheet.jpg` avant de dire que c'est bon.
- **Rendu** : `hyperframes check` puis rendu `delivery`, puis `qa-reel.sh` (format, audio, volume, zones Instagram).

## Règles (pour Claude, dans toutes les commandes de montage)
Commandes : `/nouvelle-video` → `/transcrire` → `/couper` → `/titre`, `/mot-cle`, `/animation` → `/exporter`
(`.claude/skills/`) ; `/nouvelle-animation` pour créer une animation.
1. Ne jamais toucher `video`, `captions`, `ranges` sans demande explicite (seul `/couper` écrit `ranges`).
2. Jamais deux animations visibles en même temps (≥ 1 s d'écart, une idée = une animation).
3. Valider après chaque modification (`npm run video -- validate`) ; aperçu PNG **ouvert et décrit** avant de dire
   « c'est fait » ; pas de rendu « pour voir ».
4. Temps ancrés sur un mot prononcé du transcript, et toujours redire la phrase retenue.
5. **Montrer avant d'écrire** ce qui est destructif ou subjectif (coupes, style, publication).
6. **Rien d'inventé** : pas de chiffre, nom ou promesse absent du transcript ou du brief ; marque : **BeeRecos**.
7. Écrire dans les données (edit.json), pas dans le code, sauf pour créer une animation.
8. Une question à la fois, toujours avec une valeur par défaut.
9. Jamais de secret dans un fichier ou dans le chat ; publication jamais sans OK explicite.

## Autres commandes
```bash
npm run video:build -- projets/mon-reel/prise.edit.json      # écrit seulement index.html (composition Hyperframes)
cd projets/mon-reel && npx hyperframes@0.8.126 preview       # aperçu interactif dans le navigateur
```

## Découper une longue session de tournage (`split`)
Un seul fichier qui enchaîne plusieurs Reels (ex. 80 Go, 72 Reels) ne passe ni par la page Montage (500 Mo par prise,
10 min au total) ni par un éditeur en ligne. On le découpe **sur le poste**, en deux temps :
```bash
npm run video -- split rush/session.mov --expected=72      # 1. lit SEULEMENT l'audio, propose les coupes (rien n'est coupé)
#    → rush/session.decoupe.json : relire, donner un titre, fusionner ou supprimer un morceau
npm run video -- split rush/session.mov --apply --web      # 2. un fichier par Reel dans rush/session-reels/
```
- Coupes posées dans les **pauses de la voix** (`--gap=1.5` s de silence au moins, seuil `--noise=-35` dB) ;
  avec `--expected`, les N − 1 pauses les plus longues, jamais un morceau de moins de 8 s ; marge de 0,4 s à chaque coupe.
- Conseil de tournage : marquer un **silence de 3 s** (ou un clap) entre deux Reels rend la découpe quasi sûre.
- Sans `--web` : copie sans réencodage (rapide, qualité d'origine, début calé sur l'image clé précédente).
  Avec `--web` : H.264 1080 px, coupe exacte, fichiers légers à envoyer dans la page Montage.
- Une relance de `--apply` saute les Reels déjà coupés ; le plan relu n'est jamais écrasé.
- Ensuite, chaque Reel suit le circuit habituel (page Montage, ou `new` → `transcribe` → `autocut` → …).

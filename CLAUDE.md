# BeeMarketing — système commercial Instagram de BeeRecos

Application Next.js 16 + Supabase + agent eve (voir `PLAN.md`, `docs/`). Toujours écrire **BeeRecos**
(B et R majuscules). Node 24. Avant de coder : lire la doc embarquée (`node_modules/next/dist/docs/`,
`node_modules/eve/docs/`) — ces versions diffèrent des connaissances d'entraînement.

Vérifications obligatoires avant de livrer : `npm run lint`, `npm run typecheck`, `npm test`
(+ `npm run test:e2e` si l'UI change). Chaque nouvelle table : RLS + tests dans `tests/rls/`.

Skills métier : `agent/skills/beerecos-*` (liés dans `.claude/skills/`).

La chaîne vidéo historique ci-dessous (motion design, rushs) reste disponible.

## Point d'entrée
Pour toute demande de montage, de Reel, de storyboard, de sous-titres ou de motion :
charge le skill **`motion-design-reel`**. Il orchestre les autres skills et impose les
trois portes de validation (coupes → storyboard → planche contact) avant tout rendu.

Pour une vidéo **100 % IA** (sans tournage), sa **publication** ou un **call to action
« commente MOT → DM »** : charge le skill **`reel-ia-autopilot`**. Publier est public et
irréversible : jamais sans OK explicite, sauf `autopilote: oui` dans `content/autopilote.md`.

## Organisation
- `rush/` — vidéos brutes (hors git). Sorties de travail Video-Use dans `rush/edit/`.
- `briefs/` — une fiche brief par vidéo (`AAAA-MM-JJ-sujet.md`).
- `assets/sfx/` — effets sonores (Pixabay).
- `export/` — rendus finaux (hors git).
- `STYLE.md` — phrase de style du compte, à lire avant chaque projet.
- `content/` — idées de Reels, ressources offertes en DM, réglages autopilote, journal.
- `projets/` — un dossier par Reel IA (script, storyboard, voix, composition Hyperframes).
- `automation/` — CLI `ig.mjs` (publication, campagnes CTA, jeton), `voice.mjs` (voix IA) et `render-reel.mjs`
  (`npm run reel:render -- <reel.html>` : rendu MP4 Hyperframes d'un Reel téléchargé depuis le Studio vidéo).
- `src/domain/video/reel.ts` — modèle de Reel motion design BeeRecos (données IA → composition Hyperframes).
- `api/instagram-webhook.mjs` — webhook Vercel qui envoie les DM sur mot-clé.
- `supabase/migrations/` — tables des campagnes CTA + bucket des vidéos.
- Configuration Instagram / Meta / Supabase / Vercel : `docs/SETUP-INSTAGRAM.md`.
- Tests : `npm test`.

## Skills installés (`.claude/skills/`)
- `reel-ia-autopilot` — vidéo 100 % IA → publication → CTA en DM.
- `motion-design-reel` — méthode, repères, prompts, scripts QA (spécifique à ce dépôt).
- `hyperframes`, `hyperframes-*`, `embedded-captions`, `talking-head-recut`,
  `motion-graphics`, `media-use`, etc. — skills officiels heygen-com/hyperframes (Apache-2.0).
- `video-use` — coupes, transcription, sous-titres (browser-use/video-use, MIT).
  Nécessite `ELEVENLABS_API_KEY` (variable d'environnement ou `.claude/skills/video-use/.env`,
  jamais commité).

## Règles
- Monte d'abord, anime ensuite. Rien n'est construit sans storyboard validé.
- Jamais de rendu final sans OK explicite sur la planche contact / preview.
- Avant publication : `bash .claude/skills/motion-design-reel/scripts/qa-reel.sh export/<fichier>.mp4`.
- Mise à jour des skills tiers : voir `.claude/skills/README.md`.

# InstagramBeerecos — montage motion design avec Claude

Ce dépôt sert à transformer des rushs verticaux en Reels montés en motion design
(méthode du guide OPUS : Claude Code + Hyperframes + Video-Use).

## Point d'entrée
Pour toute demande de montage, de Reel, de storyboard, de sous-titres ou de motion :
charge le skill **`motion-design-reel`**. Il orchestre les autres skills et impose les
trois portes de validation (coupes → storyboard → planche contact) avant tout rendu.

## Organisation
- `rush/` — vidéos brutes (hors git). Sorties de travail Video-Use dans `rush/edit/`.
- `briefs/` — une fiche brief par vidéo (`AAAA-MM-JJ-sujet.md`).
- `assets/sfx/` — effets sonores (Pixabay).
- `export/` — rendus finaux (hors git).
- `STYLE.md` — phrase de style du compte, à lire avant chaque projet.

## Skills installés (`.claude/skills/`)
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

# Pixel Agents (code tiers, MIT)

Copie du moteur de bureau pixel art de [pixel-agents-hq/pixel-agents](https://github.com/pixel-agents-hq/pixel-agents)
(`webview-ui/src/office` sans l'éditeur, `constants.ts`, `components/ui/types.ts`, `core/src/paletteUtils.ts`).
Licence : `LICENSE` (MIT, © 2026 Pablo De Lucca). Personnages inspirés de JIK-A-4 « Metro City » (voir le dépôt d'origine).

Non repris : extension VS Code, serveur Fastify, installation de hooks dans `~/.claude/settings.json`, terminaux.
BeeMarketing alimente le moteur avec l'état réel des tâches (`src/components/ruche/hive-office.tsx`).

Sprites pré-décodés dans `public/pixel-agents/` (générés une fois avec `core/src/assets/loader.ts` du dépôt d'origine).
Modifications locales : chemin d'import de `paletteUtils`, suffixes `.js` retirés des imports relatifs (Turbopack). Ne pas modifier ce dossier pour du code métier.

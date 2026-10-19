# BeeSocial AI

Le système commercial Instagram de **BeeRecos** :
contenu → engagement → commentaire → DM → qualification → invitation club → visite → suivi → adhésion.

KPI final : **visites de clubs** générées par Instagram, puis **adhésions**.
Philosophie : IA puissante + contrôle humain + contenu authentique + acquisition mesurable.

## Démarrer

Prérequis : Node.js 24, npm.

```bash
npm install
cp .env.example .env.local      # remplir au moins Supabase (ou BEESOCIAL_DEMO_MODE=1 pour une démo vide)
npm run dev                      # http://localhost:3000
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | Application Next.js |
| `npm run lint` | ESLint (config Next.js) |
| `npm run typecheck` | Types de routes Next.js + TypeScript strict |
| `npm test` | Vitest (unitaires, composants, **RLS sur Postgres PGlite**) + tests historiques `automation/` |
| `npm run test:e2e` | Playwright (desktop + mobile), en mode démo, sans appel externe |
| `npm run check` | lint + typecheck + tests |

## Où trouver quoi

- Plan et avancement : [`PLAN.md`](PLAN.md)
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Agents : [`docs/AGENTS.md`](docs/AGENTS.md) · Skills : [`docs/SKILLS.md`](docs/SKILLS.md)
- Fournisseurs : [`docs/PROVIDERS.md`](docs/PROVIDERS.md) · Base de données : [`docs/DATABASE.md`](docs/DATABASE.md)
- Tunnel Instagram : [`docs/INSTAGRAM_FUNNEL.md`](docs/INSTAGRAM_FUNNEL.md) · Vidéo : [`docs/VIDEO_PIPELINE.md`](docs/VIDEO_PIPELINE.md)
- Sécurité & RGPD : [`docs/SECURITY.md`](docs/SECURITY.md) · Déploiement et **actions Cédric** : [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- Chaîne vidéo historique (skills Hyperframes, scripts QA, CLI Instagram) : `CLAUDE.md`, `docs/SETUP-INSTAGRAM.md`

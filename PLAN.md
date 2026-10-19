# BeeMarketing — Plan d'architecture et d'exécution

Système commercial Instagram de BeeRecos :
**contenu → engagement → commentaire → DM → qualification → invitation club → visite → suivi → adhésion.**
KPI final : visites de clubs puis adhésions générées par Instagram.

Philosophie : IA puissante + contrôle humain + contenu authentique + acquisition mesurable.

---

## Phase 0 — Audit du dépôt (fait le 19/10/2026)

| Élément existant | Décision |
|---|---|
| `.claude/skills/hyperframes*`, `video-use`, `embedded-captions`, `media-use`… (skills officiels, Apache-2.0 / MIT) | **Conservés.** Moteur de motion design et de montage pour le Video Director. |
| `.claude/skills/motion-design-reel`, `reel-ia-autopilot` (méthode OPUS, scripts QA FFmpeg) | **Conservés.** Réutilisés par `beerecos-studio-editor`, `beerecos-hybrid-video` et le quality gate. |
| `automation/lib/*.mjs` (client Graph API Instagram, Supabase REST, logique CTA, webhook signé) + 11 tests | **Conservés.** Deviendront l'adapter `MetaInstagramProvider` / `MetaMessagingProvider` (phases 4–5). Le webhook est servi par `src/app/api/webhooks/instagram/route.ts`. |
| `automation/bin/ig.mjs`, `voice.mjs` (CLI) | **Conservés** comme outils d'opérateur. |
| `supabase/migrations/20261019000000_cta.sql` (cta_campaigns, cta_replies) | **Conservé** ; remplacé en phase 5 par `cta_keywords` / `dm_threads` (migration de données prévue). |
| Pas d'application web, pas de framework | **Création** d'une application Next.js à la racine. |

Gestionnaire de paquets : **npm** (déjà utilisé). Runtime : **Node 24** (exigé par eve).

---

## Stack retenue (versions vérifiées le 19/10/2026)

| Couche | Choix | Version | Pourquoi |
|---|---|---|---|
| Web | Next.js App Router, React, TypeScript strict | 16.4.2 / 19.3 / 5.x | Standard Vercel ; `cacheComponents` + `proxy.ts` (ex-middleware) selon la doc embarquée `node_modules/next/dist/docs`. TypeScript 5 (celui que génère `create-next-app` 16.4). |
| UI | Tailwind CSS v4 (tokens CSS), lucide-react, design system maison `src/components/ui` | 4.3 | Pas de kit SaaS générique ; composants propres à BeeMarketing. |
| Backend | Supabase : Postgres + RLS, Auth (lien magique), Storage, Realtime, pgvector (phase 3) | supabase-js 2.118, @supabase/ssr 0.12 | Backend principal demandé ; clés *publishable* côté client, *secret/service* côté serveur uniquement. |
| Agents | **eve** (Vercel, preview) monté dans Next.js via `withEve` (`/eve/v1/*`) | 0.80.1 | Sessions durables, tools typés avec politiques d'approbation (`always()`), skills `SKILL.md`, subagents, schedules, evals, client React `useEveAgent`. Documentation lue dans le paquet installé. |
| Traitements longs | **Vercel Workflow** (`workflow`) — runtime déjà utilisé par eve | 5.2.2 | Génération vidéo, rendu, transcription, publication programmée, attente webhook, relances, idempotence. |
| Modèle | Claude via AI Gateway (`anthropic/claude-…`) ou clé Anthropic directe | — | Choix dans `agent/agent.ts`, modifiable sans toucher au métier. |
| Montage | FFmpeg (déterministe) + Hyperframes (motion HTML → MP4) | — | Rendu reproductible ; exécuté dans le sandbox eve / worker, jamais dans une fonction web courte. |
| Tests | Vitest (unitaires, intégration, adapters), PGlite (tests RLS sur Postgres réel en WASM), Playwright (E2E), evals eve | — | Aucun appel réel à Instagram ou API payante en test. |

Choix structurants :
- **Un seul dépôt, une seule app Next.js**, un agent eve racine `agent/` (BEE MARKETING ORCHESTRATOR) avec 4 subagents déclarés (Content Director, Video Director, Sales Concierge, Growth Analyst). Pas d'agent quand une fonction déterministe suffit (matching, scoring, quality gate = code testé, appelé comme tool).
- **Validation humaine garantie côté backend** : table `approval_requests` + politiques d'approbation des tools eve (`always()` sur publication, DM sensible, invitation, budget, Autopilot). L'UI ne fait qu'afficher.
- **Adapters partout** : le métier ne connaît que des interfaces (`src/providers/types.ts`).
- **Capability matrix** par provider, découverte dynamique quand le fournisseur le permet.
- **Intégrations directes, sans abonnement tiers** (décision du 19/10/2026) : API officielle Instagram (Meta) pour publier, lire les statistiques et répondre aux commentaires par DM ; API officielle LinkedIn pour publier sur le profil de Cédric et la page BeeRecos. Metricool et ManyChat ne sont plus prévus (adapters possibles plus tard grâce aux interfaces).
- **Programmation** : ni Instagram ni LinkedIn ne programment côté API ; `PUBLISHING_WORKFLOW` (Vercel Workflow) publie à l'heure prévue, avec idempotence et statut confirmé par le réseau.

## Arborescence cible

```
agent/                      # eve : orchestrateur
  agent.ts                  # modèle, compaction (phase 2)
  instructions.md           # rôle de l'orchestrateur, règles absolues
  skills/beerecos-*/        # 14 Agent Skills (SKILL.md + references/) — liés dans .claude/skills/
  tools/                    # tools typés (zod in/out, erreurs typées, approval, idempotency)
  subagents/{content-director,video-director,sales-concierge,growth-analyst}/
  channels/eve.ts           # auth : session Supabase obligatoire
  schedules/                # sync analytics, optimisation hebdo
src/
  app/(app)/…               # Accueil, Créer, Studio, Médias, Calendrier, Conversations, Leads, Clubs, Analytics, Stratégie IA, Réglages, Système
  app/login, app/auth/…     # Supabase Auth (lien magique)
  app/api/webhooks/…        # Instagram (signature + timestamp + anti-rejeu + idempotence)
  components/ui/            # design system
  components/shell/         # navigation, barre « Demander à BeeMarketing »
  domain/                   # types et règles métier pures (statuts, rôles, scoring, matching…)
  providers/                # interfaces + adapters (Meta Instagram, LinkedIn, Veo, Runway, Anthropic…)
  server/                   # DAL, services, workflows (Vercel Workflow), audit, budgets
  lib/                      # env (zod), supabase, marque
supabase/migrations/        # schéma versionné, RLS sur toutes les tables
tests/{unit,rls,e2e}/
evals/                      # evals eve (cas A→G)
docs/                       # ARCHITECTURE, AGENTS, SKILLS, PROVIDERS, DATABASE, INSTAGRAM_FUNNEL, VIDEO_PIPELINE, SECURITY, DEPLOYMENT
```

## Modèle de données (répartition par phase)

| Phase | Tables |
|---|---|
| 1 | organizations, profiles, roles, memberships, organization_settings, provider_connections, audit_logs |
| 2 | content_ideas, content_items, scripts, storyboards, campaigns, prompt_versions, media_assets (métadonnées) |
| 3 | transcripts, transcript_segments (pgvector), video_jobs, video_renders |
| 4 | social_accounts, publication_jobs, published_posts, post_metrics, approval_requests |
| 5 | cta_keywords, dm_threads, dm_messages, leads, lead_events, lead_scores, consents |
| 6 | clubs, club_meetings, club_professions, invitations, attendance, conversions |
| 7 | vues d'attribution (content → post → commentaire → DM → lead → invitation → visite → adhésion), budgets, cost_entries |
| 8 | agent_runs, tool_runs (observabilité complète), rétention RGPD automatisée |

Détail et politiques RLS : `docs/DATABASE.md`.

## Évolution — équipe marketing IA (19/10/2026)

BeeMarketing devient le *Marketing Operating System* de BeeRecos : Queen Bee + 10 agents spécialisés, missions
en graphe de tâches, fil d'activité réel, boîte de validation, mémoire de marque. Détail : `docs/AGENTS.md`.

| MVP | Contenu | Statut |
|---|---|---|
| 1 | Accueil, Queen Bee, Missions, Équipe IA, workflow de tâches, fil d'activité, mémoire de marque, Content Studio, calendrier (propositions), validations | ✅ (agents actifs dès la clé Claude) |
| 1+ | **Watchdog** (chien de garde) : surveillance, réparations sûres, pause anti-boucle, page `/watchdog`, cron | ✅ |
| 1+ | **La Ruche** : bureau pixel art (moteur Pixel Agents, MIT) animé par l'état réel des agents | ✅ |
| 2 | Video Studio (import, transcription, moteurs vidéo), bibliothèque média, intégration Instagram/LinkedIn, analytics, génération de leads | à faire |
| 3 | Autopilot, publication multi-plateforme, optimisation de campagnes, analytics avancés, automatisation CRM | à faire |

## Plan d'exécution

| Phase | Contenu | Statut |
|---|---|---|
| 0 | Audit, architecture, PLAN.md, structure des 14 Agent Skills | ✅ |
| 1 | Next.js, design system, Supabase (schéma fondation + RLS + Auth), layout, navigation, réglages intégrations, validation env | ✅ (voir résumé) |
| 2 | Moteur éditorial : stratégie (pondérations), idées, scripts, bibliothèque, calendrier drag & drop, agent eve + premiers tools, barre « Demander à BeeMarketing » branchée | ⏭ suivante |
| 3 | Studio vidéo : upload, transcription, détection de clips, génération IA (Veo/Runway), hybride, rendu FFmpeg, recherche sémantique | |
| 4 | Publication : adapters Instagram et LinkedIn directs, programmation par workflow, approvals, statistiques des deux réseaux, déclinaison d'un contenu par réseau | |
| 5 | Ventes Instagram : commentaires → DM (API Meta directe, webhook signé), leads, qualification, inbox, handoff | |
| 6 | Clubs : clubs, réunions, matching, invitations, rappels, suivi post-visite, **page d'invitation publique** (CTA LinkedIn et lien en bio Instagram) | |
| 7 | Croissance : attribution, dashboard business, insights avec seuils statistiques | |
| 8 | Durcissement : sécurité, evals A→G, E2E complets, performance, page Système | |

Après chaque phase : `npm run lint`, `npm run typecheck`, `npm test`, corrections, résumé court.

## ACTIONS CÉDRIC (centralisées)

Les actions externes nécessaires sont listées et tenues à jour dans `docs/DEPLOYMENT.md` → section « Actions Cédric ».

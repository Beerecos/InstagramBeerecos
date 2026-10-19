# Architecture

```
Navigateur (Next.js App Router, design system BeeMarketing)
   │  cookies de session Supabase (same-origin)
   ▼
Next.js sur Vercel ──────────────┬─────────────────────────────────────────┐
  proxy.ts : refresh session,    │ /eve/v1/*  (phase 2) agent eve          │
  redirection /login             │   BEE MARKETING ORCHESTRATOR + 4 subagents │
  Server Components / Actions    │   tools typés (zod, approval, idempot.) │
  DAL (src/server/auth/dal.ts)   │   skills agent/skills/beerecos-*        │
  Route handlers /api/webhooks/* │   schedules, evals                      │
                                 └──────────────┬──────────────────────────┘
                                                │ Vercel Workflow (durable)
                                                ▼
             Supabase (Postgres + RLS, Auth, Storage, Realtime, pgvector)
                                                │
             Providers (adapters) : Anthropic/AI Gateway · Veo · Runway · Meta Instagram (direct) ·
             LinkedIn (direct) · Google Drive · FFmpeg/Hyperframes
```

## Identité

Nom du produit : **BeeMarketing**. Design system aligné sur la charte BeeRecos (bleu vibrant #2851FF, blanc, noir,
violet #693BFC, vert #3BCAC2, Poppins) : tokens dans `src/app/globals.css`, logo officiel dans `public/brand/`
(composant `src/components/shell/logo.tsx`), règles dans `agent/skills/beerecos-brand/references/charte-visuelle.md`.

## Principes

1. **Couches** : `src/domain` (règles pures, testables) → `src/server` (DAL, services, workflows) → `src/app` (UI).
   Les composants n'accèdent jamais directement à un fournisseur ni à la clé secrète Supabase.
2. **Adapters** : interfaces dans `src/providers/types.ts`, capability matrix par fournisseur, erreurs typées
   (`ProviderError`, `retryable`). Voir `PROVIDERS.md`.
3. **Contrôle humain garanti côté serveur** : RLS + triggers (ex. seul un admin change le mode d'autonomie, audité),
   puis `approval_requests` et politiques `always()` des tools eve. L'interface ne fait qu'afficher.
4. **Cache Components** (Next 16) : la coquille de chaque page est pré-rendue ; tout ce qui lit la session est
   diffusé derrière `<Suspense>`. Le DAL appelle `connection()` pour ne jamais figer une donnée utilisateur au build.
5. **Rien d'inventé** : une donnée absente s'affiche « — » (non disponible), jamais une valeur fictive.
6. **Mode démo** : `BEEMARKETING_DEMO_MODE=1` uniquement si Supabase n'est pas configuré (refusé sinon au démarrage).

## Arborescence

Voir `PLAN.md` § Arborescence cible.

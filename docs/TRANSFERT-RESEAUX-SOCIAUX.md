---
brand: BeeRecos
campaign:
agent: développement
created_at: 2026-11-02
updated_at: 2026-11-02
version: 1
status: review
objective: Porter la partie réseaux sociaux de BeeMarketing (bee-marketing-agent, Vite) dans InstagramBeerecos (Next.js 16)
audience: Cédric Picard
owner: Cédric Picard
approved_by:
source_files: bee-marketing-agent@6ab3914 (main)
---

# Transfert de la partie réseaux sociaux : BeeMarketing → InstagramBeerecos

Décision de Cédric (2026-11-02) : **copier, puis adapter à Next.js**. BeeMarketing reste intact tant que
le portage n'est pas vérifié. Branche cible : `claude/motion-design-skills`.

Source : `bee-marketing-agent` au commit `6ab3914` (`main`).

## Périmètre inventorié

| Bloc | Source (bee-marketing-agent) | Volume |
|---|---|---|
| Moteur montage | `src/lib/montage/` | ~5 000 lignes + tests |
| Moteur Reel (story, motion, voix, sons) | `src/lib/reel-story/` | ~3 500 lignes + tests |
| Modules sociaux purs | `src/lib/{carousel,social-*,studio-*,media-resolver,editorial-calendar}.ts` | ~1 500 lignes |
| Clients API | `src/lib/{editorial-api,montage-api,studio-assets-api,reel-render-client,reel-render-online}.ts`, `editorial-draft.ts`, `social-hub.ts` | ~800 lignes |
| Interface | `src/components/social/` (42 fichiers : Studio, Reels, Carrousels, Pilotage Instagram, Montage), page `SocialHub` (`/publication`) | ~5 700 lignes |
| Fonctions Supabase | `social`, `publish`, `meta-webhook`, `reel-automation`, `montage`, `studio-render`, `studio-voice`, `editorial-generate`, `collect-post-metrics`, `analyze-posts`, `content-templates`, `instagram-oauth`, `linkedin-oauth` + `_shared/` | ~3 900 lignes |
| Rendu serveur | `server/reel-render*.ts` | — |
| Migrations | `bee_post_metrics`, `social_*` (automatisation, conversations, commentaires, mémoire de gabarits, gabarits visuels, publications), `reel_*`, `montages*`, `studio_*` | 18 fichiers |

## Phases

| Phase | Contenu | Statut |
|---|---|---|
| 1 | Moteur métier pur → `src/domain/social/` ; tests → `tests/unit/social/` ; fixtures `content/reels-72/` ; assets manquants de `public/hyperframes/` | ✅ 41 fichiers de test, 354 tests verts (identique à la source) |
| 2 | Schéma : migrations `social_*`, `montages*`, `studio_*`, `reel_*` adaptées au modèle `organizations` / `memberships` d'InstagramBeerecos, RLS + tests `tests/rls/` | 🟡 attend la décision ci-dessous |
| 3 | Serveur : Edge Functions → routes `src/app/api/social/*` et server actions (auth via `src/server/auth/dal.ts`), webhook Meta fusionné avec `api/webhooks/instagram` | |
| 4 | Clients API → appels server actions / `fetch` relatif ; rendu Reel (`reel-render-*`) | |
| 5 | Interface : `src/components/social/` → composants client Next.js (`react-router-dom` → `next/navigation`), pages `/studio`, `/video`, `/calendar` existantes branchées | |
| 6 | Vérifications complètes (lint, typecheck, tests, e2e), puis décision de retrait côté BeeMarketing | |

## Adaptations faites en phase 1

- Imports relatifs sans extension `.ts` (InstagramBeerecos n'active pas `allowImportingTsExtensions`) ; tests importés via `@/domain/social/…`.
- `specFingerprint` (fonction pure de `reel-render-client.ts`) isolée dans `src/domain/social/spec-fingerprint.ts` ; le reste du client sera porté en phase 4.
- 6 lignes `any` héritées : désactivation ESLint ligne par ligne, code inchangé.
- Chemins des fixtures de test : `beerecos-knowledge/reels-72/` → `content/reels-72/`.

## Points ouverts

1. **DÉCISION NÉCESSAIRE — base Supabase.** Les tables sociales de BeeMarketing utilisent `workspace_id` et
   `user_roles` ; InstagramBeerecos utilise `organizations` / `memberships`. Les deux applications
   partagent-elles le même projet Supabase (on réutilise les tables existantes) ou InstagramBeerecos a-t-il
   sa propre base (on recrée les tables et on migre les données) ?
2. Doublon à résoudre : `src/domain/video/reel.ts` (InstagramBeerecos) et `src/domain/social/reel-story/`
   (BeeMarketing) couvrent le même besoin. À fusionner en phase 5, pas avant.
3. La copie `supabase/functions/_shared/montage` de BeeMarketing est générée (`npm run montage:sync`) ; elle
   ne sera pas portée : les routes Next.js importeront directement `src/domain/social/montage`.

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
| 2 | Schéma : **aucune migration** — base BeeMarketing partagée (décision du 2026-11-02), tables sociales réutilisées telles quelles | ✅ décidé |
| 3 | Serveur : les 13 Edge Functions sociales restent celles déjà déployées sur le projet BeeMarketing (une seule implémentation qui écrit dans les tables) ; InstagramBeerecos les appelle avec le jeton de session | ✅ |
| 4 | Clients API → `src/lib/social/` (`NEXT_PUBLIC_BEE_API_URL`, jeton via `@supabase/ssr`), sous-ensemble social de `api.ts`, rendu Reel en ligne ; tests → `tests/unit/social/lib/` | ✅ 28 tests de plus, suite complète 450 verts |
| 4 bis | Connexion : `src/server/auth/dal.ts` lit `profiles` / `memberships`, absents de la base BeeMarketing → lire `bee_user_profiles` / `user_roles` → lecture serveur de `user_roles` / `organizations` (RLS fermée côté session) ; SUPER_ADMIN ou DIRECTION = admin, sinon lecteur (un seul utilisateur : Cédric, 2026-11-02) | ✅ |
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

   **Constat du 2026-11-02 (lecture seule via le connecteur Supabase) :**
   - InstagramBeerecos n'a **aucune base déployée** : ses tables (`missions`, `memberships`, `profiles`,
     `cta_campaigns`, `brand_memory`…) n'existent dans aucun des 6 projets Supabase du compte.
   - Le projet **BeeMarketing** (`wekbmkjvieagmghjanjb`) contient déjà toutes les tables sociales, avec des
     données réelles : 11 montages, 12 Reels, 6 gabarits visuels, 26 lignes de statistiques de posts, plus
     le CRM (791 contacts, 52 leads, clubs, réunions).
   - Plusieurs tables de fondation d'InstagramBeerecos portent le même nom que des tables de BeeMarketing
     avec un schéma différent (`organizations`, `roles`, `campaigns`, `approvals`, `audit_logs`) : appliquer
     telles quelles les migrations d'InstagramBeerecos sur la base BeeMarketing créerait des conflits.

   **Recommandation :** brancher InstagramBeerecos sur le projet BeeMarketing et réutiliser ses tables
   (sociales, CRM, clubs) sans les recréer ; adapter le code d'InstagramBeerecos au modèle
   `workspaces` / `user_roles` ; ne créer dans cette base que les tables propres à InstagramBeerecos
   (missions, mémoire de marque…), sous des noms qui n'entrent pas en collision. Raison : une seule source
   de vérité pour le parcours Instagram → lead → club → adhésion, et pas de données à migrer.
2. Doublon à résoudre : `src/domain/video/reel.ts` (InstagramBeerecos) et `src/domain/social/reel-story/`
   (BeeMarketing) couvrent le même besoin. À fusionner en phase 5, pas avant.
3. La copie `supabase/functions/_shared/montage` de BeeMarketing est générée (`npm run montage:sync`) ; elle
   ne sera pas portée : les routes Next.js importeront directement `src/domain/social/montage`.

## Adaptations faites en phase 4

- `VITE_*` → `NEXT_PUBLIC_*` (lues littéralement, seule forme injectée par Next.js).
- Rendu Reel : pas de mode « local » implicite en développement (le serveur de rendu same-origin de BeeMarketing,
  `server/reel-render.ts`, n'est pas porté) ; le local reste possible avec `NEXT_PUBLIC_REEL_RENDER_URL`.
- `specFingerprint` : une seule implémentation (`src/domain/social/spec-fingerprint.ts`), réexportée par le client.
- Non portés (restent dans BeeMarketing avec les Edge Functions) : tests d'endpoints qui simulent `supabase/functions/_shared`
  (`social-publications-endpoint`, `deliverables-endpoint`, `studio-transfer`), et `reel-render-local` (serveur de rendu local).

## Rôles (décision du 2026-11-02)

Seul utilisateur : Cédric (SUPER_ADMIN dans BeeMarketing). Règle retenue : `SUPER_ADMIN` ou `DIRECTION` → admin ;
tout autre rôle, ou aucun → lecteur. Sans `SUPABASE_SECRET_KEY` côté serveur : lecteur (jamais d'élévation par défaut).

## Points d'attention pour la mise en service

- `SUPABASE_SECRET_KEY` (InstagramBeerecos) doit être la clé du projet BeeMarketing, sinon accès en lecture seule.
- Les modules propres à InstagramBeerecos (missions, mémoire de marque, Watchdog) lisent des tables absentes de la base
  BeeMarketing : ils afficheront une erreur tant que ces tables ne sont pas créées (avec des noms sans collision, après accord).

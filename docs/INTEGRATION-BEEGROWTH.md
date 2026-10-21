# Intégration dans BeeGrowth (base partagée) : analyse et plan

Analyse faite le 21/10/2026, en lecture seule : base Supabase `wekbmkjvieagmghjanjb` (projet « BeeMarketing ») et dépôt
`Beerecos/bee-marketing-agent` (BEE — BeeRecos Executive Engine, commit `f9a0e58`). Rien n'a été modifié.

## 1. Constat

**BeeGrowth est déjà l'outil global** : CRM (791 contacts, 683 entreprises, 52 prospects), campagnes, réunions,
appels, objectifs, agents, et un **espace « Réseaux sociaux »** (Pilotage Instagram, Contenus, Calendrier éditorial,
À valider, Campagnes à partager, Automatisation, Reels IA, Carrousels, La Ruche, Comptes connectés). Plusieurs briques
de ce dépôt y ont déjà été portées (La Ruche, Reels IA avec Hyperframes 0.8.126, rendu local `server/reel-render.ts`).

| Sujet | BeeGrowth | Ce dépôt (Next.js) |
|---|---|---|
| Application | Vite + React, Supabase Edge Functions (Deno), Vercel | Next.js 16, Server Actions |
| Accès aux données | **RLS activée sans aucune policy** : seul le serveur (clé `service_role`) lit et écrit, après contrôle des rôles dans `_shared/permissions.ts` | RLS avec policies par organisation |
| Rôles | `roles` + `user_roles` (12 rôles : SUPER_ADMIN, DIRECTION, MARKETING, ANIMATOR, SALES, AMBASSADOR…) avec une portée (global, organisation, arbre de clubs, propriétaire) | `memberships` + `app_role` (5 rôles) |
| Périmètre | `organizations` (1 : Beerecos) → `workspaces` (43 clubs) | `organizations` seule |
| Connexion | Supabase Auth, domaines e-mail autorisés (`ALLOWED_EMAIL_DOMAINS`) | Supabase Auth |
| Instagram | `bee_connectors` (OAuth connecté), `social_publications`, `social_automation_rules` (mot-clé → action), `social_comments`, `social_conversations` (DM, reliées à `contacts` / `leads`), `meta-webhook`, `publish` | `cta_campaigns`, `cta_replies`, `api/instagram-webhook.mjs` |
| Reels | `reel_contents`, `reel_jobs`, `reel_automation_settings` (migration du 20/10, **pas encore appliquée** en base) | `src/domain/video/reel.ts` |
| Stockage | aucun bucket en base aujourd'hui (la migration Reels crée `reels` et `reels-public`) | `reels` (public), `montages` (privé) |

Conséquence : appliquer les migrations de ce dépôt dans cette base **casserait BeeGrowth** (tables `organizations`,
`campaigns`, `approvals`, `audit_logs` déjà prises avec une autre structure). La bonne solution n'est pas de fusionner
deux bases, mais d'**ajouter ce qui manque à BeeGrowth, à sa manière**.

## 2. Ce qui manque à BeeGrowth (et que ce dépôt apporte)

1. **Montage d'une prise filmée** (`edit.json`) : schéma strict en français, coupes en ms de la prise, transcription
   recalée, plan de coupe (reprises, faux départs, hésitations), sous-titres karaoké, registre d'animations BeeRecos
   (titre, mot-clé, chiffre, liste, barre, logo de fin), aperçu en direct. Code **sans dépendance** (TypeScript pur +
   zod) : `src/domain/video/{edit,pipeline,animations,fx,edit-composition,registry,montage}.ts`.
2. Les **skills de montage** (`/nouvelle-video` → `/exporter`) et leur test.

Tout le reste (CTA en DM, publication, missions, validations, Ruche) existe déjà dans BeeGrowth : on ne le duplique pas.

## 3. Solution retenue

Une seule application (BeeGrowth), une seule base, une seule connexion. Le montage devient une section de l'espace
**Réseaux sociaux → Montage**, à côté de « Reels IA ».

| Brique | Où dans BeeGrowth | Comment |
|---|---|---|
| Domaine montage | `src/lib/montage/` (+ copie Deno générée dans `supabase/functions/_shared/montage/`) | port des modules ci-dessus, même motif que `reel-story` et `npm run reel:sync` |
| Table | migration `…_montages.sql` | `montages` avec `workspace_id` (club) ; **RLS sans policy** comme le reste ; bucket privé `montages` |
| API | Edge Function `montage` | `requireUser` + rôles : écrire = SUPER_ADMIN, DIRECTION, MARKETING (portée club pour MARKETING) ; lire = mêmes rôles ; URL d'envoi et de lecture signées |
| Transcription | Edge Function `montage` | ElevenLabs Scribe par URL signée (`ELEVENLABS_API_KEY` en secret de fonction) ; recalage sur les îlots de parole mesurés dans le navigateur |
| Page | `src/pages/…` + entrée `nav-config.ts` | envoi, transcription, plan de coupe, aperçu `@hyperframes/player` (déjà installé) |
| Rendu MP4 | lot 3 | rendu HeyGen (0,10 $/min) ou serveur local existant `server/reel-render.ts` |
| Publication | existant | `reel_contents` (`source = 'studio'`, `studio_video_path`) → `publish` → `social_automation_rules` |
| Prospects | existant | un DM « CLUB » crée déjà `social_conversations` → `contacts` / `leads` |

Livraison en 3 lots, chacun en PR sur `Beerecos/bee-marketing-agent`, avec ses tests (vitest + vérification de
migration PGlite comme les scripts `test:db:*`) :
1. **Lot 1** : domaine, migration, Edge Function (envoi, transcription, coupe), page Montage avec aperçu.
2. **Lot 2** : animations depuis la page (catalogue, Claude qui propose titre / CTA / chiffres tirés du transcript).
3. **Lot 3** : rendu MP4 (HeyGen) et passage vers « Reels IA » / publication.

## 4. À décider / à faire

- **Accès en écriture** au dépôt `Beerecos/bee-marketing-agent` pour cette session (aujourd'hui : lecture seule).
- **Projet Supabase `BeeMarketingInstagram`** (`xjhfdkfxoxzcciolmurp`), créé le 21/10 et devenu inutile : à supprimer
  depuis le tableau de bord Supabase pour ne pas le payer.
- **Ce dépôt** (`InstagramBeerecos`) : reste la source et le banc d'essai des briques vidéo ; l'application Next.js
  n'a plus vocation à être déployée à part.
- Migration Reels du 20/10 (`reel_contents`…) : à appliquer avant le lot 3 (elle porte le passage vers la publication).

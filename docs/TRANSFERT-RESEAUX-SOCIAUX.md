---
brand: BeeRecos
campaign:
agent: développement
created_at: 2026-11-02
updated_at: 2026-11-02
version: 2
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

## Instagram BeeRecos — outil de préparation des réels (état du 2026-11-02, branche `claude/motion-design-skills`)

Décision de Cédric : Instagram BeeRecos devient l'outil principal de préparation des réels ; BeeMarketing reste la
référence et garde son studio jusqu'à vérification. Base Supabase et Edge Functions BeeMarketing partagées
(aucune migration appliquée, aucune écriture distante, aucun déploiement).

### Parcours et routes (Scripts → Studio → Bibliothèque → Calendrier)

| Route | Rôle |
|---|---|
| `/scripts/nouveau` · `/scripts/[id]` | **Éditeur de script** : blocs HOOK → LEAD → BODY 1 → (OPEN LOOP → BODY 2 → OPEN LOOP → BODY 3) → CTA, texte à dire et texte à l'écran, durée estimée (cible 35–60 s), contrôles (mot-clé prononcé, 7 mots à l'écran, aucun montant ni promesse, orthographe BeeRecos), proposition IA, prompteur ; brouillon sur l'appareil, enregistrement serveur (studio_assets « motion », révisions) → réel IA ou réel filmé |
| `/scripts` | Mes scripts ; les 72 scripts (prompteur, texte, validation) : « Envoyer la prise filmée » → réel filmé ; « Faire en réel IA » → scènes reprises mot pour mot ; nouveau script avec l'IA ; « J'ai déjà mes prises » |
| `/` | **Studio** (« Mes réels ») : projets, statut réel, prochaine action ; créer un réel filmé ou IA |
| `/reels/tournage` | Import des prises déjà tournées (un projet par fichier, associé à son script) ; plan de découpe d'un long rush |
| `/reels/[id]` | Studio d'un réel (`?panel=post` ouvre « Post et export ») |
| `/reels/nouveau/video` · `/reels/nouveau/ia` (`?script=V12`) | Création d'un réel filmé / IA |
| `/library` | **Bibliothèque** des réels terminés (MP4 rendu) → « Créer le post » ; médias du studio |
| `/calendar` | **Calendrier éditorial** partagé : posts ajoutés en brouillon depuis le post d'un réel |
| `/settings` | Capacités réelles du serveur, charte, préférences |
| `/formats` | Carrousels / visuels (accès secondaire) |
| `/publication?vue=…`, `/studio`, `/video` | Redirections (identifiants conservés) |

« Ajouter au calendrier » = transfert du montage en brouillon de post (`transfer-studio-media`, idempotent par montage)
puis date, légende, CTA et mot-clé (`update`). Aucune publication ni programmation sur Instagram.

### État réel

| Fonction | État |
|---|---|
| Montage filmé (import multi-prises, transcription, clic sur un mot, correction du texte sans toucher l'audio, coupes et rétablissement, annuler/refaire, cadrage/zoom, sous-titres, animations par séquence, sons, médias, retours, planche contact, rendu) | ✅ code BeeMarketing raccordé ; exécution réelle = fonction `montage` (non testée ici contre la production) |
| **Montage instantané** : coupe, rétablissement, recadrage, sous-titres et correction de mots appliqués tout de suite ; enregistrement en arrière-plan (file sérialisée, regroupement, version serveur vérifiée, conflit signalé sans écrasement, nouvelle tentative) ; annuler / refaire locaux immédiats (Ctrl+Z, Ctrl+Maj+Z) ; alerte si l'on quitte pendant un enregistrement | ✅ (`src/domain/studio/edit-sync.ts`, e2e avec serveur simulé) |
| Invalidation des rendus et validations après modification | ✅ côté serveur (`STALE`, empreinte de planche) — logique BeeMarketing, non modifiée |
| Post et export : couverture prise dans le MP4, légende/CTA/mot-clé/destination/hashtags liés à la version, MP4, PNG, TXT, SRT recalculé sur les coupes | ✅ sans Meta, DM ni calendrier ; légende sur l'appareil, ou sur le serveur pour un des 72 réels (`reel-caption-save`) |
| Éditeur IA unique (MotionSpec) : brief, scènes, voix, visuels, aperçu, rendu ; « Recommandation » = modèle converti en scènes ; contenus hérités lisibles et repris en scènes | ✅ |
| Reprise d'un rendu IA après rechargement (identifiants serveur, réconciliation idempotente `submit` du même jobId) | ✅ même navigateur |
| 72 réels : recherche, filtres, prompteur, import idempotent depuis le dépôt, association aux prises | ✅ (catalogue BeeMarketing) |
| Tournage en fichiers séparés → projets associés | ✅ (limites serveur : 500 Mo, 10 min par prise) |
| Long rush : segments depuis les annonces « V12 + titre », correction des bornes et associations, plan JSON, script FFmpeg | ✅ sur le poste ; ⚠️ voir blocages |
| Shell sans missions (TopBar, Queen Bee, WatchdogPulse retirés) | ✅ ; pages héritées `/missions`, `/approvals`… joignables par adresse seulement |

### Blocages et services à configurer

1. **Long rush en ligne** : envoi reprenable > 500 Mo, transcription asynchrone > 10 min, extraits FFmpeg côté serveur
   et projets portant la référence au rush et à ses bornes → **évolution de la fonction `montage` (BeeMarketing)**,
   non faite : nécessite un traitement hors Edge Function (FFmpeg) et l'accord de Cédric pour déployer.
2. **Légende et rendus IA durables multi-appareils** : changement serveur **prêt, non déployé** — branche
   BeeMarketing `claude/studio-post-et-rendus` (migration additive `montages.post`, action `post-save` de `montage`,
   action `jobs` + index privé de `studio-render`, tests Edge et PGlite, procédure
   `docs/studio/INSTAGRAM_BEERECOS_20261102.md`). Instagram BeeRecos l'utilise déjà : légende enregistrée sur le
   serveur, rendu IA d'une version déjà soumise suivi au lieu d'être repayé. Tant que le serveur n'est pas déployé :
   repli automatique (légende sur l'appareil, génération normale).
3. **Variables d'InstagramBeerecos** (Vercel) : `NEXT_PUBLIC_BEE_API_URL=https://wekbmkjvieagmghjanjb.functions.supabase.co`,
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY` du projet BeeMarketing
   (secret côté serveur uniquement). Domaine d'InstagramBeerecos à ajouter aux URL de redirection Supabase Auth.
4. Services côté Supabase (déjà gérés par BeeMarketing) : ElevenLabs (transcription), Claude (propositions),
   HeyGen (`HEYGEN_API_KEY` : voix Audrey et rendu). Génération de plans vidéo par un fournisseur externe : non raccordée.
5. Clips d'illustration et overlays animés (vidéo/transparence) : non pris en charge par la bibliothèque actuelle
   (sons et images) — lot à part (`docs/studio/REFERENCE_VIDEO_20261102.md` de BeeMarketing).

### Points à arbitrer

- **Baseline** : la branche `claude/keen-noether-vhcqgq` (non fusionnée) passe #MonReseauCestTonReseau en Poppins ;
  la demande du 2026-11-02 exige une écriture manuscrite (Caveat). Le studio garde Caveat.
- Composants portés non utilisés par le parcours réels (tableau `SocialWorkspace`, `Calendar`, `InstagramPilot`,
  `PostPreview`) : conservés, non routés. `src/domain/video/reel.ts` reste le modèle hérité des missions.

### Vérifications (2026-11-02)

`npm run lint` ✅ · `npm run typecheck` ✅ · `npm test` ✅ 528 tests (65 fichiers) + 11 tests `automation/` ·
`npm run build` (mode démo) ✅ · `npm run test:e2e` ✅ 37 réussis (serveur BeeMarketing simulé : `tests/e2e/bee-api.ts`), 3 limités à un format. E2E en mode démo, sans
serveur de montage ni rendu réel : ils ne prouvent ni un MP4 généré ni une transcription réelle.

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
| 5 | Interface : 45 fichiers → `src/components/social/` (composants client, pont `router.tsx` react-router → next/navigation), page `/publication` (« Réseaux sociaux » dans le menu) : parcours, calendrier, pilote Instagram, montage, Reels IA, carrousels ; e2e `tests/e2e/social.spec.ts` | ✅ partiel |
| 5 bis | Recentrage produit : `/publication` devient une redirection ; préparation du post intégrée au studio (pas de `PublishWizard`) ; automatisation, campagnes, validations commerciales, La Ruche restent dans BeeMarketing | ✅ (voir ci-dessous) |
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

## Adaptations faites en phase 5

- Route `/publication` conservée (liens internes des écrans inchangés) ; lien « Bibliothèque » `/media` → `/library`.
- Jetons Tailwind de BeeMarketing ajoutés dans `globals.css` (`mut`, `fg`, `acid`, `brand-soft`…) ; classes globales
  (`btn-*`, `card`, `pill`, `kicker`, `tab`) limitées au conteneur `.social-studio`, qui force le thème clair.
- ESLint : 5 règles de Next.js absentes de BeeMarketing désactivées pour `src/components/social/**` uniquement.
- Deux corrections de types React 19 (`useRef` sans argument, `RefObject<… | null>`).
- Ressources copiées : pictogrammes BeeRecos (`public/brand/`), Reel de démonstration (`public/reels/demo/`).
- Dépendance ajoutée : `html-to-image@1.11.13` (export PNG des carrousels, même version que BeeMarketing).

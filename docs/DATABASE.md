# Base de données

Migrations versionnées dans `supabase/migrations/`. Tests RLS : `tests/rls/` (PGlite + shims `auth`/`storage` façon Supabase).

## Phase 1 — fondation (`20261019100000_foundation.sql`)

| Table | Rôle | RLS |
|---|---|---|
| roles | Référentiel RBAC (admin, content_manager, club_manager, sales, viewer) | lecture authentifiés |
| organizations | Espace BeeRecos | lecture membres, modification admin |
| profiles | Profil lié à `auth.users` (créé par trigger) | soi-même + membres de la même organisation ; modification de soi |
| memberships | Utilisateur × organisation × rôle (+ `club_ids` pour les responsables de club) | lecture membres ; écriture admin ; un admin ne peut pas se retirer |
| organization_settings | Pondérations piliers / modes, rythme, CTA, ton, **mode d'autonomie** (défaut `manual`), limites Autopilot | lecture membres ; écriture admin + responsable contenu ; **trigger** : autonomie réservée aux admins, tout changement audité |
| provider_connections | Statut, capacités, dernière synchro (aucun secret) | lecture membres ; écriture admin |
| audit_logs | Journal inaltérable (identifiants uniquement, pas de données personnelles) | lecture admin ; aucune écriture client (fonction `log_audit` / serveur) |

Fonctions : `is_member(org)`, `has_role(org, roles[])` (SECURITY DEFINER, `search_path = ''`), `create_organization(name, slug)`, `log_audit(...)`.

Historique conservé : `20261019000000_cta.sql` (`cta_campaigns`, `cta_replies`, bucket `reels`) — RLS activée sans politique (accès serveur uniquement) ;
remplacé en phase 5.

## Équipe IA (`20261019130000_missions.sql`)

| Table | Rôle | RLS |
|---|---|---|
| brand_memory | Mémoire de marque utilisée par tous les agents | lecture membres ; écriture admin / responsable contenu |
| agent_profiles | Personnalisation des agents par organisation | idem |
| campaigns | Campagnes | idem |
| missions | Objectif, modèle, statut dérivé des tâches, marqueur démo | idem |
| mission_tasks | Tâches : agent, statut, besoins, entrée/sortie, raison d'attente, erreur, essais | idem |
| task_dependencies | Graphe (pas d'auto-dépendance) | idem |
| activity_logs | Fil d'activité réel | lecture membres ; **aucune écriture client** (moteur serveur) |
| approvals | Validations humaines | lecture membres ; décision admin / responsable contenu ; **chaque décision auditée** |
| content_items | Contenus planifiés | lecture membres ; écriture admin / responsable contenu |

## Publication Instagram (`20261103120000_instagram_publication.sql`, base partagée BeeMarketing)

| Table | Rôle | RLS |
|---|---|---|
| ig_connection | Compte Instagram connecté (une ligne) : id, pseudo, **jeton**, expiration | activée, **aucune politique** : serveur uniquement |
| ig_publications | Créations de l'onglet Post (réel du Studio ou post photo/carrousel), mot-clé + DM, état draft → publishing → published / error | lecture et brouillons par l'auteur ; « publié » écrit par le serveur seulement |
| cta_campaigns / cta_replies | Règles « commente MOT → DM » (créées après publication confirmée) et journal des réponses | serveur uniquement |

Bucket privé `ig-media` : photos des posts (JPEG préparé dans le navigateur, lien signé d'une heure pour Instagram).
Tests : `tests/rls/instagram.test.ts`.

## Publication LinkedIn (`20261104090000_linkedin_publication.sql`, base partagée BeeMarketing)

| Élément | Rôle | Protection |
|---|---|---|
| li_connection | Compte LinkedIn connecté (OAuth officiel) : URN du membre, nom, **jeton**, expiration, droits accordés | RLS sans politique : serveur uniquement |
| ig_publications.linkedin_* | Texte LinkedIn adaptable, cible (profil / page), état de la publication, URN du post | déclencheur `ig_publications_linkedin_guard` : une session ne peut pas écrire l'état ni l'URN |

Variables serveur (Vercel) : `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, et `LINKEDIN_ORGANIZATION_URN` pour la page BeeRecos
(après validation « Community Management API »). Tests : `tests/rls/instagram.test.ts`.

## Phases suivantes

Voir `PLAN.md` § Modèle de données. Chaque nouvelle table : `organization_id`, `created_at`/`updated_at`, index sur les clés de filtre,
RLS + tests RLS dans la même PR.

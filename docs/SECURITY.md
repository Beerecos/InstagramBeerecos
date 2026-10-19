# Sécurité & RGPD

## En place (phase 1)
- **RLS** sur toutes les tables exposées, testée sur un vrai Postgres (`tests/rls`) : isolation par organisation, anonymes refusés,
  lecteur sans écriture, Autopilot réservé aux admins, journal d'audit inaltérable.
- **RBAC** : admin, content_manager, club_manager, sales, viewer (`src/domain/roles.ts` + mêmes règles en SQL).
- **Auth** : Supabase lien magique, pas d'inscription libre (`shouldCreateUser: false`), réponse identique compte existant ou non,
  JWT vérifié côté serveur (`getClaims`) dans le proxy et le DAL ; redirections internes uniquement (`safeNext`).
- **Secrets** : uniquement côté serveur (`server-only`), validés au démarrage (`src/instrumentation.ts`) ; la clé secrète Supabase
  n'est utilisable que dans `src/lib/supabase/admin.ts`. `.env*` ignorés par git (sauf `.env.example`).
- **En-têtes** : HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- **Webhook Instagram** : signature HMAC-SHA256 vérifiée en temps constant, déduplication, 503 propre si non configuré.

## À venir
- Webhooks : horodatage + protection anti-rejeu + idempotence en base (phase 5) ; ManyChat, Metricool.
- `approval_requests` garanties par les workflows (phase 4).
- Rétention configurable, export/suppression/anonymisation d'une personne, historique de consentement (phase 5).
- Logs sans email/téléphone/contenu privé ; audit de toute publication, suppression, DM automatique, changement de lead, invitation, Autopilot.
- Interdits produit : scraping de données privées, auto-follow/like/comment massifs, cold DM massif.

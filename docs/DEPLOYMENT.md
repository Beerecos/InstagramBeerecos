# Déploiement

1. **Supabase** : créer le projet, appliquer `supabase/migrations/*` dans l'ordre (CLI `supabase db push` ou SQL editor).
   Auth → URL Configuration : Site URL = URL Vercel, Redirect URL = `https://<domaine>/auth/confirm`.
2. **Vercel** : importer le dépôt (framework Next.js, Node 24), renseigner les variables de `.env.example` (production + preview).
3. **Premier compte** : créer l'utilisateur dans Supabase (Auth → Users → Invite), se connecter, l'écran « Bienvenue » crée l'espace BeeRecos
   (l'utilisateur en devient administrateur, mode d'autonomie « Manuel »).
4. Vérifier : `GET /api/health`, Réglages → Intégrations.

## ACTIONS CÉDRIC

| # | Action (une seule instruction) | Débloque |
|---|---|---|
| 1 | Créer un projet Supabase et m'envoyer « OK Supabase » — je peux ensuite appliquer les migrations via l'intégration Supabase connectée à cette session. | Connexion, données (phase 1) |
| 2 | ✅ Fait — charte BeeRecos 2026 et logo BeeMarketing intégrés. Si possible, fournir le logo en SVG (vectoriel) pour une netteté parfaite. | Design aux couleurs officielles |
| 3 | Fournir la liste des clubs (nom, ville, adresse, jours/heures de réunion, responsable, places visiteurs) en CSV ou Google Sheet. | Matching et invitations (phase 6) |
| 4 | Confirmer s'il existe des règles d'exclusivité par profession dans les clubs (oui/non, lesquelles). | Matching (phase 6) |
| 5 | Créer une clé API Anthropic (console.anthropic.com) et l'ajouter dans Vercel sous `ANTHROPIC_API_KEY`. | Orchestrateur (phase 2) |
| 6 | Ouvrir un compte Metricool (offre avec accès API/MCP) relié au compte Instagram BeeRecos. | Publication & statistiques (phase 4) |
| 7 | Ouvrir un compte ManyChat Pro relié au compte Instagram BeeRecos. | Commentaire → DM (phase 5) |
| 8 | Créer les accès Google Veo (Google AI Studio / Vertex) et Runway, avec un plafond de dépense. | Vidéos IA (phase 3) |

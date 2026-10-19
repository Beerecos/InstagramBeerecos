# Fournisseurs (adapters)

Contrats : `src/providers/types.ts`. Erreurs : `src/providers/errors.ts`. Statut des intégrations : `src/server/integrations/registry.ts`.

| Interface | V1 | Plus tard | Phase |
|---|---|---|---|
| LLMProvider | Claude (Anthropic direct ou AI Gateway) | — | 2 |
| VideoGenerationProvider | Google Veo, Runway | HeyGen, Kling, autres | 3 |
| TranscriptionProvider | à choisir à l'implémentation (local Whisper/Parakeet via Hyperframes, ou API) | — | 3 |
| SocialPublishingProvider | MetaInstagramProvider (direct, base : `automation/lib/instagram.mjs`) + LinkedInProvider (direct, Posts API) | Metricool (option) | 4 |
| InstagramMessagingProvider | Meta direct (base : `automation/lib/cta.mjs`, webhook signé) | ManyChat (option) | 5 |
| StorageProvider | Supabase Storage | — | 3 |
| NotificationProvider | in-app (Supabase Realtime) + email | push | 5 |

Règles :
- **Capability matrix** : chaque adapter expose `capabilities()` (`true` / `false` / `"providerDependent"`). Le métier vérifie avant d'appeler et
  dégrade proprement (ex. pas de `bestTimes` → créneaux par défaut des réglages).
- **Instagram (Meta)** : Reels, posts, carrousels et stories pour comptes professionnels ; publication immédiate (programmation par notre workflow) ;
  vidéo hébergée à une URL publique (Supabase Storage, URL signée) ; 100 publications API / 24 h ; réponse privée unique par commentaire, sous 7 jours.
- **LinkedIn** (doc Microsoft Learn, version 2026-10) : `POST https://api.linkedin.com/rest/posts` avec en-têtes `Linkedin-Version: AAAAMM` et
  `X-Restli-Protocol-Version: 2.0.0`. Texte, image, vidéo, document, multi-images, sondage. Médias envoyés d'abord via Images/Videos/Documents API.
  Profil de Cédric : `w_member_social` (libre-service). Page BeeRecos : `w_organization_social` / `r_organization_social` via la *Community Management API*
  (validation LinkedIn : niveau développement, puis standard avec démo vidéo). Pas de programmation côté API, pas de DM automatique.
  La version `202511` est arrêtée le 16/11/2026 : suivre les migrations de version.
- **Aucune API inventée** : chaque adapter cite la documentation officielle consultée (en-tête du fichier) et est couvert par des tests avec mocks.
- **Coûts** : chaque job enregistre provider, modèle, tokens/secondes/crédits, coût estimé et réel ; budgets jour/semaine/mois (phase 7).
- **Fallbacks** : retry contrôlé si `retryable`, puis autre fournisseur qualifié ; jamais « publié » sans confirmation.

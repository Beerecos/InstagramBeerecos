# Fournisseurs (adapters)

Contrats : `src/providers/types.ts`. Erreurs : `src/providers/errors.ts`. Statut des intégrations : `src/server/integrations/registry.ts`.

| Interface | V1 | Plus tard | Phase |
|---|---|---|---|
| LLMProvider | Claude (Anthropic direct ou AI Gateway) | — | 2 |
| VideoGenerationProvider | Google Veo, Runway | HeyGen, Kling, autres | 3 |
| TranscriptionProvider | à choisir à l'implémentation (local Whisper/Parakeet via Hyperframes, ou API) | — | 3 |
| SocialPublishingProvider | Metricool MCP | MetaInstagramProvider (base : `automation/lib/instagram.mjs`) | 4 |
| InstagramMessagingProvider | ManyChat | Meta direct (base : `automation/lib/cta.mjs`, webhook signé) | 5 |
| StorageProvider | Supabase Storage | — | 3 |
| NotificationProvider | in-app (Supabase Realtime) + email | push | 5 |

Règles :
- **Capability matrix** : chaque adapter expose `capabilities()` (`true` / `false` / `"providerDependent"`). Le métier vérifie avant d'appeler et
  dégrade proprement (ex. pas de `bestTimes` → créneaux par défaut des réglages).
- **Metricool MCP** : capacités découvertes dynamiquement (liste des tools MCP réellement exposés) ; aucun appel à un tool supposé.
- **Aucune API inventée** : chaque adapter cite la documentation officielle consultée (en-tête du fichier) et est couvert par des tests avec mocks.
- **Coûts** : chaque job enregistre provider, modèle, tokens/secondes/crédits, coût estimé et réel ; budgets jour/semaine/mois (phase 7).
- **Fallbacks** : retry contrôlé si `retryable`, puis autre fournisseur qualifié ; jamais « publié » sans confirmation.

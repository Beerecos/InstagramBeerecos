---
name: beerecos-publishing
description: Use when choosing the date, time, caption and CTA for a BeeRecos content item and scheduling, updating or cancelling it on Instagram or LinkedIn, always respecting approvals and the autonomy mode.
---

# Publication BeeRecos

1. Pré-requis non négociables : statut `APPROVED` **et** quality gate réussi (`beerecos-quality-control`).
2. Lire le mode d'autonomie (`get_brand_context`) :
   - MANUEL : rien sans validation explicite pour chaque contenu.
   - VALIDATION : tout préparer, puis `request_approval` avant `schedule_social_post`.
   - AUTOPILOT : seulement dans les limites (max/jour, horaires, jours interdits, formats, budget).
     Hors limites → `request_approval`.
   Le tool `schedule_social_post` est protégé côté serveur : ne pas tenter de le contourner.
3. Horaire : `get_best_posting_times` si le provider le fournit ; sinon créneaux par défaut des réglages.
4. Vérifier la capability matrix du réseau avant d'appeler. Décliner le contenu par réseau (`references/reseaux.md`) :
   jamais le même texte copié-collé sur Instagram et LinkedIn.
5. Après appel : un contenu n'est `PUBLISHED` que sur confirmation du provider (identifiant de post).
   Échec → statut `FAILED` + raison lisible dans Système / Runs. Jamais « supposé publié ».
6. Relier le post au contenu (`content_id → publication_id`) et au CTA pour l'attribution.

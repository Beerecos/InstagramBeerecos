# Tunnel commercial Instagram

```
REEL (content_id) → publication (publication_id) → COMMENTAIRE (CTA) → DM → LEAD → QUALIFICATION
  → MATCHING CLUB → INVITATION → RAPPELS → VISITE (attendance) → FOLLOW-UP → ADHÉSION (conversion)
```

- CTA principal : « Commente CLUB et je t'invite à découvrir un club BeeRecos. » Autres : RÉSEAU, FORMATION, IA, INVITATION.
- Engagement entrant uniquement (pas de cold DM, auto-follow, auto-like, auto-commentaire).
- Messagerie : V1 ManyChat (`InstagramMessagingProvider`), Meta direct plus tard. Fenêtres Instagram respectées
  (une réponse privée par commentaire ; 24 h après le dernier message de la personne).
- Qualification : 3 à 5 questions (ville, activité, priorité) puis score COLD/WARM/HOT (code déterministe, réglable).
- Matching : distance, prochaine réunion, places, profil, objectif, règles commerciales **configurées** ; confiance insuffisante → HUMAN_REVIEW.
- Invitation : PROPOSED → CONFIRMED → REMINDER_SENT → ATTENDED / NO_SHOW → FOLLOW_UP → CONVERTED / LOST.
- Attribution : chaque événement porte `content_id` et `publication_id` → « cette vidéo a généré 14 demandes CLUB, 8 invitations, 5 visites, 2 adhésions ».
- Handoff humain à tout moment (« Reprendre la conversation ») ; jamais d'envoi automatique si la confiance est faible.

Détails de conversation : `agent/skills/beerecos-instagram-sales/references/scripts-dm.md`.

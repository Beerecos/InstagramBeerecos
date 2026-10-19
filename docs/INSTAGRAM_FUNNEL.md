# Tunnel commercial Instagram

```
REEL (content_id) → publication (publication_id) → COMMENTAIRE (CTA) → DM → LEAD → QUALIFICATION
  → MATCHING CLUB → INVITATION → RAPPELS → VISITE (attendance) → FOLLOW-UP → ADHÉSION (conversion)
```

- CTA principal : « Commente CLUB et je t'invite à découvrir un club BeeRecos. » Autres : RÉSEAU, FORMATION, IA, INVITATION.
- Engagement entrant uniquement (pas de cold DM, auto-follow, auto-like, auto-commentaire).
- Messagerie : API Meta directe (`InstagramMessagingProvider`, webhook signé), sans abonnement tiers. Fenêtres Instagram respectées
  (une réponse privée par commentaire ; 24 h après le dernier message de la personne).
- Qualification : 3 à 5 questions (ville, activité, priorité) puis score COLD/WARM/HOT (code déterministe, réglable).
- Matching : distance, prochaine réunion, places, profil, objectif, règles commerciales **configurées** ; confiance insuffisante → HUMAN_REVIEW.
- Invitation : PROPOSED → CONFIRMED → REMINDER_SENT → ATTENDED / NO_SHOW → FOLLOW_UP → CONVERTED / LOST.
- Attribution : chaque événement porte `content_id` et `publication_id` → « cette vidéo a généré 14 demandes CLUB, 8 invitations, 5 visites, 2 adhésions ».
- Handoff humain à tout moment (« Reprendre la conversation ») ; jamais d'envoi automatique si la confiance est faible.

Détails de conversation : `agent/skills/beerecos-instagram-sales/references/scripts-dm.md`.

## LinkedIn

LinkedIn sert la **visibilité** (dirigeants, professions libérales) et renvoie vers la même invitation :
- l'API LinkedIn ne permet pas d'envoyer des DM automatiques : le CTA LinkedIn est un **lien vers la page d'invitation publique**
  BeeMarketing (phase 6), ou un « commente CLUB » auquel un humain répond ;
- chaque lead venant de LinkedIn porte `source = linkedin` et le `publication_id` du post, pour la même attribution jusqu'à l'adhésion.

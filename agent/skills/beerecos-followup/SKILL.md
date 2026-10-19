---
name: beerecos-followup
description: Use when handling a BeeRecos club invitation after it is booked - confirmation, reminders (D-1, morning), attendance, post-visit follow-up message and handing hot prospects to a human.
---

# Suivi d'invitation BeeRecos

Séquence (workflow durable `CLUB_INVITATION_WORKFLOW` / `REMINDER_WORKFLOW`) :
1. Confirmation immédiate : club, date, heure, adresse réelles + possibilité d'annuler.
2. Rappel J-1 ; rappel le matin seulement si activé dans les réglages.
3. Après la réunion : présence marquée par le responsable (`mark_attendance`) — jamais déduite.
4. Follow-up humain et ouvert, par exemple :
   « Merci d'être venu découvrir BeeRecos ce matin. Qu'as-tu pensé de la réunion ? »
5. Analyse de la réponse : intention forte → 🔥 `handoff_to_human` ; hésitation → répondre aux
   questions factuelles, sans pression ; désintérêt → remercier et clôturer (statut LOST).
6. Jamais plus d'une relance sans réponse. Pas d'urgence artificielle ni de pression commerciale.

---
name: beerecos-club-matcher
description: Use when proposing the most relevant BeeRecos club and next meeting to a qualified prospect, based on location, distance, availability, profession, goals and configured business rules.
---

# Matching club BeeRecos

1. Appeler `find_nearby_clubs` puis `get_upcoming_meetings` : **aucune** information de club, de date,
   d'heure, d'adresse ou de place disponible ne provient d'ailleurs.
2. `match_club` applique l'algorithme déterministe (distance, prochaine date, places, activité,
   profil, objectif, règles commerciales configurées).
3. Règles métier (ex. exclusivité par profession) : uniquement celles présentes dans
   `club_professions` / réglages. Ne jamais en supposer une.
4. Confiance < seuil, ville non couverte, aucun créneau → `HUMAN_REVIEW` et message honnête :
   « Je vérifie avec l'équipe le club le plus proche de toi et je reviens vers toi. »
5. Proposer un seul club (au plus deux si équivalents), avec la prochaine réunion réelle.

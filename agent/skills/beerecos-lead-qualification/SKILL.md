---
name: beerecos-lead-qualification
description: Use when qualifying an Instagram prospect for BeeRecos - deciding which question to ask next, extracting city, profession, company and priority from the conversation, and computing the COLD/WARM/HOT lead score.
---

# Qualification de lead BeeRecos

1. Extraire d'abord ce que la conversation contient déjà ; ne jamais redemander une information donnée.
2. Questions dans l'ordre utile, **3 à 5 maximum** avant de proposer une action : ville → activité → priorité
   (→ statut dirigeant/indépendant/commercial et disponibilité seulement si nécessaire au matching).
3. Calculer le score avec `score_lead` (règles configurables, code déterministe) — ne pas l'estimer à l'œil.
   Critères et barème : `references/scoring.md`.
4. Mettre à jour la fiche (`update_lead`) avec la provenance (Reel d'origine, CTA) pour l'attribution.
5. HOT → proposer la visite tout de suite et notifier l'humain responsable ; ambiguïté → `handoff_to_human`.
6. Minimisation RGPD : ne collecter que ce qui sert au matching et à l'invitation.

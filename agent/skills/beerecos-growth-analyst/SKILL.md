---
name: beerecos-growth-analyst
description: Use when analysing BeeRecos Instagram performance, attribution and conversion (views to comments, DMs, leads, invitations, visits, memberships) and recommending the next content priorities.
---

# Analyste croissance BeeRecos

1. Métrique reine : **visites de clubs**, puis **adhésions** issues d'Instagram. Les vues, likes et
   abonnés sont des indicateurs secondaires.
2. Données : `get_social_analytics` + attribution interne (`get_content_performance`). Ne jamais
   compléter une donnée manquante par une estimation présentée comme réelle.
3. Comparer par pilier, format, mode (humain/IA/hybride), hook, CTA, club et période.
4. Rigueur statistique (`references/seuils.md`) : un insight n'est formulé qu'au-dessus des seuils ;
   sinon « tendance à confirmer ». Toujours donner l'échantillon et la période.
5. Recommandations : ajustements progressifs (± 10 points de pondération max par cycle), jamais
   de bascule complète de stratégie. Les changements de réglages passent par `request_approval`.
6. Format d'insight : « Les vidéos humaines Réseau MONÉTISÉ génèrent 2,8× plus de visites que les
   vidéos IA (n = 24 contenus, 8 semaines, confiance élevée). »

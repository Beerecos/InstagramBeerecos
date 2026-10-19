---
name: beerecos-editorial-director
description: Use when planning BeeRecos Instagram content - a week or month calendar, content ideas, pillar balance, human/AI/hybrid mix, formats, audiences, or deciding what to publish next.
---

# Directeur éditorial BeeRecos

Charge d'abord `beerecos-brand`.

1. Lire les réglages réels (`get_brand_context`) : pondération des piliers, mix humain/IA/hybride,
   publications par semaine, CTA prioritaires, formats interdits/prioritaires. Ne pas les deviner.
2. Lire l'existant : `get_content_library` (déjà publié/planifié) et `get_content_performance`.
   Dédupliquer : pas deux sujets proches à moins de 30 jours (même pilier + même enseignement).
3. Réutiliser avant de produire : chercher des rushs studio (`search_media`) avant de proposer une vidéo IA.
4. Pour chaque idée, remplir la fiche de `references/fiche-contenu.md` (pilier, sous-thème, objectif,
   audience, format, hook, tension, enseignement, preuve, CTA, funnel, date recommandée).
5. Réseaux : décider pour chaque idée Instagram, LinkedIn ou les deux, avec une déclinaison par réseau
   (`beerecos-publishing/references/reseaux.md`). Le fichier « Beerecos_20_Posts_LinkedIn_Club_Affaires » sert de banque de sujets, jamais republié tel quel.
6. Équilibrer : respecter la pondération à ±10 points sur la période ; au moins un contenu par semaine
   relié explicitement à la vie des clubs.
7. Créer via `create_content_idea` (statut IDEA). Ne jamais programmer : c'est `beerecos-publishing`.

Formats disponibles et quand les utiliser : `references/formats.md`. Audiences : `references/audiences.md`.

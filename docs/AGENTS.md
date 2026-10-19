# Équipe marketing IA

BeeMarketing fonctionne comme une agence : **Queen Bee** reçoit un objectif, le transforme en **mission**
(un graphe de tâches), et chaque tâche est exécutée par l'agent spécialisé responsable dès que ses
dépendances sont satisfaites. Les validations humaines bloquent la suite tant qu'elles ne sont pas décidées.

```
Demande → Queen Bee (planification) → Mission + graphe de tâches
        → moteur : tâche prête ? ressource disponible ? → agent (Claude, sortie structurée validée)
        → Terminé | À valider (boîte de validation) | En attente (connexion requise) | Erreur (1 nouvel essai si temporaire)
        → mission terminée
```

| Agent | Rôle | Skills appliqués |
|---|---|---|
| Queen Bee | Comprend la demande, choisit le modèle de mission, crée les tâches, soumet les validations | beerecos-brand, beerecos-compliance |
| Strategist | Cible, angle, offre, messages, CTA, funnel, KPI → Marketing Strategy Brief | beerecos-editorial-director, beerecos-growth-analyst |
| Researcher | Tendances, questions des prospects, hooks — sources réelles via recherche web, sinon « hypothèse » | beerecos-editorial-director |
| Content Architect | Plan éditorial : piliers, formats, plateformes, dates, mode humain/IA/hybride | beerecos-editorial-director, beerecos-publishing |
| Copywriter | Hooks, scripts, légendes, carrousels, posts LinkedIn, emails, landing, invitations | beerecos-reel-scriptwriter, beerecos-brand |
| Video Director | Découpage de vidéo humaine, storyboard et prompts IA ; ne prétend jamais avoir généré une vidéo | beerecos-ai-video-director, beerecos-studio-editor, beerecos-hybrid-video |
| Creative Director | Direction visuelle selon la charte | beerecos-brand |
| Social Manager | Adaptation par plateforme et plan de publication (aucune programmation sans connexion + validation) | beerecos-publishing |
| Lead Agent | CTA, landing, formulaire, qualification, relances ; aucun club ni date inventé | beerecos-instagram-sales, beerecos-lead-qualification, beerecos-club-matcher |
| Analytics Agent | Analyse des données réelles uniquement (`analytics_data` requis) | beerecos-growth-analyst |
| Brand Guardian | Relecture + **contrôles déterministes** (casse BeeRecos/BeeMarketing/BeeSchool, mots interdits) | beerecos-quality-control, beerecos-brand, beerecos-compliance |

## Watchdog — chien de garde
Agent **déterministe** (aucun appel IA, aucun coût) qui surveille toutes les missions et tous les agents.

| Constat | Gravité | Réparation automatique |
|---|---|---|
| Tâche « En cours » depuis plus de 10 min (exécution interrompue) | critique | remise en file + relance (si un essai reste) |
| Tâche en erreur | critique | dernier essai si un essai reste ; **jamais** pour un contenu refusé par un humain |
| Ressource attendue désormais connectée | info | relance |
| Ressource toujours manquante | alerte | — (raison affichée) |
| Travail prêt mais aucun agent dessus depuis 2 min | alerte | relance de l'équipe |
| Validation en attente depuis plus de 24 h | alerte | — (rappel) |
| Livrable vide, limites signalées par un agent, corrections de marque | alerte / info | — |
| Plus de 3 essais par tâche en moyenne (boucle coûteuse) | critique | **pause** de la mission jusqu'à relance humaine |

- Santé d'une mission : 100 − 30 par constat critique − 10 par alerte. Santé d'un agent : part de ses tâches sans erreur ni blocage.
- Chaque intervention est journalisée dans le fil d'activité (acteur « Watchdog »). Toutes les modifications sont conditionnées
  au statut observé : deux tournées simultanées ne font jamais le travail deux fois.
- Missions de démonstration : inspectées, jamais modifiées.
- Déclenchement : impulsion de l'interface ouverte (au plus toutes les 3 min par organisation), bouton « Lancer une inspection »
  sur `/watchdog`, et tâche planifiée Vercel Cron `GET /api/cron/watchdog` (protégée par `CRON_SECRET`). `vercel.json` la planifie
  une fois par jour (limite du plan Hobby) ; sur le plan Pro, passer à `*/15 * * * *`.
- « Relancer l'équipe » sur une mission lève les pauses posées par le Watchdog.
- Code : règles `src/domain/missions/watchdog.ts`, exécutant `src/server/missions/watchdog-runner.ts`, tests `tests/unit/watchdog.test.ts`.

## Garanties « pas de fausse IA »
- Une tâche n'est « En cours » que lorsqu'un appel réel au modèle est en train d'être fait (réservation conditionnelle en base).
- Sans clé Claude, sans vidéo importée, sans moteur vidéo ou sans statistiques : la tâche passe « En attente » avec la raison exacte.
- Chaque ligne du fil d'activité est un événement enregistré (`activity_logs`), écrit par le moteur ou une décision humaine.
- Les sorties ne contiennent pas de raisonnement interne : résumé, décisions justifiées, livrables, limites.
- Données de démonstration : uniquement en mode démo, missions marquées « Démo ».

## Code
- Domaine : `src/domain/missions/` (agents, modèles de mission, planificateur, graphe, schéma de sortie, contrôle de marque).
- Moteur : `src/server/missions/engine.ts` (idempotent, contexte limité aux dépendances directes, 2 essais max).
- Fournisseur IA : `src/providers/ai/` (`AIProvider`, adapter Anthropic avec sortie structurée Zod, repli serveur en cas de refus).
- Stockage : `MissionStore` → Supabase (`supabase-store.ts`) ou mémoire (`memory-store.ts`, démo et tests).
- Tests : `tests/unit/missions.test.ts` (fournisseur simulé, aucun appel payant), `tests/rls/missions.test.ts`.

L'agent conversationnel eve reste prévu pour les modifications en langage naturel d'une mission existante
(« change le post de jeudi ») ; aujourd'hui chaque demande à Queen Bee crée une nouvelle mission.

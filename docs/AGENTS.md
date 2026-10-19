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

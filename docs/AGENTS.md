# Agents

Runtime : **eve** 0.80 (Vercel, preview), monté dans Next.js par `withEve` (branchement en phase 2).
Documentation de référence : `node_modules/eve/docs/` (version installée).

| Agent | Rôle | Skills principaux |
|---|---|---|
| BEE MARKETING ORCHESTRATOR (`agent/`) | Comprend la demande, délègue, résume avant toute action critique | beerecos-brand, beerecos-compliance, beerecos-quality-control |
| Content Director (`agent/subagents/content-director`) | Stratégie éditoriale, idées, scripts | beerecos-editorial-director, beerecos-reel-scriptwriter |
| Video Director | Storyboard, génération, montage, rendu | beerecos-ai-video-director, beerecos-studio-editor, beerecos-hybrid-video |
| Sales Concierge | Commentaires, DM, qualification, matching, invitations, relances | beerecos-instagram-sales, beerecos-lead-qualification, beerecos-club-matcher, beerecos-followup |
| Growth Analyst | Analytics, attribution, insights | beerecos-growth-analyst |

Règles :
- Pas de subagent quand une fonction déterministe suffit : `score_lead`, `match_club`, quality gate sont du code testé exposé comme tools.
- Chaque tool : schéma d'entrée/sortie zod, erreurs typées, journalisation `tool_runs`, permission (rôle), idempotency key pour les effets de bord,
  politique d'approbation eve (`always()` sur publication, DM sensible, invitation, budget, Autopilot).
- Liste des tools prévus et phase : `PLAN.md` / section 21 du cahier des charges.
- Canal web : `agent/channels/eve.ts` vérifiera la session Supabase (le canal par défaut d'eve refuse le trafic en production).
- Evals (phase 8) : cas A à G (`evals/`).

# Pipeline vidéo

| Mode | Étapes |
|---|---|
| A — IA | idée → script → storyboard → choix moteur par scène (capability matrix, coût, budget) → génération (Veo/Runway) → montage déterministe → sous-titres → CTA → légende/couverture → quality gate → validation |
| B — Studio | upload → stockage → transcription horodatée → segmentation → détection des passages (score /100) → hooks → plusieurs Reels → montage → sous-titres → B-roll si besoin → CTA → miniature → légende → validation |
| C — Hybride | rush humain monté → inserts (capture réelle > graphique animé > B-roll existant > scène générée) → retour caméra → montage → validation |

États : DRAFT → SCRIPT_READY → STORYBOARD_READY → GENERATING → ASSEMBLING → READY_FOR_REVIEW → APPROVED → SCHEDULED → PUBLISHED (FAILED, ARCHIVED).
Progression affichée (« Génération scène 2/4 », « Montage », « Sous-titres », « Export »).

Montage final **déterministe** : FFmpeg (concaténation, recadrage 9:16 1080×1920, normalisation −14 LUFS, sous-titres, overlays, export)
et Hyperframes (motion HTML → MP4). Exécution dans des workflows durables (Vercel Workflow / sandbox eve), jamais dans une requête web.
Outils déjà présents : `.claude/skills/motion-design-reel/scripts/` (planche contact, loudness, QA Reel), skills `hyperframes*`, `video-use`.

## Hyperframes dans BeeMarketing (intégré le 19/10/2026)

Chaîne d'un Reel « 100 % IA » en motion design, sans moteur vidéo payant :

1. Mission « Vidéo 100 % IA » : Chercheur → Stratège → Rédacteur (script, validé par vous) → Réalisateur vidéo (storyboard).
2. Tâche **Reel motion design (Hyperframes)** : le Réalisateur vidéo produit uniquement des **données** (`ReelSpec` :
   scènes hook → idées → liste → CTA, durées, mot-clé, accent). Schéma : `src/domain/video/reel.ts`.
3. Le **code** génère la composition Hyperframes (`buildReelComposition`) : 1080×1920, 60 i/s, Poppins, bleu #2851FF,
   un seul accent, zones de sécurité Instagram, taille de texte ajustée pour qu'aucun mot ne déborde, tout texte échappé.
   La marque ne dépend donc jamais de ce qu'écrit le modèle.
4. Aperçu dans l'application (mission, boîte de validation, Studio vidéo) avec le lecteur officiel `@hyperframes/player`.
   La composition est servie par `GET /api/compositions/[taskId]` (session obligatoire, CSP sans ressource externe).
5. Après validation : « Télécharger la composition », puis rendu MP4 sur un poste :
   `npm run reel:render -- reel-xxxx.html` → `hyperframes check` puis `render --quality delivery` → `export/<nom>.mp4`.
6. Contrôle avant publication : `bash .claude/skills/motion-design-reel/scripts/qa-reel.sh export/<nom>.mp4`.

Validé sur le Reel de démonstration : `hyperframes check` sans erreur (mise en page, mouvement, contrastes 12/12 WCAG AA),
rendu 1080×1920 60 i/s en ~50 s sur 4 cœurs. Avertissements de lint restants : suggestions de découpage en
sous-compositions (lisibilité dans le Studio Hyperframes), sans effet sur le rendu.

Pas encore fait : piste audio (voix off `npm run voice`, musique), rendu automatique côté serveur (Vercel ne peut pas
lancer Chrome + FFmpeg ; options : Claude Managed Agents, Hyperframes cloud/Lambda, ou poste local), plans vidéo générés
(Veo/Runway) insérés dans la composition.

Ressources servies depuis `public/hyperframes/` (aucun CDN) : GSAP 3.14.2 (licence standard GSAP, gratuite),
runtime `@hyperframes/core` 0.8.126 (Apache-2.0, aperçu uniquement), Poppins 300/600/700 (SIL OFL, `fonts/OFL.txt`).
Versions épinglées : `@hyperframes/player` 0.8.126, CLI `hyperframes@0.8.126` (identiques pour l'aperçu et le rendu).

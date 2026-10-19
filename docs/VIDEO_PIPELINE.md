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

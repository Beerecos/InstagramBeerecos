---
name: beerecos-quality-control
description: Use before moving any BeeRecos content to APPROVED or publishing it - checks brand spelling, pillar, hook, duration, 9:16 format, audio, subtitles, Instagram safe zones, CTA, caption, licences, personal data and hallucinated facts.
---

# Contrôle qualité BeeRecos

Le quality gate est **bloquant** : un échec critique empêche le passage à APPROVED (garanti côté serveur).

1. Lancer les contrôles automatiques : orthographe `BeeRecos`, durée, 1080×1920, cadence, présence
   audio, loudness ≈ −14 LUFS (`motion-design-reel/scripts/qa-reel.sh`), légende ≤ 2 200 caractères.
2. Relire avec `references/checklist.md` (pilier, hook, sous-titres, safe zones, CTA, licences, données personnelles).
3. **Anti-hallucination** : tout club, date, chiffre, citation ou témoignage doit avoir une source
   en base ou dans un média ; sinon échec critique.
4. Rendre un score /100 et la liste des échecs (critiques / mineurs). Score < 80 ou un critique → refus.
5. Contenu contraire à la marque (ton gourou, promesse irréaliste, pilier absent, page « IA générique ») → refus motivé.

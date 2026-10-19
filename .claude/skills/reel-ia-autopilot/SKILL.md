---
name: reel-ia-autopilot
description: >
  Chaîne complète « 100 % IA » pour Instagram : à partir d'un sujet (ou de la prochaine idée de
  content/idees.md), écrire le script et le hook, générer la voix off IA, construire les visuels
  en motion design (Hyperframes, sans tournage), rendre le Reel 1080×1920, le publier sur
  Instagram via l'API officielle et brancher le call to action « commente MOT → DM avec bouton ».
  À utiliser dès qu'on parle de vidéo générée par IA, de vidéo sans visage (faceless), de publier
  sur Instagram, de planifier des Reels, de mot-clé en commentaire, de DM automatique, de
  ManyChat-like, de lead magnet ou de call to action.
---

# Reel IA autopilote

Tu produis un Reel sans tournage, tu le publies et tu installes le call to action qui
transforme les commentaires en DM. Les règles de rythme, de style et de QA sont celles de
`motion-design-reel` (lis son SKILL.md avant de construire) ; ce skill ajoute la génération
IA, la publication et le CTA.

## Modes

- **Assisté (défaut)** : trois validations explicites — script, planche contact, publication.
- **Autopilote** : seulement si `content/autopilote.md` contient `autopilote: oui`. Les
  validations script et planche sont alors remplacées par les contrôles automatiques
  (QA verte + planche relue par toi). La publication reste interdite si un contrôle échoue.
  Sans ce fichier ou avec `non`, ne publie jamais sans un OK écrit dans la conversation.

Publier est irréversible et public : en mode assisté, montre la légende finale, la vidéo
(planche) et la campagne CTA, puis attends « publie ».

## 1. Sujet et angle
- Sujet donné, sinon prends la première idée non cochée de `content/idees.md`.
- Lis `STYLE.md` (direction artistique) et `content/offres.md` (ressources à offrir en DM).
- Choisis : la promesse, la preuve à montrer, le mot-clé CTA (un mot court, en MAJUSCULES,
  facile à taper : GUIDE, PROMPT, LISTE…) et la ressource liée.

## 2. Script (20–35 s, ≈ 2,5 mots/s en français)
Structure imposée :
1. **Hook 0–3 s** : une phrase choc, concrète, qui crée une tension (voir
   `motion-design-reel/references/hook-et-structure.md`).
2. **Promesse** (1 phrase).
3. **2–3 preuves / étapes**, chacune pensée comme une image plein écran (« montrer au lieu de dire »).
4. **CTA final** : « Commente MOT et je t'envoie [ressource] en DM. »

Écris `projets/<date>-<slug>/script.txt` (texte dit, sans didascalies) et
`projets/<date>-<slug>/storyboard.md` (Temps | Voix | À l'écran | Son).

## 3. Voix off IA
```bash
node automation/bin/voice.mjs --text projets/<p>/script.txt --out projets/<p>/voix.mp3
```
ElevenLabs si `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` sont définis (meilleure qualité),
sinon voix locale française `ff_siwis`. Puis timing au mot :
```bash
npx hyperframes transcribe projets/<p>/voix.mp3 --language fr --dir projets/<p>
```
Chaque `data-start` est calé sur ces timestamps.

## 4. Visuels 100 % IA
- Passe par le skill `hyperframes` (point d'entrée obligatoire) → route `faceless-explainer`,
  canvas **1080×1920**, 60 i/s. Pas de personne réelle générée : typographie, interfaces
  réalistes, data-viz, images illustratives.
- Images / icônes / SFX : skill `media-use` (`resolve`), avant toute création à la main ;
  effets nommés : `hyperframes-registry`.
- Sous-titres mot par mot : skill `embedded-captions` ou captions de la composition, hors des
  20 % du bas et du bord droit.
- 3 à 5 pleins écrans, chacun avec sa texture ; une seule chose bouge à la fois.
- La fin affiche le CTA (« Commente MOT ») au moins 2 s, en grand, zone centrale.

## 5. Rendu et contrôle
```bash
npx hyperframes render projets/<p> --quality delivery --fps 60 --output export/<p>.mp4
bash .claude/skills/motion-design-reel/scripts/loudness.sh export/<p>.mp4 --fix export/<p>-final.mp4
bash .claude/skills/motion-design-reel/scripts/qa-reel.sh export/<p>-final.mp4
bash .claude/skills/motion-design-reel/scripts/contact-sheet.sh export/<p>-final.mp4 12
```
Regarde la planche et l'image des zones cachées. Tout doit être vert avant l'étape 6.

## 6. Légende
`projets/<p>/legende.txt` : 1re ligne = le hook réécrit, 2–4 lignes de valeur, la ligne
CTA (« 💬 Commente MOT pour recevoir … »), 3–5 hashtags ciblés. ≤ 2 200 caractères.
Mentionne que la vidéo est générée par IA si `content/autopilote.md` le demande
(`mention_ia: oui`, recommandé).

## 7. Publication + CTA
Simulation d'abord (aucun effet) :
```bash
node automation/bin/ig.mjs publish --video export/<p>-final.mp4 --caption-file projets/<p>/legende.txt \
  --keyword MOT --dm-text "Salut {username}, merci pour ton commentaire ! Voici l'accès :" \
  --button "Accéder au guide" --url https://… --public-reply "Je viens de te l'envoyer en DM 📩"
```
Après l'OK (ou en autopilote, QA verte) : même commande avec `--yes`. Elle dépose la vidéo
sur Supabase Storage, publie le Reel, puis crée la campagne CTA liée au post.
Le webhook (`api/instagram-webhook.mjs`, déployé sur Vercel) répond ensuite seul à chaque
commentaire contenant le mot-clé : un DM avec bouton par personne, + réponse publique.

Vérifications après publication : `node automation/bin/ig.mjs cta list`, permalink renvoyé.
Coche l'idée dans `content/idees.md` et note le permalink dans `content/publications.md`.

## Contraintes Instagram à respecter
- 100 publications API / 24 h max ; ne jamais publier en boucle.
- Réponse privée : 1 seule par commentateur, sous 7 jours après le commentaire.
- Le jeton longue durée expire après 60 jours : `node automation/bin/ig.mjs refresh-token`.
- Pas de contenu imitant une personne, une marque ou une app réelle à l'identique.

## Si quelque chose manque
Lance `node automation/bin/ig.mjs me`. En cas d'erreur de jeton, d'ID ou de Supabase,
renvoie l'utilisateur vers `docs/SETUP-INSTAGRAM.md` (étape concernée) ; ne devine jamais
un identifiant.

# Note de production — film BeeMarketing

## 1. Ce que le produit permet réellement (inspection du dépôt, octobre 2026)

| Élément du parcours | État | Où |
|---|---|---|
| Missions IA (Queen Bee + agents), boîte de validation « Valider / Autre version / Refuser » | **Confirmé**. Nécessite `ANTHROPIC_API_KEY`. | `src/server/missions/`, `src/app/(app)/approvals` |
| Aperçu d'un Reel motion design (HyperFrames) et téléchargement de la composition | **Confirmé**. Le MP4 se rend hors de l'application. | `src/components/video/reel-preview.tsx`, `npm run reel:render` |
| Studio avec trois entrées « Réel filmé / Vidéo IA / Carrousel » | **Maquette**. Le Studio vidéo a deux cartes (« Créer avec l'IA », « Importer ma vidéo », import annoncé en MVP 2). « Carrousels » n'est qu'un filtre. | `src/app/(app)/video`, `studio` |
| Ajustement d'un titre dans un éditeur | **Absent**. On ne peut que commenter et demander « Autre version ». | — |
| Génération vidéo IA (Veo, Runway) | **Non connectée**. Seules les variables d'environnement existent. | `settings/integrations` |
| Email / MList | **Absent**. MList n'apparaît nulle part et aucun envoi d'email n'existe. | — |
| Instagram | **Partiel, hors application**. Une CLI publie des Reels et répond « commente MOT → DM » via l'API Graph. | `automation/ig.mjs` |
| LinkedIn, parrainage adhérent, invitant | **Absents**. | — |
| CRM prospects (origine, statut, prochaine action) | **Maquette vide**. Les colonnes Kanban sont à 0 (« Arrive en phase 5 »). | `src/app/(app)/leads` |
| Clubs, réunions, invitation, confirmation, agenda, rappel J−2 | **Absents** (« Arrive en phase 6 »). | `src/app/(app)/clubs` |
| Présence, lien d'adhésion, nouvelle invitation, adhésion | **Absents**. `adh-beerecos.com/join` n'apparaît pas dans le code. | — |
| BeeBot / agent eve | **Non connectés**. eve est prévu, mais pas installé. | `PLAN.md` |

**Conséquence** : l'essentiel du parcours (attention → contact → invitation → présence → adhésion) relève encore de
la feuille de route. Le film est donc une **présentation du concept**.

## 2. Adaptations du film

- La mention discrète « Présentation du concept · données fictives » est visible en haut à gauche des scènes 2 à 9.
- Les écrans sont des **maquettes recomposées** dans le style de l'application : Poppins, bleu #2851FF, libellés
  repris du code quand ils existent (« Valider », « Autre version », « Prospects », navigation). Ce ne sont pas des
  captures : il n'en existe aucune dans le dépôt.
- La voix off reste descriptive (« reliez », « préparez », « gardez une vision claire »). Elle ne promet ni envoi
  automatique, ni publication, ni BeeBot. BeeBot n'apparaît pas dans le film.
- Le Studio montre un **Réel filmé**, pas une génération IA, pour ne pas simuler une génération qui n'existe pas.
- MList apparaît comme fournisseur (« via MList ») sur la carte Email, et non comme une cinquième source.
- Scène 8 :
  - l'animateur saisit la présence lui-même ;
  - le lien d'adhésion envoyé laisse le statut « Adhésion : en attente » ;
  - la carte finale rappelle que « l'échange commercial et l'adhésion : décision humaine ».
- Les données sont fictives : Camille Laurent, Marc Dubois, Thomas Petit, « Club démo · Bayonne », « Réunion du
  jeudi · 8 h 00 » (sans date réelle). Le film ne contient ni chiffres de performance ni témoignages.
- Le CTA final affiche « Découvrir BeeMarketing », sans URL ni QR code, car aucune adresse publique n'a été fournie.
  Pour en ajouter une, renseigner `urls.cta` dans `config/promo.json` et l'afficher dans `hyperframes/src/outro.html`.

## 3. Assets manquants ou provisoires (à remplacer)

| Élément | Situation | Remplacement |
|---|---|---|
| Écriture manuscrite officielle du hashtag | Absente de la charte, qui ne prévoit que Poppins. **Caveat Bold** (OFL) est utilisée en bleu #2851FF. | Déposer la police dans `public/fonts/` et changer `@font-face` dans `outro.html` et `remotion/fonts.ts`. |
| Logo BeeMarketing | Le fichier officiel `beemarketing-logo.png` est utilisé tel quel. Il a « Bee » en bleu nuit gras et « Marketing » en dégradé bleu, ce qui diffère de la description du brief (« Bee » noir moyen, « Marketing » plus léger). | Fournir un SVG officiel si une autre version fait foi. |
| Voix off | Synthèse locale provisoire (Kokoro). « Vidéos IA » est mal prononcé. | Enregistrement humain : voir `SCRIPT-VOIX.md`. |
| Pictogrammes Email / Instagram / LinkedIn | Tracés simples inspirés des logos, pas les fichiers officiels des plateformes. | Logos officiels, en respectant leurs chartes. |
| Musique et effets | Composés par synthèse dans `scripts/music.py`, à 116 BPM avec une graine fixe. Aucun droit tiers. | Toute piste sous licence peut remplacer `public/audio/musique.wav`. |
| Photo authentique de rencontre (scène 9) | Non fournie. La scène utilise une représentation graphique. | Ajouter l'image dans `public/` et l'utiliser dans `S09Benefit.tsx`. |
| URL du CTA final | Non fournie. | `urls.cta` |

## 4. Contrôles effectués

- Les deux exports font 1 800 images à 30 i/s, en H.264 High, yuv420p, avec un son AAC stéréo 48 kHz.
- Le son est à −14,1 LUFS intégrés, avec une crête à −1,2 dBFS : aucune saturation.
- Aucune image noire n'a été détectée (`blackframe`). Les raccords ont été inspectés image par image, y compris les
  4 raccords HyperFrames ↔ Remotion. Le repère bleu garde la même position d'une scène à l'autre.
- Une retranscription Whisper du mixage final retrouve tout le texte : la voix reste intelligible sur la musique.
- `hyperframes check` : 0 erreur. Il reste deux avertissements :
  - la structure d'un seul clip, sans conséquence au rendu ;
  - la 1re image de la signature est vide, ce qui est voulu car elle sert de raccord.
- `tsc` (Remotion) : 0 erreur.
- La signature est stable de 57,4 s à 60 s.
- Les sous-titres des scènes 1 et 10 ne sont pas incrustés, car le texte est déjà à l'écran. Ils restent dans le SRT.

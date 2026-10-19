# Sound design qui fait « pro »

Le son vend l'image : sans effets sonores, même un motion parfait paraît amateur.
Source recommandée : **Pixabay** (pixabay.com/sound-effects), gratuit, sans attribution
obligatoire. Le skill `media-use` peut aussi résoudre un SFX en fichier local, et
`hyperframes-audio` gère le placement dans la composition.

## Les sons indispensables

| Son | Quand | Recherche Pixabay |
|---|---|---|
| Impact grave | La toute première image | cinematic braam |
| Aspiration inversée | Chaque grand mot du hook | reverse cinematic |
| Swoosh court | Cartes, volets, transitions | swoosh |
| Sub drop | Ouverture d'un plein écran | deep sub drop |
| Clic | Interfaces, prompt | ui click |
| Frappe clavier | Texte qui s'écrit, commentaires | keyboard typing |

**Toujours montrer la liste des sons trouvés avant de télécharger.** Ranger dans `assets/sfx/`.

## Les 4 règles de mixage

1. **Caler au bon endroit** : un swoosh ou un riser se cale sur son moment le plus fort ;
   un impact ou un clic sur son début (= le `data-start` de l'élément).
2. **Toujours sous la voix** : effets environ **8 dB en dessous**, jamais plus forts que la voix.
   Discret, jamais de bruitage cartoon.
3. **Musique** libre de droits (Mixkit, licence à lire pour chaque morceau) calée sur les temps,
   **≈ 20 dB sous la voix** — tester sur un haut-parleur de téléphone.
4. **Volume final ≈ −14 LUFS** (standard Instagram, TikTok, YouTube), true peak ≤ −1 dBTP.

## Mesurer et normaliser

Mesure :
```bash
bash .claude/skills/motion-design-reel/scripts/loudness.sh export/final.mp4
```

Normaliser en deux passes vers −14 LUFS sans retoucher la vidéo :
```bash
bash .claude/skills/motion-design-reel/scripts/loudness.sh export/final.mp4 --fix export/final-14lufs.mp4
```

## Exemple de demande type
> Cherche sur Pixabay un impact grave, un swoosh court, un sub drop, un clic et une frappe
> clavier. Montre-moi la liste avant de télécharger, puis cale chaque son sur mes
> animations, 8 dB sous ma voix, et vise −14 LUFS.

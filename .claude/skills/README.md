# Skills du projet

| Skill(s) | Source | Licence | Version importée |
|---|---|---|---|
| `motion-design-reel` | ce dépôt (guide OPUS motion design) | — | — |
| `nouvelle-video`, `transcrire`, `couper`, `titre`, `mot-cle`, `animation`, `nouvelle-animation`, `exporter` | ce dépôt (montage `edit.json`, `docs/EDIT-JSON.md`) ; exemples testés par `tests/unit/skills.test.ts` | — | — |
| `embedded-captions`, `faceless-explainer`, `figma`, `general-video`, `hyperframes`, `hyperframes-animation`, `hyperframes-audio`, `hyperframes-cli`, `hyperframes-core`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-registry`, `hyperframes-studio`, `media-use`, `motion-graphics`, `music-to-video`, `pr-to-video`, `product-launch-video`, `remotion-to-hyperframes`, `slideshow`, `talking-head-recut` | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) `skills/` | Apache-2.0 (`LICENSE-hyperframes`) | `cea0bad7931122bd93680006978c0d9007daa3d4` |
| `video-use` | [browser-use/video-use](https://github.com/browser-use/video-use) | MIT (`video-use/LICENSE`) | `43cfc566833548093455c9d4a46bd69913b7e552` |

Les skills Hyperframes se référencent entre eux (`../hyperframes/...`) : garder le jeu complet.

## Mettre à jour

```bash
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/heygen-com/hyperframes "$tmp/hf"
git clone --depth 1 https://github.com/browser-use/video-use "$tmp/vu"
cp -r "$tmp"/hf/skills/*/ .claude/skills/
cp -r "$tmp"/vu/{SKILL.md,install.md,helpers,skills,pyproject.toml,LICENSE} .claude/skills/video-use/
```

Puis mettre à jour les SHA ci-dessus.

Alternative officielle (plugin Claude Code, hors dépôt, par poste) :

```bash
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
```

Le dépôt garde sa copie versionnée des skills (SHA ci-dessus) pour que tout le monde travaille avec la même version.

import { z } from "zod";

/**
 * Reel motion design BeeRecos rendu par Hyperframes (HTML → MP4).
 * L'IA ne produit que des données (ReelSpec) ; la composition est générée ici, de façon déterministe,
 * aux couleurs et règles de la charte (STYLE.md) : la marque ne dépend jamais de ce qu'écrit le modèle.
 */

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_MAX_SECONDS = 60;

const text = (max: number) => z.string().trim().min(1).max(max);

export const ReelSceneSchema = z.object({
  kind: z.enum(["hook", "statement", "list", "cta"]).describe("hook : accroche (0–3 s) ; statement : une idée ; list : 2 à 4 points ; cta : appel à l'action final"),
  text: text(120).describe("Texte principal à l'écran, court (idéalement moins de 12 mots)"),
  detail: z.string().trim().max(160).optional().describe("Ligne secondaire facultative"),
  items: z.array(text(60)).max(4).optional().describe("Uniquement pour kind = list"),
  duration: z.number().min(1.5).max(8).describe("Durée de la scène en secondes (texte lisible au moins 1,5 s)"),
});

export const ReelSpecSchema = z
  .object({
    title: text(80).describe("Titre interne du Reel"),
    pillar: z.enum(["reseau_monetise", "formation", "digitalisation_ia"]),
    accent: z.enum(["violet", "vert"]).describe("Un seul accent par vidéo (charte)"),
    ctaKeyword: z
      .string()
      .trim()
      .regex(/^[A-ZÀ-Ý0-9]{2,20}$/, "Mot-clé en majuscules, sans espace")
      .describe("Mot à commenter, ex. CLUB"),
    scenes: z.array(ReelSceneSchema).min(2).max(10),
  })
  .refine((s) => s.scenes.reduce((n, x) => n + x.duration, 0) <= REEL_MAX_SECONDS, { message: `Le Reel dépasse ${REEL_MAX_SECONDS} s.` })
  .refine((s) => s.scenes[0].kind === "hook", { message: "La première scène doit être le hook." })
  .refine((s) => s.scenes[s.scenes.length - 1].kind === "cta", { message: "La dernière scène doit être le CTA." });

export type ReelSpec = z.infer<typeof ReelSpecSchema>;

export const reelDuration = (spec: ReelSpec) => Math.round(spec.scenes.reduce((n, x) => n + x.duration, 0) * 100) / 100;

export const ACCENT = { violet: "#693BFC", vert: "#3BCAC2" } as const;

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Tout texte venant du modèle ou de l'utilisateur est échappé : aucune balise ni script ne peut entrer dans la composition. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** Fond par scène : blanc ou plein écran bleu, en alternance ; le CTA est toujours bleu. */
function theme(kind: ReelSpec["scenes"][number]["kind"], index: number) {
  return kind === "cta" || index % 2 === 1 ? "blue" : "white";
}

/** Logo BeeRecos version principale : ratio du fichier officiel (176,152 × 188,103). */
export const LOGO_WIDTH = 220;
export const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 188.103) / 176.152);

/** Largeur utile entre les marges de sécurité (px). */
const SAFE_WIDTH = REEL_WIDTH - 90 - 170;

/**
 * Taille de police qui garantit qu'aucun mot ne déborde : le mot le plus long doit tenir sur une ligne.
 * `em` = largeur moyenne d'un caractère en Poppins (≈ 0,58 em en Light, 0,66 em en SemiBold/Bold, marge comprise).
 */
export function fitFontSize(text: string, base: number, em: number, min = 40): number {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  return Math.max(min, Math.min(base, Math.floor(SAFE_WIDTH / (longest * em))));
}

/**
 * `preview` ajoute le runtime Hyperframes auto-hébergé pour le lecteur intégré (sinon il serait chargé depuis un CDN).
 * Sans `preview`, le fichier est celui à rendre avec `npx hyperframes render` (le moteur injecte son propre runtime).
 */
export function buildReelComposition(input: ReelSpec, opts: { assetBase: string; preview?: boolean }): string {
  const spec = ReelSpecSchema.parse(input);
  const base = opts.assetBase.replace(/\/$/, "");
  const accent = ACCENT[spec.accent];
  const total = reelDuration(spec);

  const titleSize = (scene: ReelSpec["scenes"][number]) =>
    scene.kind === "hook" ? fitFontSize(scene.text, 112, 0.66) : scene.kind === "cta" ? fitFontSize(scene.text, 72, 0.6) : fitFontSize(scene.text, 92, 0.6);
  let t = 0;
  const sections: string[] = [];
  const tweens: string[] = [];
  spec.scenes.forEach((scene, i) => {
    const id = `s${i}`;
    const start = Math.round(t * 100) / 100;
    t += scene.duration;
    const items = scene.kind === "list" ? (scene.items ?? []) : [];
    sections.push(
      [
        `      <section id="${id}" class="clip scene ${theme(scene.kind, i)}" data-start="${start}" data-duration="${scene.duration}" data-track-index="0">`,
        `        <div class="safe">`,
        scene.kind === "cta" ? `          <p id="${id}-kw" class="keyword">${escapeHtml(spec.ctaKeyword)}</p>` : "",
        `          <h1 id="${id}-title" class="${scene.kind}" style="font-size: ${titleSize(scene)}px">${escapeHtml(scene.text)}</h1>`,
        scene.detail ? `          <p id="${id}-detail" class="detail">${escapeHtml(scene.detail)}</p>` : "",
        items.length ? `          <ul id="${id}-list">${items.map((it, j) => `<li id="${id}-i${j}" style="font-size: ${fitFontSize(it, 52, 0.66, 32)}px">${escapeHtml(it)}</li>`).join("")}</ul>` : "",
        // Logo officiel (brandguide p. 9), blanc sur bleu, ≥ 150 px, jamais déformé : seule son opacité est animée.
        scene.kind === "cta" ? `          <img id="${id}-brand" class="brand" src="${base}/brand/beerecos-logo-white.svg" alt="BeeRecos" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" />` : "",
        `        </div>`,
        `      </section>`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
    // Révélations : flou → net, expo ; une seule chose bouge à la fois.
    const at = (d: number) => Math.round((start + d) * 100) / 100;
    if (scene.kind === "cta") tweens.push(`tl.fromTo("#${id}-kw", { scale: 0.92, opacity: 0, filter: "blur(12px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, ${at(0.1)});`);
    tweens.push(`tl.fromTo("#${id}-title", { y: 60, opacity: 0, filter: "blur(10px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.8, ease: "expo.out" }, ${at(scene.kind === "cta" ? 0.5 : 0.1)});`);
    if (scene.detail) tweens.push(`tl.fromTo("#${id}-detail", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.inOut" }, ${at(0.7)});`);
    items.forEach((_, j) => tweens.push(`tl.fromTo("#${id}-i${j}", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: "expo.out" }, ${at(0.6 + j * 0.35)});`));
    if (scene.kind === "cta") tweens.push(`tl.fromTo("#${id}-brand", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.inOut" }, ${at(1.1)});`);
  });

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${REEL_WIDTH}, height=${REEL_HEIGHT}" />
    <title>${escapeHtml(spec.title)}</title>
    <script src="${base}/gsap-3.14.2.min.js"></script>${opts.preview ? `\n    <script src="${base}/hyperframe.runtime-0.8.126.iife.js"></script>` : ""}
    <style>
      @font-face { font-family: "Poppins"; font-weight: 300; src: url("${base}/fonts/poppins-latin-300-normal.woff2") format("woff2"); }
      @font-face { font-family: "Poppins"; font-weight: 600; src: url("${base}/fonts/poppins-latin-600-normal.woff2") format("woff2"); }
      @font-face { font-family: "Poppins"; font-weight: 700; src: url("${base}/fonts/poppins-latin-700-normal.woff2") format("woff2"); }
      body { margin: 0; background: #ffffff; font-family: "Poppins", sans-serif; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      .scene { position: absolute; inset: 0; }
      .scene.white { background: #ffffff; color: #000000; }
      .scene.blue { background: #2851FF; color: #ffffff; }
      /* Zones de sécurité Instagram : rien d'important dans le haut, le bas 20 % ni le bord droit. */
      .safe { position: absolute; top: 260px; bottom: 420px; left: 90px; right: 170px; display: flex; flex-direction: column; justify-content: center; gap: 36px; }
      h1 { margin: 0; font-weight: 300; line-height: 1.08; letter-spacing: -1px; hyphens: none; }
      h1.hook { font-weight: 600; }
      .scene.white h1.hook { color: #000000; }
      .detail { margin: 0; font-size: 44px; font-weight: 300; line-height: 1.3; opacity: 0.85; }
      ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 28px; }
      li { font-weight: 600; padding-left: 44px; position: relative; }
      li::before { content: ""; position: absolute; left: 0; top: 24px; width: 18px; height: 18px; border-radius: 50%; background: ${accent}; }
      .keyword { margin: 0; align-self: flex-start; padding: 18px 44px; border-radius: 28px; background: #ffffff; color: #2851FF; font-size: 120px; font-weight: 700; letter-spacing: 4px; }
      /* Zone de sécurité du logo : marge libre d'1/6 de sa largeur (brandguide p. 13). */
      .brand { display: block; margin: ${Math.round(LOGO_WIDTH / 6)}px 0 0; width: ${LOGO_WIDTH}px; height: ${LOGO_HEIGHT}px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="${REEL_WIDTH}" data-height="${REEL_HEIGHT}" data-duration="${total}" data-fps="60">
${sections.join("\n")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${tweens.join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

/** Exemple de DÉMONSTRATION (missions démo uniquement) : aucun chiffre ni témoignage inventé. */
export const DEMO_REEL: ReelSpec = {
  title: "Une recommandation, ça vaut combien ?",
  pillar: "reseau_monetise",
  accent: "violet",
  ctaKeyword: "CLUB",
  scenes: [
    { kind: "hook", text: "Une recommandation, ça vaut combien ?", duration: 3 },
    { kind: "statement", text: "Dans un réseau monétisé, chaque mise en relation est suivie.", detail: "De la recommandation jusqu'au contrat signé.", duration: 4.5 },
    { kind: "list", text: "Ce qui change :", items: ["On sait qui recommande", "On sait ce que ça rapporte", "On remercie celui qui apporte"], duration: 5 },
    { kind: "cta", text: "Commente CLUB pour découvrir un club BeeRecos.", duration: 4 },
  ],
};

import { ACCENT, REEL_HEIGHT, REEL_WIDTH, escapeHtml } from "./reel.ts";
import { captionPages, layout, parseEdit, remapCaptions, toOutputMs, totalMs, type CaptionWord } from "./edit.ts";
import { ERROR_CSS, renderAnimation, type AnimationDef } from "./animations.ts";
import { ANIMATIONS } from "./registry.ts";

/**
 * edit.json + transcript → composition Hyperframes (HTML) d'une vidéo tournée, montée et sous-titrée.
 * Empilement : morceaux de la prise (piste 0) → animations `custom[]` (piste 2) → sous-titres (piste 1, au-dessus) → sons.
 */

export type EditCompositionOptions = {
  /** Où trouver GSAP, les polices et le logo (`public/hyperframes/` de l'application, ou `.` pour un rendu local). */
  assetBase: string;
  /** Où trouver la prise et les sons (dossier du fichier edit.json en rendu local). */
  mediaBase?: string;
  preview?: boolean;
  registry?: Record<string, AnimationDef>;
};

const s = (msValue: number) => Math.round(msValue) / 1000;

const BASE_CSS = `
      body { margin: 0; background: #000000; font-family: "Poppins", sans-serif; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      .take { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .anim-host { position: absolute; inset: 0; }
      /* Sous-titres sous le visage, au-dessus des 20 % du bas réservés à l'interface Instagram. */
      .caption { position: absolute; left: 90px; right: 170px; top: 1240px; display: flex; justify-content: center; }
      .caption p { margin: 0; padding: 14px 26px; border-radius: 20px; background: rgba(0, 0, 0, 0.82); color: rgba(255, 255, 255, 0.55); font-size: 64px; font-weight: 600; line-height: 1.2; text-align: center; }`;

function documentShell(o: { title: string; base: string; preview?: boolean; css: string; clips: string[]; tweens: string[]; durationS: number }): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${REEL_WIDTH}, height=${REEL_HEIGHT}" />
    <title>${escapeHtml(o.title)}</title>
    <script src="${o.base}/gsap-3.14.2.min.js"></script>${o.preview ? `\n    <script src="${o.base}/hyperframe.runtime-0.8.126.iife.js"></script>` : ""}
    <style>
      @font-face { font-family: "Poppins"; font-weight: 300; src: url("${o.base}/fonts/poppins-latin-300-normal.woff2") format("woff2"); }
      @font-face { font-family: "Poppins"; font-weight: 600; src: url("${o.base}/fonts/poppins-latin-600-normal.woff2") format("woff2"); }
      @font-face { font-family: "Poppins"; font-weight: 700; src: url("${o.base}/fonts/poppins-latin-700-normal.woff2") format("woff2"); }${BASE_CSS}${o.css}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="${REEL_WIDTH}" data-height="${REEL_HEIGHT}" data-duration="${o.durationS}" data-fps="30">
${o.clips.join("\n")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${o.tweens.join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

export function buildEditComposition(input: unknown, words: CaptionWord[], opts: EditCompositionOptions): string {
  const parsed = parseEdit(input);
  if (!parsed.ok) throw new Error(`edit.json invalide :\n${parsed.errors.join("\n")}`);
  const edit = parsed.edit;
  const base = opts.assetBase.replace(/\/$/, "");
  const media = (opts.mediaBase ?? ".").replace(/\/$/, "");
  const accent = ACCENT[edit.accent];
  const segments = layout(edit.ranges);
  const F = (sourceMs: number) => toOutputMs(segments, sourceMs);
  const registry = opts.registry ?? ANIMATIONS;
  const clips: string[] = [];
  const tweens: string[] = [];
  const css = new Set<string>([ERROR_CSS]);

  // Les noms de fichiers sont validés par le schéma (^[\w.-]+$) : rien d'autre ne peut entrer dans src.
  segments.forEach((seg, i) => {
    clips.push(
      `      <video id="take-${i}" class="take" src="${media}/${edit.video}" data-start="${s(seg.atMs)}" data-duration="${s(seg.toMs - seg.fromMs)}" data-media-start="${s(seg.fromMs)}" data-has-audio="true" data-volume="${edit.voiceGain}" data-track-index="0"></video>`,
    );
  });

  edit.custom.forEach((c, i) => {
    const start = F(c.fromMs);
    const duration = Math.max(F(c.toMs) - start, 100);
    const out = renderAnimation(c.name, c.props, { id: `a${i}`, start: s(start), duration: s(duration), accent, assetBase: base }, registry);
    if (!out.error) css.add(registry[c.name].css);
    clips.push(`      <div id="anim-${i}" class="clip anim-host" data-start="${s(start)}" data-duration="${s(duration)}" data-track-index="2">${out.html}</div>`);
    tweens.push(...out.tweens);
  });

  if (edit.subtitles) {
    captionPages(remapCaptions(words, segments)).forEach((page, i) => {
      const spans = page.words.map((w, j) => `<span id="c${i}-w${j}">${escapeHtml(w.text)}</span>`).join(" ");
      clips.push(`      <div id="cap-${i}" class="clip caption" data-start="${s(page.startMs)}" data-duration="${s(Math.max(page.endMs - page.startMs, 100))}" data-track-index="1"><p>${spans}</p></div>`);
      // Karaoké : chaque mot s'allume quand il est prononcé.
      page.words.forEach((w, j) => tweens.push(`tl.to("#c${i}-w${j}", { color: "#ffffff", duration: 0.08, ease: "none" }, ${s(w.startMs)});`));
    });
  }

  edit.sounds.forEach((snd, i) => {
    const dur = snd.durationMs !== undefined ? ` data-duration="${s(snd.durationMs)}"` : "";
    clips.push(`      <audio id="sfx-${i}" src="${media}/${snd.file}" data-start="${s(F(snd.atMs))}"${dur} data-volume="${snd.volume}" data-track-index="3"></audio>`);
  });

  return documentShell({ title: edit.video, base, preview: opts.preview, css: [...css].join(""), clips, tweens, durationS: s(totalMs(segments)) });
}

/**
 * Aperçu isolé d'une animation (catalogue, /nouvelle-animation) : elle seule, sur un fond qui imite une prise,
 * pendant sa durée conseillée, précédée et suivie d'une demi-seconde.
 */
export function buildAnimationPreview(name: string, props: unknown, opts: { assetBase: string; accent?: keyof typeof ACCENT; registry?: Record<string, AnimationDef> }): string {
  const registry = opts.registry ?? ANIMATIONS;
  const base = opts.assetBase.replace(/\/$/, "");
  const def = Object.hasOwn(registry, name) ? registry[name] : undefined;
  const duration = (def?.lengthMs ?? 2000) / 1000;
  const out = renderAnimation(name, props, { id: "a0", start: 0.5, duration, accent: ACCENT[opts.accent ?? "violet"], assetBase: base }, registry);
  const css = `${ERROR_CSS}${def && !out.error ? def.css : ""}
      .fake-take { position: absolute; inset: 0; background: linear-gradient(160deg, #6b6f76 0%, #2f3237 60%, #1c1d20 100%); }`;
  const clips = [
    `      <div id="fond" class="clip fake-take" data-start="0" data-duration="${duration + 1}" data-track-index="0"></div>`,
    `      <div id="anim-0" class="clip anim-host" data-start="0.5" data-duration="${duration}" data-track-index="2">${out.html}</div>`,
  ];
  return documentShell({ title: `Animation ${name}`, base, css, clips, tweens: out.tweens, durationS: duration + 1 });
}

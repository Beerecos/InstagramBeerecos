import { ACCENT, BASELINE_FONT, COLORS, DEFAULT_ACCENT, CAPTION_DEFAULTS, STUDIO_LOGO, REEL_HEIGHT, REEL_WIDTH, escapeHtml } from "./brand";
import { captionPages, layout, parseEdit, remapCaptions, takeIndexAt, takeStrip, toOutputMs, totalMs, type CaptionWord, type Edit } from "./edit";
import { ERROR_CSS, renderAnimation, type AnimationDef } from "./animations";
import { ANIMATIONS } from "./registry";
import { isBehind, usedMattes } from "./matte";
import { motionRegistryKey, renderRegistry } from "./beemotion";

/**
 * edit.json + transcript → composition Hyperframes (HTML) d'une vidéo tournée, montée et sous-titrée.
 * Empilement : morceaux des prises (piste 0, chaque morceau lit sa prise à son propre temps) → titres DERRIÈRE le sujet
 * → détourage de la prise (piste 4, visible seulement pendant ces titres : la silhouette passe devant) → animations
 * `custom[]` (piste 2) → sous-titres (piste 1, au-dessus) → sons (piste 3) → son d'entrée des animations (piste 5).
 * Rythme (lot S6) : avec `zoomCoupes`, un morceau sur deux passe en plan serré (le détourage suit le même cadrage).
 * Les sous-titres restent toujours au premier plan (z-index), devant le sujet, les titres et les onglets.
 */

export type EditCompositionOptions = {
  /** Où trouver GSAP, les polices et le logo (`public/hyperframes/` de l'application, ou `.` pour un rendu local). */
  assetBase: string;
  /** Où trouver la prise et les sons (dossier du fichier edit.json en rendu local). */
  mediaBase?: string;
  /** Adresse d'un média (prise, son) quand il n'est pas dans un dossier : ex. URL signée du stockage. Prioritaire sur mediaBase. */
  mediaUrl?: (file: string) => string;
  preview?: boolean;
  registry?: Record<string, AnimationDef>;
};

const s = (msValue: number) => Math.round(msValue) / 1000;

const BASE_CSS = `
      body { margin: 0; background: ${COLORS.black}; font-family: "Poppins", sans-serif; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      .take { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .anim-host { position: absolute; inset: 0; z-index: 6; }
      .anim-host.behind { z-index: 3; }
      .matte-wrap { position: absolute; inset: 0; z-index: 5; opacity: 0; }`;

/** Sous-titres : bloc centré en x = 540, deux lignes au plus, Poppins Medium, contraste sobre (CAPTION_DEFAULTS). */
export function captionCss(style: Edit["captionStyle"] = {}): string {
  const top = style.top ?? CAPTION_DEFAULTS.top;
  const maxWidth = style.maxWidth ?? CAPTION_DEFAULTS.maxWidth;
  const fontSize = style.fontSize ?? CAPTION_DEFAULTS.fontSize;
  return `
      .caption { position: absolute; z-index: 10; left: ${(REEL_WIDTH - maxWidth) / 2}px; width: ${maxWidth}px; top: ${top}px; min-height: ${CAPTION_DEFAULTS.height}px; display: flex; align-items: center; justify-content: center; }
      .caption p { margin: 0; max-width: 100%; padding: 10px 22px; border-radius: 16px; background: ${style.backgroundColor ?? "rgba(0, 0, 0, 0.62)"}; color: ${style.color ?? "rgba(255, 255, 255, 0.6)"}; font-family: "${style.fontFamily ?? "Poppins"}"; font-size: ${fontSize}px; font-weight: 500; line-height: 1.25; text-align: center; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }`;
}

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
      @font-face { font-family: "Poppins"; font-weight: 500; src: url("${o.base}/fonts/poppins-latin-500-normal.woff2") format("woff2"); }
      @font-face { font-family: "Poppins"; font-weight: 600; src: url("${o.base}/fonts/poppins-latin-600-normal.woff2") format("woff2"); }
      @font-face { font-family: "Poppins"; font-weight: 700; src: url("${o.base}/fonts/poppins-latin-700-normal.woff2") format("woff2"); }
      @font-face { font-family: "${BASELINE_FONT}"; font-weight: 500; src: url("${o.base}/fonts/caveat-latin-500-normal.woff2") format("woff2"); }${BASE_CSS}${o.css}
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
  const folder = (opts.mediaBase ?? ".").replace(/\/$/, "");
  // Les noms de fichiers sont validés par le schéma (^[\w.-]+$) ; une URL fournie est échappée.
  const rawMedia = (file: string) => (opts.mediaUrl ? opts.mediaUrl(file) : `${folder}/${file}`);
  const media = (file: string) => (opts.mediaUrl ? escapeHtml(rawMedia(file)) : rawMedia(file));
  const accent = ACCENT[edit.accent];
  const segments = layout(edit.ranges);
  const F = (sourceMs: number) => toOutputMs(segments, sourceMs);
  const registry = opts.registry ?? ANIMATIONS;
  const clips: string[] = [];
  const tweens: string[] = [];
  const css = new Set<string>([ERROR_CSS]);

  // Bande de prises : un morceau ne chevauche jamais deux prises (parseEdit le garantit) ; il lit la sienne à partir
  // de son temps propre (temps de la bande moins le début de la prise).
  const strip = takeStrip(edit);
  // Zoom alterné : plan large, plan serré, plan large… à chaque coupe (centré sur le visage, en haut du cadre).
  const frame = (i: number) => {
    const rhythmZoom = edit.rythme?.zoomCoupes && segments.length > 1 && i % 2 === 1 ? edit.rythme.zoom : 1;
    if (edit.framing) return ` style="transform: translate(${edit.framing.x}px, ${edit.framing.y}px) scale(${edit.framing.scale * rhythmZoom}); transform-origin: 50% 50%"`;
    return rhythmZoom !== 1 ? ` style="transform: scale(${rhythmZoom}); transform-origin: 50% 32%"` : "";
  };
  segments.forEach((seg, i) => {
    const take = strip[takeIndexAt(strip, seg.fromMs)];
    clips.push(
      `      <video id="take-${i}" class="take" src="${media(take.file)}" data-start="${s(seg.atMs)}" data-duration="${s(seg.toMs - seg.fromMs)}" data-media-start="${s(seg.fromMs - take.fromMs)}" data-has-audio="true" data-volume="${edit.voiceGain}" data-track-index="0"${frame(i)}></video>`,
    );
  });

  // Détourage (lot S5) : un calque par morceau dont la prise a un titre derrière le sujet, calé sur le même temps de la
  // prise que le morceau. L'opacité se règle sur l'enveloppe (sans data-*), jamais sur la vidéo : le moteur force
  // l'opacité des clips actifs. Le calque n'apparaît que pendant ces titres (ailleurs, la prise seule).
  const mattes = new Set(usedMattes(edit, registry));
  const behindWindows = edit.custom.filter((c) => isBehind(c.name, registry)).map((c) => ({ from: F(c.fromMs), to: F(c.fromMs) + Math.max(F(c.toMs) - F(c.fromMs), 100) }));
  segments.forEach((seg, i) => {
    const matte = edit.mattes?.[strip[takeIndexAt(strip, seg.fromMs)].file];
    const segEnd = seg.atMs + seg.toMs - seg.fromMs;
    const windows = behindWindows.filter((w) => w.from < segEnd && w.to > seg.atMs);
    if (!matte || !mattes.has(matte) || !windows.length) return;
    const take = strip[takeIndexAt(strip, seg.fromMs)];
    clips.push(
      `      <div id="mw-${i}" class="matte-wrap"><video id="matte-${i}" class="take" src="${media(matte)}" data-start="${s(seg.atMs)}" data-duration="${s(seg.toMs - seg.fromMs)}" data-media-start="${s(seg.fromMs - take.fromMs)}" data-has-audio="false" muted playsinline data-track-index="4"${frame(i)}></video></div>`,
    );
    for (const w of windows) tweens.push(`tl.set("#mw-${i}", { opacity: 1 }, ${s(w.from)});`, `tl.set("#mw-${i}", { opacity: 0 }, ${s(w.to)});`);
  });

  // Chaque animation se rend dans la version figée à l'enregistrement (BeeMotion) ; sans version, la version courante.
  const versioned = renderRegistry(registry);
  edit.custom.forEach((c, i) => {
    const start = F(c.fromMs);
    const visible = F(c.toMs) - start;
    if (visible <= 0) return;
    const duration = Math.max(visible, 100);
    const key = motionRegistryKey(c.name, c.version);
    const out = renderAnimation(key, c.props, { id: `a${i}`, start: s(start), duration: s(duration), accent, assetBase: base, media: rawMedia }, versioned);
    if (!out.error) css.add(versioned[key].css);
    const p = c.placement;
    const content = p ? `<div id="placement-${i}" style="position:absolute;inset:0;transform:translate(${p.x}px,${p.y}px) scale(${p.scale});transform-origin:50% 50%;opacity:${p.opacity}"><div id="motion-${i}" style="position:absolute;inset:0">${out.html}</div></div>` : out.html;
    clips.push(`      <div id="anim-${i}" class="clip anim-host${isBehind(c.name, registry) ? " behind" : ""}" data-start="${s(start)}" data-duration="${s(duration)}" data-track-index="2">${content}</div>`);
    tweens.push(...out.tweens);
    const fade = Math.min(.25, s(duration) / 3);
    if (p?.enter === "fade") tweens.push(`tl.from("#motion-${i}", { opacity: 0, duration: ${fade}, ease: "power2.out" }, ${s(start)});`);
    if (p?.enter === "slide") tweens.push(`tl.from("#motion-${i}", { y: 60, opacity: 0, duration: ${fade}, ease: "power2.out" }, ${s(start)});`);
    if (p?.exit === "fade") tweens.push(`tl.to("#motion-${i}", { opacity: 0, duration: ${fade}, ease: "power2.in" }, ${s(start + duration) - fade});`);
  });

  if (edit.logo) {
    const logo = edit.logo;
    clips.push(`<img id="studio-logo" src="${escapeHtml(base)}/${STUDIO_LOGO.file}" alt="BeeRecos" data-start="0" data-duration="${s(totalMs(segments))}" data-track-index="6" style="position:absolute;right:${logo.right}px;bottom:${logo.bottom}px;width:${logo.width}px;height:auto;opacity:${logo.opacity};z-index:12;object-fit:contain" />`);
  }

  if (edit.subtitles) {
    css.add(captionCss(edit.captionStyle));
    captionPages(remapCaptions(words, segments)).forEach((page, i) => {
      const spans = page.words.map((w, j) => `<span id="c${i}-w${j}">${escapeHtml(w.text)}</span>`).join(" ");
      clips.push(`      <div id="cap-${i}" class="clip caption" data-start="${s(page.startMs)}" data-duration="${s(Math.max(page.endMs - page.startMs, 100))}" data-track-index="1"><p>${spans}</p></div>`);
      // Karaoké : chaque mot s'allume quand il est prononcé.
      page.words.forEach((w, j) => tweens.push(`tl.to("#c${i}-w${j}", { color: "${edit.captionStyle.highlightColor ?? COLORS.white}", duration: 0.08, ease: "none" }, ${s(w.startMs)});`));
    });
  }

  // Son d'entrée de chaque animation (lot S6) : une seconde au plus, pour ponctuer l'arrivée du texte.
  const son = edit.rythme?.sonAnimations;
  if (son) edit.custom.forEach((c, i) => {
    clips.push(`      <audio id="whoosh-${i}" src="${media(son)}" data-start="${s(F(c.fromMs))}" data-duration="1" data-volume="${edit.rythme?.volumeSon ?? 0.35}" data-track-index="5"></audio>`);
  });

  edit.sounds.forEach((snd, i) => {
    const dur = snd.durationMs !== undefined ? ` data-duration="${s(snd.durationMs)}"` : "";
    clips.push(`      <audio id="sfx-${i}" src="${media(snd.file)}" data-start="${s(F(snd.atMs))}"${dur} data-volume="${snd.volume}" data-track-index="3"></audio>`);
  });

  if (edit.outro) {
    const start = s(totalMs(segments));
    const out = renderAnimation("logo-fin", { baseline: edit.outro.baseline }, { id: "outro-logo", start, duration: 2, accent, assetBase: base }, registry);
    css.add(registry["logo-fin"].css);
    clips.push(`<div id="studio-outro" class="clip anim-host" data-start="${start}" data-duration="2" data-track-index="7" style="position:absolute;inset:0;z-index:20">${out.html}</div>`);
    tweens.push(...out.tweens);
  }
  return documentShell({ title: edit.video, base, preview: opts.preview, css: [...css].join(""), clips, tweens, durationS: s(totalMs(segments) + (edit.outro?.durationMs ?? 0)) });
}

/**
 * Aperçu isolé d'une animation (catalogue, /nouvelle-animation) : elle seule, sur un fond qui imite une prise,
 * pendant sa durée conseillée, précédée et suivie d'une demi-seconde.
 */
export function buildAnimationPreview(name: string, props: unknown, opts: { assetBase: string; accent?: keyof typeof ACCENT; registry?: Record<string, AnimationDef>; preview?: boolean }): string {
  const registry = opts.registry ?? ANIMATIONS;
  const base = opts.assetBase.replace(/\/$/, "");
  const def = Object.prototype.hasOwnProperty.call(registry, name) ? registry[name] : undefined;
  const duration = (def?.lengthMs ?? 2000) / 1000;
  const out = renderAnimation(name, props, { id: "a0", start: 0.5, duration, accent: ACCENT[opts.accent ?? DEFAULT_ACCENT], assetBase: base }, registry);
  const css = `${ERROR_CSS}${def && !out.error ? def.css : ""}
      .fake-take { position: absolute; inset: 0; background: linear-gradient(160deg, #6b6f76 0%, #2f3237 60%, #1c1d20 100%); }`;
  const clips = [
    `      <div id="fond" class="clip fake-take" data-start="0" data-duration="${duration + 1}" data-track-index="0"></div>`,
    `      <div id="anim-0" class="clip anim-host" data-start="0.5" data-duration="${duration}" data-track-index="2">${out.html}</div>`,
  ];
  return documentShell({ title: `Animation ${name}`, base, preview: opts.preview, css, clips, tweens: out.tweens, durationS: duration + 1 });
}

/**
 * Affiche d'une animation (BeeMotion) : le même aperçu isolé, sans aucun script, figé dans son état final (les tweens
 * n'animent que l'entrée). À afficher dans un iframe `sandbox` : léger pour une galerie, aucun code exécuté.
 */
export function buildAnimationPoster(name: string, props: unknown, opts: { assetBase: string; registry?: Record<string, AnimationDef> }): string {
  const doc = buildAnimationPreview(name, props, opts);
  // Textes posés par la timeline (ex. compteur du chiffre) : leur valeur finale est écrite en dur dans l'affiche.
  const finals = new Map<string, string>();
  for (const [, id, value] of doc.matchAll(/tl\.set\("#([\w-]+)", \{ textContent: ("(?:[^"\\]|\\.)*") \}/g)) finals.set(id, JSON.parse(value));
  let poster = doc.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  for (const [id, value] of finals) poster = poster.replace(new RegExp(`(<[^>]*\\sid="${id}"[^>]*>)[^<]*`), (_, open: string) => `${open}${escapeHtml(value)}`);
  // Sans le runtime Hyperframes, rien ne dimensionne le canevas : on lui donne sa taille réelle.
  return poster
    .replace("</head>", `<style>#root { width: ${REEL_WIDTH}px; height: ${REEL_HEIGHT}px; }</style>\n  </head>`);
}

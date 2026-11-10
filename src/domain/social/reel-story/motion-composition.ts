import { currentVoiceAsset } from "./audrey";
import { FONT_FAMILY, FRAME, LOGOS, SAFE } from "./brand";
import { endTotal, endVideoClip, escapeHtml, fitBlock } from "./composition";
import { END_VIDEO } from "../montage/brand";
import { fitSize } from "./metrics";
import {
  parseMotionSpec, RHYTHM, sceneDurations, sceneStarts, sceneWords, wordTime,
  type MotionScene, type MotionSpec, type MotionVisual, type MotionWord,
} from "./motion-spec";

/**
 * Mise en scène du style « Motion BeeRecos - Dynamique » : une composition Hyperframes (HTML + une chronologie GSAP en
 * pause). Le MÊME code sert à l'aperçu de BeeMarketing et au rendu MP4. Grammaire reprise du film de présentation
 * validé le 2026-10-23 : entrées de mots calées sur la voix, poussée caméra continue, punch sur le mot pivot, cartes
 * inclinées qui se remettent de face, tracés de relation, sorties orientées vers la scène suivante, mascotte officielle,
 * sous-titres en bas au centre (un seul mot bleu à la fois), signature officielle (logo jamais animé ni déformé).
 */

export type MotionCompositionOptions = {
  /** Dossier des ressources (polices, GSAP, logos, mascotte) : URL dans l'aperçu, "." dans le projet de rendu. */
  assetBase: string;
  preview?: boolean;
  soundtrackSrc?: string;
  resolveVoice?: (src: string, sceneId: string) => string;
};

const C = { blue: "#2851FF", black: "#000000", white: "#FFFFFF", bg: "#F5F7FA", line: "#DDE2EA", mut: "#667085", pale: "#EAEEFF" } as const;
const W = FRAME.width, H = FRAME.height;
/** Zone utile : marges Instagram (droite 170 px), contenu essentiel au-dessus des sous-titres (y 1240-1450). */
const X0 = SAFE.left, X1 = W - SAFE.right, Y0 = SAFE.top, Y1 = 1200;
const CAP_TOP = 1240, CAP_H = 210;
/** Mascotte officielle (image fournie par Cédric, 454 × 640). */
/** Baseline manuscrite bleue (fichier validé par Cédric, 1062 × 101), posée sous le logo de fin. */
const BASELINE = { file: "brand/beerecos-baseline-seule-bleu.webp", ratio: 101 / 1062 };
const MASCOT = { file: "brand/beerecos-mascotte.webp", w: 160, h: Math.round((160 * 640) / 454) };
/** Place libre réservée à la mascotte dans chaque état visuel (centre, px) : jamais sur un texte. */
const MASCOT_SLOT: Record<MotionVisual, { x: number; y: number }> = {
  titre: { x: 820, y: 1000 }, relation: { x: 195, y: 610 }, marque: { x: 830, y: 340 }, liste: { x: 825, y: 370 },
  chapitre: { x: 825, y: 370 }, piliers: { x: 830, y: 360 }, personnes: { x: 175, y: 340 }, cta: { x: 820, y: 345 }, signature: { x: 540, y: -300 },
};
const ICONS = [
  '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  '<path d="M5 6h14v9H9l-4 4z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
  '<path d="M4 18h5v-5h5V8h6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
];
const PERSON = (fill: string) => `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="17" r="9" fill="${fill}"/><path d="M8 44c1.5-10 8-15 16-15s14.5 5 16 15z" fill="${fill}"/></svg>`;

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,;:!?’'«»]/g, "");

/** Titre affiché selon la quantité de texte : minimal = le mot pivot seul. Le pivot est marqué *mot*. */
function shownTitle(s: MotionScene, texte: MotionSpec["settings"]["texte"]): string {
  if (!s.title) return "";
  if (texte === "minimal" && s.pivot) {
    const hit = s.title.replace(/\n/g, " ").split(/\s+/).find((w) => norm(w).endsWith(norm(s.pivot!)));
    if (hit) return `*${hit.replace(/[.,;:!?]+$/, "")}*`;
  }
  if (!s.pivot) return s.title;
  let done = false;
  return s.title.split("\n").map((line) => line.split(/(\s+)/).map((w) => {
    if (done || !norm(w) || !norm(w).endsWith(norm(s.pivot!))) return w;
    done = true;
    return `*${w}*`;
  }).join("")).join("\n");
}

type Line = ReturnType<typeof fitBlock>[number];
const LH = 1.14;
const blockH = (lines: Line[]) => Math.round(lines.reduce((n, l) => n + l.size * LH, 0));

/** Lignes de titre en mots séparés (chaque mot entre seul, le pivot en bleu / SemiBold). */
function titleHtml(id: string, lines: Line[], align: "left" | "center", tone: "dark" | "light"): { html: string; words: string[] } {
  const words: string[] = [];
  const html = lines.map((l, i) => `<div class="tl ${align}" style="font-size:${l.size}px;height:${Math.round(l.size * LH)}px">${l.tokens.map((k, j) => {
    const wid = `${id}-w${i}-${j}`;
    words.push(k.t);
    return `${k.space ? " " : ""}<span class="w${k.em ? " pv" : ""}${tone === "light" ? " lt" : ""}" id="${wid}">${k.em ? `<span class="hl" id="${wid}-hl"></span>` : ""}<span class="wt">${escapeHtml(k.t)}</span></span>`;
  }).join("")}</div>`).join("");
  return { html, words };
}

type Built = { html: string; js: string[] };

export function buildMotionComposition(input: MotionSpec, opts: MotionCompositionOptions): string {
  const parsed = parseMotionSpec(input);
  if (!parsed.ok) throw new Error(parsed.errors.join(" "));
  const spec = parsed.spec;
  const base = opts.assetBase.replace(/\/$/, "");
  const R = RHYTHM[spec.settings.rythme];
  const durs = sceneDurations(spec);
  const starts = sceneStarts(spec);
  const total = r3(durs.reduce((n, d) => n + d, 0));
  const mascot = spec.settings.presence === "mascotte";
  const js: string[] = [];
  const add = (l: string) => js.push(`        ${l}`);
  const scenesHtml: string[] = [];

  spec.scenes.forEach((s, i) => {
    const t0 = starts[i], d = durs[i];
    const ws = sceneWords(spec, s);
    const voiceEnd = ws[ws.length - 1]?.end ?? d * 0.7;
    const at = (needle: string | undefined, fb: number) => r3(t0 + Math.max(0.1, wordTime(ws, needle, fb)));
    const b = buildScene(spec, s, i, ws, { t0, d, voiceEnd, at, R, base });
    scenesHtml.push(b.html);
    // visibilité de la scène + poussée caméra continue + sortie orientée (sauf CTA tenu et signature)
    add(`tl.set("#sc${i}", { autoAlpha: 1 }, ${t0});`);
    if (i < spec.scenes.length - 1) add(`tl.set("#sc${i}", { autoAlpha: 0 }, ${r3(t0 + d)});`);
    if (s.visual !== "signature") add(`tl.fromTo("#cam${i}", { scale: 1 }, { scale: ${R.push}, duration: ${d}, ease: "none" }, ${t0});`);
    if (R.exit && !["cta", "signature"].includes(s.visual) && i < spec.scenes.length - 1) {
      add(`tl.to("#ex${i}", { y: -34, scale: 1.02, duration: ${R.exit}, ease: "power2.in" }, ${r3(t0 + d - R.exit)});`);
    }
    if (spec.settings.rythme === "tres_dynamique" && i > 0) add(`tl.fromTo("#ex${i}", { x: 70 }, { x: 0, duration: 0.3, ease: "expo.out", immediateRender: false }, ${t0});`);
    b.js.forEach(add);
  });

  // ── Sous-titres : petites unités de sens (3 à 5 mots), un seul mot bleu à la fois, bas centre (y 1240-1450).
  const groups: { start: number; end: number; words: (MotionWord & { abs: number; absEnd: number })[] }[] = [];
  spec.scenes.forEach((s, i) => {
    const ws = sceneWords(spec, s).map((w) => ({ ...w, abs: r3(starts[i] + w.start), absEnd: r3(starts[i] + w.end) }));
    let cur: typeof ws = [];
    const flush = () => { if (cur.length) groups.push({ start: cur[0].abs, end: 0, words: cur }); cur = []; };
    ws.forEach((w, k) => {
      if (cur.length && (cur.length >= 4 || w.abs - cur[cur.length - 1].absEnd > 0.28)) flush();
      cur.push(w);
      if (/[.?!,;:]$/.test(w.text) && cur.length >= 2) flush();
      if (k === ws.length - 1) flush();
    });
  });
  groups.forEach((g, k) => { g.end = r3(Math.min(groups[k + 1]?.start ?? total, g.words[g.words.length - 1]!.absEnd + 0.35)); });
  const capHtml = groups.map((g, k) => `<div class="cg" id="cg${k}"><div class="cp">${g.words.map((w, j) => `<span class="cw" id="cw${k}-${j}">${escapeHtml(w.text)}</span>`).join(" ")}</div></div>`).join("");
  groups.forEach((g, k) => {
    add(`tl.set("#cg${k}", { autoAlpha: 1 }, ${g.start});`);
    add(`tl.fromTo("#cg${k} .cp", { y: 16, scale: 0.95 }, { y: 0, scale: 1, duration: 0.2, ease: "power3.out", immediateRender: false }, ${g.start});`);
    add(`tl.set("#cg${k}", { autoAlpha: 0 }, ${g.end});`);
    g.words.forEach((w, j) => {
      add(`tl.set("#cw${k}-${j}", { className: "cw on" }, ${w.abs});`);
      add(`tl.set("#cw${k}-${j}", { className: "cw done" }, ${g.words[j + 1]?.abs ?? g.end});`);
    });
  });

  // ── Mascotte officielle : saute d'une zone libre à l'autre, réagit au mot pivot, cligne, montre le mot-clé, part avant la signature.
  if (mascot) {
    const sigIdx = spec.scenes.length - 1;
    const pos = (v: MotionVisual) => ({ x: MASCOT_SLOT[v].x - MASCOT.w / 2, y: MASCOT_SLOT[v].y - MASCOT.h / 2 });
    spec.scenes.forEach((s, i) => {
      if (i === sigIdx) return;
      const t0 = starts[i], p = pos(s.visual);
      const ws = sceneWords(spec, s);
      if (i === 0) add(`tl.fromTo("#bee", { x: ${p.x}, y: ${p.y + 60}, autoAlpha: 0, scale: 0.6 }, { x: ${p.x}, y: ${p.y}, autoAlpha: 1, scale: 1, duration: 0.4, ease: "back.out(1.6)" }, 0.15);`);
      else {
        const prev = pos(spec.scenes[i - 1].visual);
        add(`tl.to("#bee", { x: ${p.x}, duration: 0.42, ease: "power3.inOut" }, ${r3(t0 - 0.12)});`);
        add(`tl.to("#bee", { keyframes: [{ y: ${Math.min(p.y, prev.y) - 140}, duration: 0.21, ease: "power2.out" }, { y: ${p.y}, duration: 0.21, ease: "power2.in" }] }, ${r3(t0 - 0.12)});`);
        add(`tl.fromTo("#bee-body", { scaleX: 1.08, scaleY: 0.92 }, { scaleX: 1, scaleY: 1, duration: 0.3, ease: "power3.out", immediateRender: false }, ${r3(t0 + 0.3)});`);
      }
      add(`tl.set("#bee-img", { filter: "${s.visual === "chapitre" ? "drop-shadow(0 0 18px rgba(255,255,255,0.95)) drop-shadow(0 0 6px #FFFFFF)" : "drop-shadow(0 14px 18px rgba(40,81,255,0.22))"}" }, ${r3(t0 + 0.05)});`);
      const pv = r3(t0 + wordTime(ws, s.pivot, durs[i] * 0.4));
      add(`tl.to("#bee-hop", { keyframes: [{ y: -38, scaleY: 1.06, scaleX: 0.95, duration: 0.14, ease: "power2.out" }, { y: 0, scaleY: 0.93, scaleX: 1.07, duration: 0.14, ease: "power2.in" }, { scaleY: 1, scaleX: 1, duration: 0.16, ease: "power2.out" }] }, ${r3(pv - 0.04)});`);
      add(`tl.to("#bee-lean", { keyframes: [{ rotation: -6, duration: 0.12 }, { rotation: 4, duration: 0.14 }, { rotation: 0, duration: 0.2 }], ease: "sine.inOut" }, ${r3(pv + 0.06)});`);
      const blinks = s.visual === "cta" ? [pv + 0.85, pv + 1.1] : durs[i] > 4.5 ? [t0 + durs[i] * 0.3, t0 + durs[i] * 0.78] : [t0 + durs[i] * 0.62];
      const done: number[] = [];
      blinks.forEach((bt) => {
        const tb = Math.abs(bt - pv) < 0.6 && s.visual !== "cta" ? pv + 0.7 : bt;
        if (tb > t0 + durs[i] - 0.45 || done.some((x) => Math.abs(x - tb) < 0.3)) return;
        done.push(tb);
        add(`tl.fromTo(".bee-lid", { yPercent: -105 }, { yPercent: 0, duration: 0.07, ease: "power2.in", immediateRender: false }, ${r3(tb)});`);
        add(`tl.to(".bee-lid", { yPercent: -105, duration: 0.09, ease: "power2.out" }, ${r3(tb + 0.07)});`);
      });
      if (s.visual === "cta") add(`tl.to("#bee-lean", { rotation: -12, duration: 0.25, ease: "power2.out" }, ${r3(pv + 0.5)});`);
    });
    const out = starts[sigIdx];
    add(`tl.to("#bee", { y: -320, duration: 0.45, ease: "power3.in" }, ${r3(out - 0.45)});`);
    add(`tl.set("#bee", { autoAlpha: 0 }, ${out});`);
    add(`tl.fromTo("#bee-float", { y: 0 }, { y: -7, duration: 0.6, ease: "sine.inOut", repeat: ${Math.max(1, Math.floor(out / 0.6) - 1)}, yoyo: true }, 0);`);
  }
  // Même fin que les Reels (2026-11-10) : vidéo de fin officielle BeeRecos après la dernière scène.
  add(`tl.set("#end-video", { autoAlpha: 1 }, ${total});`);
  add(`tl.set({}, {}, ${endTotal(total)});`);

  const voices = spec.scenes.map((s, i) => {
    const a = spec.assets?.voice?.[s.id];
    if (!a || !currentVoiceAsset(a, s.voice, spec.voice.speed)) return "";
    const src = opts.resolveVoice ? opts.resolveVoice(a.src, s.id) : a.src;
    return `<audio id="vo-${escapeHtml(s.id)}" src="${escapeHtml(src)}" data-start="${starts[i]}" data-duration="${r3(Math.min(a.duration, durs[i]))}" data-track-index="2" data-volume="1"></audio>`;
  }).filter(Boolean);
  const weights = [400, 500, 600];
  const fonts = weights.map((w) => `@font-face { font-family: "${FONT_FAMILY}"; font-weight: ${w}; font-display: block; src: url("${base}/fonts/poppins-latin-${w}-normal.woff2") format("woff2"); }`).join("\n      ");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${escapeHtml(spec.title)}</title>
    <script src="${base}/gsap-3.14.2.min.js"></script>${opts.preview ? `\n    <script src="${base}/hyperframe.runtime-0.8.126.iife.js"></script>` : ""}
    <style>
      ${fonts}
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; background: ${C.white}; font-family: "${FONT_FAMILY}", sans-serif; -webkit-font-smoothing: antialiased; overflow: hidden; }
      #root { position: absolute; inset: 0; overflow: hidden; background: ${C.white}; }
      .sc { position: absolute; inset: 0; visibility: hidden; opacity: 0; }
      .bg { position: absolute; inset: 0; background: ${C.white}; }
      .bg.blue { background: ${C.blue}; } .bg.soft { background: ${C.bg}; }
      .ex, .cam { position: absolute; inset: 0; transform-origin: 50% 40%; }
      .blk { position: absolute; left: ${X0}px; width: ${X1 - X0}px; color: ${C.black}; }
      .tl { white-space: nowrap; font-weight: 400; letter-spacing: -0.01em; line-height: ${LH}; }
      .tl.center { text-align: center; }
      .w { position: relative; display: inline-block; }
      .w .wt { position: relative; z-index: 1; }
      .w.pv { color: ${C.blue}; font-weight: 600; }
      .w.lt { color: ${C.white}; } .w.lt.pv { color: ${C.white}; }
      .hl { position: absolute; left: -0.12em; right: -0.12em; top: 0.12em; bottom: 0.04em; background: ${C.pale}; border-radius: 14px; z-index: 0; transform-origin: 0 50%; }
      .w.lt .hl { background: rgba(255,255,255,0.18); }
      .sub { position: absolute; left: ${X0}px; width: ${X1 - X0}px; font-size: 48px; font-weight: 400; color: ${C.mut}; line-height: 1.25; }
      .sub.center { text-align: center; } .sub.lt { color: rgba(255,255,255,0.82); }
      .card { position: absolute; display: flex; align-items: center; gap: 22px; padding: 0 30px; border-radius: 32px; background: ${C.white}; border: 2px solid ${C.line}; font-size: 54px; font-weight: 500; color: ${C.black}; }
      .card.soft { background: ${C.bg}; border-color: ${C.bg}; }
      .card.on { border-color: ${C.blue}; }
      .card.blueText { color: ${C.blue}; }
      .ico { flex: none; width: 76px; height: 76px; border-radius: 20px; background: ${C.pale}; color: ${C.blue}; display: grid; place-items: center; }
      .ico svg { width: 42px; height: 42px; }
      .av { position: absolute; border-radius: 50%; background: ${C.pale}; display: grid; place-items: center; }
      .av svg { width: 62%; height: 62%; }
      .av .on { position: absolute; inset: 0; border-radius: 50%; background: ${C.blue}; opacity: 0; display: grid; place-items: center; }
      .chip { position: absolute; width: 88px; height: 88px; border-radius: 22px; background: ${C.pale}; color: ${C.blue}; font-size: 46px; font-weight: 500; display: grid; place-items: center; }
      svg.links { position: absolute; inset: 0; width: ${W}px; height: ${H}px; overflow: visible; }
      svg.links path { fill: none; stroke: ${C.blue}; stroke-width: 6; stroke-linecap: round; }
      svg.links path.grey { stroke: ${C.line}; }
      .logo { position: absolute; display: block; }
      .ctac { position: absolute; left: 150px; width: 720px; top: 470px; height: 640px; border-radius: 40px; background: ${C.white}; border: 3px solid ${C.blue}; text-align: center; }
      .ctac .v { margin-top: 92px; font-size: 64px; font-weight: 500; color: ${C.black}; }
      .ctac .k { margin-top: 26px; font-weight: 600; color: ${C.blue}; line-height: 1; display: inline-block; }
      .ctac .u { margin: 26px auto 0; height: 10px; width: 62%; border-radius: 5px; background: ${C.blue}; transform-origin: 0 50%; }
      .ctac .sep { margin: 54px auto 0; width: 120px; height: 3px; background: ${C.line}; }
      .ctac .c { margin-top: 44px; font-size: 44px; color: ${C.mut}; padding: 0 40px; }
      #caps { position: absolute; left: 0; right: 0; top: ${CAP_TOP}px; height: ${CAP_H}px; z-index: 20; }
      .cg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; visibility: hidden; opacity: 0; }
      .cp { max-width: 820px; padding: 18px 40px 22px; border-radius: 20px; background: ${C.white}; border: 2px solid ${C.line}; font-size: 54px; font-weight: 500; line-height: 1.2; text-align: center; letter-spacing: -0.01em; }
      .cw { display: inline-block; padding: 0 0.14em; border-radius: 0.28em; color: ${C.mut}; }
      .cw.on { color: ${C.white}; background: ${C.blue}; }
      .cw.done { color: ${C.black}; }
      #bee { position: absolute; left: 0; top: 0; width: ${MASCOT.w}px; height: ${MASCOT.h}px; z-index: 15; visibility: hidden; opacity: 0; }
      #bee-float, #bee-lean, #bee-hop, #bee-body { position: absolute; inset: 0; transform-origin: 50% 100%; }
      #bee-img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      .bee-eye { position: absolute; border-radius: 50%; overflow: hidden; }
      .bee-eye.l { left: 13.2%; top: 60.9%; width: 20.3%; height: 15%; }
      .bee-eye.r { left: 38.8%; top: 59.4%; width: 18.5%; height: 14.4%; }
      .bee-lid { position: absolute; inset: 0; background: linear-gradient(180deg, #3A66FF 0%, #2851FF 70%, #1E40D8 100%); }
      .bee-lid svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${endTotal(total)}" data-fps="${FRAME.fps}">
      ${scenesHtml.join("\n      ")}
      <div id="caps" aria-hidden="true">${capHtml}</div>
      ${mascot ? `<div id="bee" aria-hidden="true"><div id="bee-float"><div id="bee-lean"><div id="bee-hop"><div id="bee-body">
        <img id="bee-img" src="${base}/${MASCOT.file}" alt="" />
        ${["l", "r"].map((e) => `<div class="bee-eye ${e}" data-layout-ignore><div class="bee-lid"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M14 52 Q50 74 86 52" fill="none" stroke="#14246E" stroke-width="7" stroke-linecap="round" /></svg></div></div>`).join("")}
      </div></div></div></div></div>` : ""}
      ${opts.soundtrackSrc ? `<audio id="soundtrack" src="${escapeHtml(opts.soundtrackSrc)}" data-start="0" data-duration="${total}" data-track-index="1" data-volume="0.7"></audio>` : ""}
      ${endVideoClip(base, total)}
      ${voices.join("\n      ")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      Promise.all([400, 500, 600].map((w) => document.fonts.load(w + " 100px ${FONT_FAMILY}"))).catch(() => {}).then(() => {
        const tl = gsap.timeline({ paused: true });
        tl.set(".bee-lid", { yPercent: -105 }, 0);
${js.join("\n")}
        window.__timelines["main"] = tl;
        if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
      });
    </script>
  </body>
</html>
`;
}

type Ctx = { t0: number; d: number; voiceEnd: number; at: (needle: string | undefined, fb: number) => number; R: (typeof RHYTHM)[keyof typeof RHYTHM]; base: string };

function buildScene(spec: MotionSpec, s: MotionScene, i: number, ws: MotionWord[], ctx: Ctx): Built {
  const { t0, d, voiceEnd, at, R, base } = ctx;
  const js: string[] = [];
  const texte = spec.settings.texte;
  const tone: "dark" | "light" = s.visual === "chapitre" ? "light" : "dark";
  const id = `t${i}`;
  const enterWords = (wids: string[], words: string[], from: string, startAt?: number) => {
    let t = startAt ?? r3(t0 + 0.15);
    wids.forEach((wid, k) => {
      const spoken = at(words[k], -1);
      const target = spoken > t0 + 0.1 ? spoken - 0.05 : t;
      t = r3(Math.max(k ? t + R.stagger : t, Math.min(target, t0 + d - 0.6)));
      js.push(`tl.fromTo("#${wid}", { ${from}, autoAlpha: 0 }, { y: 0, x: 0, autoAlpha: 1, duration: ${r3(R.entry * 0.5)}, ease: "expo.out", immediateRender: false }, ${t});`);
      js.push(`tl.set("#${wid}", { autoAlpha: 0 }, ${t0});`);
    });
    return t;
  };
  const punch = (sel: string, word: string | undefined, fb: number) => {
    const t = at(word, fb);
    js.push(`tl.to("${sel}", { keyframes: [{ scale: ${R.punch}, duration: 0.13, ease: "power2.out" }, { scale: 1, duration: 0.17, ease: "power2.inOut" }] }, ${r3(t)});`);
  };
  const cardIn = (cid: string, t: number, tilt: number) => {
    js.push(`tl.set("#${cid}", { autoAlpha: 0 }, ${t0});`);
    js.push(`tl.fromTo("#${cid}", { autoAlpha: 0, y: 50, rotation: ${tilt}, rotationX: 6, scale: 0.94 }, { autoAlpha: 1, y: 0, rotation: 0, rotationX: 0, scale: 1, duration: ${r3(R.entry * 1.15)}, ease: "expo.out", immediateRender: false }, ${r3(t)});`);
  };
  /** Instant d'une carte : quand la voix dit son premier mot, sinon réparti sur la phrase. */
  const itemAt = (label: string, k: number, n: number, from: number) => {
    const first = label.split(/\s+/).find((w) => w.length > 2) ?? label;
    const spoken = at(first, -1);
    return spoken > t0 + 0.1 ? r3(spoken - 0.04) : r3(t0 + from + ((voiceEnd - from) * (k + 0.5)) / n);
  };

  const title = shownTitle(s, texte);
  const sub = texte === "riche" && s.subtitle ? s.subtitle : "";
  const items = s.items ?? [];
  let body = "";
  let bg = "";

  const placeTitle = (top: number, maxH: number, align: "left" | "center", width: number = X1 - X0, max = 132, left: number = X0) => {
    if (!title) return { h: 0 };
    const lines = fitBlock(title, 400, texte === "minimal" ? 190 : max, texte === "minimal" ? 150 : 96, maxH, width);
    const t = titleHtml(id, lines, align, tone);
    body += `<div class="blk" id="${id}" style="top:${top}px;left:${left}px;width:${width}px">${t.html}</div>`;
    const wids: string[] = [];
    lines.forEach((l, li) => l.tokens.forEach((_, j) => wids.push(`${id}-w${li}-${j}`)));
    const last = enterWords(wids, t.words, "y: 48");
    const pvIdx = lines.flatMap((l) => l.tokens).findIndex((k) => k.em);
    if (pvIdx >= 0) {
      const pid = wids[pvIdx];
      js.push(`tl.fromTo("#${pid}-hl", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power3.out", immediateRender: false }, ${r3(Math.max(at(s.pivot, 0.5), t0 + 0.2) + 0.05)});`);
      js.push(`tl.set("#${pid}-hl", { scaleX: 0 }, ${t0});`);
      punch(`#${pid}`, s.pivot, 0.6);
    }
    void last;
    return { h: blockH(lines) };
  };
  const placeSub = (top: number, align: "left" | "center") => {
    if (!sub) return;
    body += `<div class="sub ${align}${tone === "light" ? " lt" : ""}" id="${id}-sub" style="top:${top}px">${escapeHtml(sub)}</div>`;
    const t = Math.max(t0 + 0.6, voiceEnd * 0.5 + t0);
    js.push(`tl.set("#${id}-sub", { autoAlpha: 0 }, ${t0});`);
    js.push(`tl.fromTo("#${id}-sub", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: ${r3(R.entry)}, ease: "power3.out", immediateRender: false }, ${r3(t)});`);
  };

  switch (s.visual) {
    case "titre": {
      const th = placeTitle(Y0 + 30, 380, "center");
      placeSub(Y0 + 40 + th.h + 20, "center");
      const cardY = Math.max(700, Y0 + 60 + th.h + (sub ? 90 : 30));
      if (items[0]) {
        body += `<div class="card soft" id="${id}-c0" style="left:${X0 + 40}px;top:${cardY}px;height:128px;width:620px"><span class="ico" style="background:${C.blue};color:${C.white}">${PERSON(C.white).replace('viewBox', 'style="width:40px;height:40px" viewBox')}</span>${escapeHtml(items[0])}</div>`;
        cardIn(`${id}-c0`, itemAt(items[0], 0, 1, 0.9), 5);
      }
      [[190, 1010], [420, 1090], [640, 1000]].forEach(([x, y], k) => {
        body += `<div class="av" id="${id}-p${k}" style="left:${x - 56}px;top:${y - 56}px;width:112px;height:112px">${PERSON(C.blue)}</div>`;
        cardIn(`${id}-p${k}`, r3(t0 + Math.min(d - 0.8, voiceEnd * 0.55) + k * 0.08), 0);
      });
      body += `<svg class="links" aria-hidden="true"><path id="${id}-lk" d="M 560 ${cardY + 64} C 640 ${cardY + 64}, 660 ${(cardY + 1000) / 2}, 640 944" /></svg>`;
      js.push(`tl.set("#${id}-lk", { strokeDasharray: 600, strokeDashoffset: 600 }, ${t0});`);
      js.push(`tl.to("#${id}-lk", { strokeDashoffset: 0, duration: 0.3, ease: "power2.inOut" }, ${r3(t0 + Math.min(d - 0.6, voiceEnd * 0.75))});`);
      break;
    }
    case "relation": {
      const [a = "Toi", b2 = "Ton contact"] = items;
      body += `<div class="card soft" id="${id}-a" style="left:${X0 + 20}px;top:${Y0 + 40}px;height:128px;width:430px"><span class="ico" style="background:${C.blue};color:${C.white}">${PERSON(C.white).replace('viewBox', 'style="width:40px;height:40px" viewBox')}</span>${escapeHtml(a)}</div>`;
      body += `<div class="card soft" id="${id}-b" style="left:390px;top:${Y0 + 290}px;height:128px;width:${X1 - 390}px"><span class="ico">${PERSON(C.blue).replace('viewBox', 'style="width:40px;height:40px" viewBox')}</span>${escapeHtml(b2)}</div>`;
      body += `<svg class="links" aria-hidden="true"><path id="${id}-lk" d="M 300 ${Y0 + 168} C 300 ${Y0 + 290}, 300 ${Y0 + 354}, 390 ${Y0 + 354}" /></svg>`;
      cardIn(`${id}-a`, r3(t0 + 0.25), -6);
      cardIn(`${id}-b`, r3(t0 + 0.55), 6);
      js.push(`tl.set("#${id}-lk", { strokeDasharray: 400, strokeDashoffset: 400 }, ${t0});`);
      js.push(`tl.to("#${id}-lk", { strokeDashoffset: 0, duration: 0.28, ease: "power2.inOut" }, ${r3(t0 + 0.85)});`);
      placeTitle(Y0 + 520, 420, "center");
      break;
    }
    case "marque": {
      const lw = 700, lh = Math.round(lw * LOGOS.endHorizontal.ratio);
      body += `<img class="logo" id="${id}-logo" src="${base}/${LOGOS.endHorizontal.file}" alt="BeeRecos" style="left:${(W - lw) / 2 - 40}px;top:500px;width:${lw}px;height:${lh}px" />`;
      const lt = at("BeeRecos", 0.6);
      js.push(`tl.set("#${id}-logo", { autoAlpha: 0 }, ${t0});`);
      js.push(`tl.fromTo("#${id}-logo", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, ${r3(lt - 0.08)});`);
      const th = placeTitle(780, 260, "center", 760, 100, (W - 760) / 2 - 40);
      placeSub(800 + th.h, "center");
      items.slice(0, 3).forEach((c, k) => {
        const x = W / 2 - 40 - 172 + k * 128 - 44 + 44;
        body += `<div class="chip" id="${id}-k${k}" style="left:${x}px;top:${Math.max(1000, 800 + th.h + 40)}px">${escapeHtml(c.slice(0, 2))}</div>`;
        cardIn(`${id}-k${k}`, r3(lt + 0.35 + k * 0.08), -6);
      });
      break;
    }
    case "liste":
    case "chapitre": {
      if (s.visual === "chapitre") bg = "blue";
      const th = placeTitle(Y0 + 30, 380, "left", 620);
      placeSub(Y0 + 40 + th.h + 10, "left");
      const top0 = Math.max(Y0 + 60 + th.h + (sub ? 80 : 20), 620);
      const gap = Math.min(150, (Y1 - top0) / Math.max(1, items.length));
      items.forEach((label, k) => {
        const cls = s.visual === "chapitre" ? "card blueText" : "card";
        body += `<div class="${cls}" id="${id}-c${k}" style="left:${X0}px;top:${Math.round(top0 + k * gap)}px;height:${Math.min(124, gap - 22)}px;width:${X1 - X0}px"><span class="ico">${`<svg viewBox="0 0 24 24">${ICONS[k % 3]}</svg>`}</span>${escapeHtml(label)}</div>`;
        const t = itemAt(label, k, items.length, 1);
        cardIn(`${id}-c${k}`, t, k % 2 ? 5 : -5);
        js.push(`tl.set("#${id}-c${k}", { className: "${cls} on" }, ${t});`);
        if (k + 1 < items.length) js.push(`tl.set("#${id}-c${k}", { className: "${cls}" }, ${itemAt(items[k + 1], k + 1, items.length, 1)});`);
      });
      break;
    }
    case "piliers": {
      const [a = "Réseau", b2 = "Formation", c = "Digitalisation IA"] = items;
      const sat = [{ x: 290, y: 300, w: 400, l: a }, { x: X0, y: 900, w: 380, l: b2 }, { x: 530, y: 900, w: 380, l: c }];
      body += `<svg class="links" aria-hidden="true">${sat.map((p, k) => `<path id="${id}-l${k}" d="M ${p.x + p.w / 2} ${p.y + (k ? 0 : 128)} L 540 ${k ? 760 : 620}" />`).join("")}</svg>`;
      sat.forEach((p, k) => {
        body += `<div class="card" id="${id}-s${k}" style="left:${p.x}px;top:${p.y}px;height:128px;width:${p.w}px;justify-content:center;flex-direction:column;gap:6px;padding:0 20px;font-size:${fitSize(p.l, 400, p.w - 50, 44, 30)}px"><span>${escapeHtml(p.l)}</span></div>`;
        cardIn(`${id}-s${k}`, itemAt(["rencontres", "compétences", "outils"][k], k, 3, 0.3), k === 1 ? -5 : 5);
      });
      const mt = at("piliers", voiceEnd * 0.7);
      body += `<div class="card" id="${id}-m" style="left:290px;top:620px;height:140px;width:500px;justify-content:center;background:${C.blue};border-color:${C.blue};color:${C.white};font-size:${fitSize(s.title || "Ton activité", 400, 440, 56, 32)}px">${escapeHtml(s.title || "Ton activité")}</div>`;
      cardIn(`${id}-m`, r3(Math.min(mt - 0.3, t0 + d - 1)), 0);
      sat.forEach((_, k) => {
        js.push(`tl.set("#${id}-l${k}", { strokeDasharray: 400, strokeDashoffset: 400 }, ${t0});`);
        js.push(`tl.to("#${id}-l${k}", { strokeDashoffset: 0, duration: 0.25, ease: "power2.out" }, ${r3(Math.min(mt, t0 + d - 0.7) + k * 0.07)});`);
      });
      punch(`#${id}-m`, s.pivot, voiceEnd * 0.85);
      break;
    }
    case "personnes": {
      const th = placeTitle(Y0 + 30, 300, "center", 620, 112, 290);
      void th;
      body += `<div class="av" id="${id}-ring" style="left:315px;top:680px;width:450px;height:450px;background:${C.pale}"></div>`;
      js.push(`tl.set("#${id}-ring", { autoAlpha: 0 }, ${t0});`);
      js.push(`tl.fromTo("#${id}-ring", { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "expo.out", immediateRender: false }, ${r3(t0 + 0.1)});`);
      const n = 7;
      for (let k = 0; k < n; k++) {
        const ang = (-90 + (360 / n) * k) * (Math.PI / 180);
        const cx = 540 + Math.cos(ang) * 250, cy = 905 + Math.sin(ang) * 250;
        body += `<div class="av" id="${id}-p${k}" style="left:${Math.round(cx - 54)}px;top:${Math.round(cy - 54)}px;width:108px;height:108px;background:${C.white};border:2px solid ${C.line}">${PERSON(C.mut)}<span class="on" id="${id}-p${k}-on">${PERSON(C.white)}</span></div>`;
        cardIn(`${id}-p${k}`, r3(t0 + 0.2 + ((voiceEnd - 0.2) * k) / n), 0);
      }
      [[1, s.pivot], [4, ws[ws.length - 1]?.text]].forEach(([k, w]) => js.push(`tl.to("#${id}-p${k}-on", { opacity: 1, duration: 0.2 }, ${at(w as string, voiceEnd * 0.6)});`));
      js.push(`tl.fromTo("#${id}-ring", { rotation: 0 }, { rotation: 10, duration: ${d}, ease: "none", immediateRender: false }, ${t0});`);
      break;
    }
    case "cta": {
      bg = "soft";
      const kw = spec.cta.keyword;
      const ks = Math.min(170, fitSize(kw, 600, 600, 170, 80));
      body += `<div class="ctac" id="${id}-card"><div class="v" id="${id}-v">${escapeHtml(s.title || "Commente")}</div><div class="k" id="${id}-k" style="font-size:${ks}px">${escapeHtml(kw)}</div><div class="u" id="${id}-u"></div><div class="sep" id="${id}-sep"></div><div class="c" id="${id}-c">${escapeHtml(spec.cta.complement || s.subtitle || "")}</div></div>`;
      cardIn(`${id}-card`, r3(t0 + 0.05), 6);
      const kt = at(kw, voiceEnd * 0.45);
      const vt = at("Commente", kt - t0 - 0.45);
      ["v", "c", "sep"].forEach((p) => js.push(`tl.set("#${id}-${p}", { autoAlpha: 0 }, ${t0});`));
      js.push(`tl.fromTo("#${id}-v", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power4.out", immediateRender: false }, ${r3(vt - 0.05)});`);
      js.push(`tl.set("#${id}-k", { autoAlpha: 0, scale: 0.92 }, ${t0});`);
      js.push(`tl.to("#${id}-k", { keyframes: [{ autoAlpha: 1, scale: 1.06, duration: 0.13, ease: "power2.out" }, { scale: 1, duration: 0.2, ease: "power2.inOut" }] }, ${r3(kt - 0.05)});`);
      js.push(`tl.fromTo("#${id}-u", { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "expo.out", immediateRender: false }, ${r3(kt + 0.3)});`);
      js.push(`tl.set("#${id}-u", { scaleX: 0 }, ${t0});`);
      js.push(`tl.fromTo("#${id}-sep", { autoAlpha: 0, scaleX: 0.4 }, { autoAlpha: 1, scaleX: 1, duration: 0.4, ease: "power2.out", immediateRender: false }, ${r3(kt + 0.8)});`);
      js.push(`tl.fromTo("#${id}-c", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", immediateRender: false }, ${r3(Math.min(t0 + voiceEnd - 0.6, kt + 1.2))});`);
      const breath = r3(t0 + voiceEnd + 0.3);
      if (breath + 1.2 < t0 + d) js.push(`tl.to("#${id}-k", { keyframes: [{ scale: 1.03, duration: 0.6, ease: "sine.inOut" }, { scale: 1, duration: 0.6, ease: "sine.inOut" }] }, ${breath});`);
      break;
    }
    case "signature": {
      const lw = 740, lh = Math.round(lw * LOGOS.endHorizontal.ratio), bw = 620, bh = Math.round(bw * BASELINE.ratio);
      body += `<img class="logo" id="${id}-logo" src="${base}/${LOGOS.endHorizontal.file}" alt="BeeRecos" style="left:${(W - lw) / 2}px;top:660px;width:${lw}px;height:${lh}px" />`;
      body += `<div id="${id}-bm" style="position:absolute;left:${(W - bw) / 2}px;top:${660 + lh + 48}px;width:${bw}px;height:${bh}px;overflow:hidden"><img class="logo" src="${base}/${BASELINE.file}" alt="#MonReseauCestTonReseau" style="left:0;top:0;width:${bw}px;height:${bh}px" /></div>`;
      js.push(`tl.set(["#${id}-logo", "#${id}-bm"], { autoAlpha: 0 }, ${t0});`);
      js.push(`tl.fromTo("#${id}-logo", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out", immediateRender: false }, ${r3(t0 + 0.12)});`);
      js.push(`tl.set("#${id}-bm", { autoAlpha: 1 }, ${r3(at("réseau", 1.2) - 0.1)});`);
      js.push(`tl.fromTo("#${id}-bm", { clipPath: "inset(-10% 100% -10% 0%)" }, { clipPath: "inset(-10% 0% -10% 0%)", duration: 0.6, ease: "power1.inOut", immediateRender: false }, ${r3(at("réseau", 1.2) - 0.1)});`);
      break;
    }
  }

  const html = `<div class="sc" id="sc${i}" aria-label="Scène ${i + 1}"><div class="bg${bg ? ` ${bg}` : ""}"></div><div class="ex" id="ex${i}"><div class="cam" id="cam${i}">${body}</div></div></div>`;
  return { html, js };
}

/** Plan de la vidéo (pour la fiche de contrôle et le storyboard du montage) : scène, début, fin, voix, écran. */
export function motionPlan(spec: MotionSpec) {
  const d = sceneDurations(spec), st = sceneStarts(spec);
  return spec.scenes.map((s, i) => ({ id: s.id, visual: s.visual, start: st[i], end: r3(st[i] + d[i]), voice: s.voice, screen: shownTitle(s, spec.settings.texte).replace(/\*/g, ""), pivot: s.pivot ?? "" }));
}


/** Fichiers de public/hyperframes/ nécessaires au rendu d'une vidéo de ce style (voix et bande son en plus). */
export const MOTION_ASSETS: string[] = [
  "fonts/poppins-latin-400-normal.woff2", "fonts/poppins-latin-500-normal.woff2", "fonts/poppins-latin-600-normal.woff2",
  "gsap-3.14.2.min.js", LOGOS.endHorizontal.file, BASELINE.file, MASCOT.file, END_VIDEO.file,
];

/** Sous-titres SRT (fichier séparé demandé par le prompt) : une réplique par segment de phrase, temps de la voix réelle. */
export function motionSrt(spec: MotionSpec): string {
  const st = sceneStarts(spec);
  const cues: { a: number; b: number; t: string }[] = [];
  spec.scenes.forEach((s, i) => {
    let cur: MotionWord[] = [];
    const flush = () => { if (cur.length) cues.push({ a: st[i] + cur[0].start, b: st[i] + cur[cur.length - 1].end, t: cur.map((w) => w.text).join(" ") }); cur = []; };
    sceneWords(spec, s).forEach((w) => {
      if (/^[?!»]$/.test(w.text) && cur.length) { cur[cur.length - 1] = { ...cur[cur.length - 1], text: `${cur[cur.length - 1].text} ${w.text}`, end: w.end }; }
      else cur.push(w);
      if ((/[.?!,;:]$/.test(cur[cur.length - 1].text) && cur.length >= 2) || cur.length >= 7) flush();
    });
    flush();
  });
  const ts = (t: number) => { const ms = Math.round(t * 1000); const p = (n: number, l = 2) => String(n).padStart(l, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  return cues.map((c, k) => `${k + 1}\n${ts(c.a)} --> ${ts(Math.min(c.b + 0.15, cues[k + 1]?.a ?? c.b + 0.15))}\n${c.t}\n`).join("\n");
}

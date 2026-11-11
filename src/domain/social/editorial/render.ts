import { END_VIDEO, escapeHtml } from "../montage/brand";
import { easingSource } from "./easings";
import { planStoryboard, SFX_PEAK_MS, type Plan, type PlanEvent } from "./schedule";
import { BG, H, PALETTE, SAFE, TYPE, W, type Background } from "./tokens";
import type { EditorialScene, Storyboard } from "./schema";

/**
 * RENDU Editorial Impact : plan minuté → composition HyperFrames (HTML + timeline GSAP en pause). Tout est piloté par
 * la timeline (aucun setTimeout, aucune animation CSS libre) : l'aperçu, la capture image par image et le rendu MP4
 * donnent la même image au même instant. Charte : Poppins seule, BeeRecos (B et R majuscules), bleu #2851FF.
 */
const SKEW_DEG = 9;
const SKEW_PX = Math.round(Math.tan((SKEW_DEG * Math.PI) / 180) * H); // décalage haut/bas du front diagonal
const BAND = Math.round(W * 0.16);
export const INNER_W = W - SAFE.left - SAFE.right;
/** Mascotte officielle (454 × 640, fournie par Cédric) : personnage central du Réel (grande, en bas de l'écran). */
export const MASCOT = { file: "brand/beerecos-mascotte.webp", w: 260, h: Math.round((260 * 640) / 454) } as const;
/** Deux places, jamais sous les boutons Instagram (colonne de droite) : à gauche, puis au centre. */
const MASCOT_X = [70, 520] as const;
const MASCOT_TOP = H - SAFE.bottom - MASCOT.h + 60;
/** Taille de la mascotte quand elle se pose sur un mot. */
const PERCH = 0.4;
/** Hauteur retirée à la zone de texte quand la mascotte est là. */
export const MASCOT_RESERVE = H - MASCOT_TOP + 20 - SAFE.bottom;
const s = (msv: number) => Math.round(msv) / 1000;

/** « BeeRecos » toujours écrit ainsi, même dans un titre en capitales. */
export const brandCase = (t: string) => t.replace(/bee\s?recos/gi, "BeeRecos");
const esc = (t: string) => escapeHtml(brandCase(t));

/**
 * Largeur de chaque caractère en Poppins 800, en em, interlettrage −0,03 em compris (mesurée dans Chromium sur la
 * police embarquée). Taille d'une ligne = la plus grande qui tient dans la largeur utile : remplit sans déborder.
 * Un bloc de lignes prend une seule taille (la plus petite qui fait tenir chaque ligne) : bloc net.
 */
const W800: Record<string, number> = {
  " ": 0.161, A: 0.725, B: 0.641, C: 0.728, D: 0.705, E: 0.518, F: 0.531, G: 0.727, H: 0.713, I: 0.278, J: 0.554, K: 0.696,
  L: 0.461, M: 0.905, N: 0.735, O: 0.757, P: 0.606, Q: 0.758, R: 0.631, S: 0.59, T: 0.574, U: 0.682, V: 0.717, W: 1.046,
  X: 0.709, Y: 0.671, Z: 0.583, Œ: 1.026, "0": 0.627, "1": 0.357, "2": 0.539, "3": 0.58, "4": 0.661, "5": 0.625, "6": 0.605,
  "7": 0.493, "8": 0.623, "9": 0.576, ".": 0.271, ",": 0.284, ";": 0.336, ":": 0.272, "!": 0.393, "?": 0.508, "'": 0.213,
  "’": 0.316, "«": 0.558, "»": 0.558, "-": 0.548, "–": 0.659, "%": 0.874, "€": 0.763, "+": 0.559, "/": 0.396, "&": 0.784,
  "(": 0.44, ")": 0.44, '"': 0.421, "\u00a0": 0.161, "\u202f": 0.1,
};
const base = (c: string) => c.normalize("NFD").charAt(0);
export function textEm(text: string): number {
  let w = 0;
  for (const c of text) w += W800[c] ?? W800[base(c)] ?? (c === c.toLowerCase() && c !== c.toUpperCase() ? 0.58 : 0.76);
  return w;
}
export function fit(text: string, max: number, width = INNER_W): number {
  return Math.max(40, Math.min(max, Math.floor((width * 0.97) / Math.max(textEm(text), 1.5))));
}
const block = (lines: string[], max: number) => Math.min(...lines.map((l) => fit(l, max)));
const formatStat = (v: number, d: number) => v.toFixed(d).replace(".", ",");

function mask(id: string, text: string, size: number, extra = "", cls = "") {
  return `<div class="mask${cls ? ` mask-${cls}` : ""}"><span id="${id}" class="in${cls ? ` ${cls}` : ""}" style="font-size:${size}px${extra}">${text}</span></div>`;
}
function withAccents(line: string, accents: string[]) {
  let out = esc(line);
  for (const a of accents) {
    const re = new RegExp(`(${escapeHtml(brandCase(a)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");
    out = out.replace(re, "<em>$1</em>");
  }
  return out;
}

function sceneHtml(sc: EditorialScene, base: string): string {
  const id = sc.id;
  const align = "layout" in sc && (sc.layout === "center") ? "center" : "left";
  const box = (inner: string, cls = "") => `<div class="content ${align} ${cls}">${inner}</div>`;
  switch (sc.type) {
    case "hook-stat": {
      const statText = `${sc.stat.prefix}${formatStat(sc.stat.value, sc.stat.decimals)}${sc.stat.suffix}`;
      const statSize = fit(statText, sc.layout === "full" ? 460 : 380);
      const small = block([sc.lead ?? "", ...sc.lines].filter(Boolean), 92);
      return box([
        sc.lead ? mask(`${id}-lead`, esc(sc.lead), small, ";font-weight:700") : "",
        // Valeur entière animée (dixièmes si une décimale) : « 4,9 » = 49 dixièmes, affichés par counter().
        `<div class="mask stat-mask"><span id="${id}-stat" class="in stat ${sc.stat.decimals ? "dec" : ""}" data-n="${Math.round(sc.stat.value * 10 ** sc.stat.decimals)}" style="font-size:${statSize}px;--t:0"><b>${escapeHtml(sc.stat.prefix)}</b><span class="num" aria-hidden="true"></span><b>${escapeHtml(sc.stat.suffix)}</b><span class="sr">${escapeHtml(statText)}</span></span></div>`,
        ...sc.lines.map((l, i) => mask(`${id}-l${i}`, esc(l), small, ";font-weight:700")),
        sc.accent ? mask(`${id}-acc`, esc(sc.accent), fit(sc.accent, 120), ";color:var(--accent)") : "",
      ].join(""), sc.layout === "full" ? "full" : "");
    }
    case "statement": {
      const cls = sc.style === "3d" ? "deep" : sc.style === "cartouche" ? "cart" : "";
      // Cartouche : la boîte ajoute un peu de largeur (marges internes) ; taille légèrement réduite.
      const size = Math.round(block(sc.lines, sc.style === "cartouche" ? 120 : 150) * (sc.style === "cartouche" ? 0.86 : 1));
      return box([
        ...sc.lines.map((l, i) => mask(`${id}-l${i}`, withAccents(l, sc.accentWords), size, "", cls)),
        sc.micro ? `<p id="${id}-micro" class="micro">${esc(sc.micro)}</p>` : "",
      ].join(""), sc.layout === "stack" ? "stack" : "");
    }
    case "impact":
      return `<div id="${id}-flash" class="flash"></div>` + box([
        mask(`${id}-word`, esc(sc.word), fit(sc.word, 400), ";color:var(--accent)", "impact"),
        sc.sub ? `<p id="${id}-sub" class="micro">${esc(sc.sub)}</p>` : "",
      ].join(""));
    case "strike": {
      const size = block([sc.before, sc.after], 150);
      return box([
        sc.lead ? mask(`${id}-lead`, esc(sc.lead), Math.min(92, fit(sc.lead, 92)), ";font-weight:700") : "",
        `<div class="mask mask-strike"><span id="${id}-before" class="in" style="font-size:${size}px">${esc(sc.before)}<i id="${id}-line" class="strike-line"></i></span></div>`,
        mask(`${id}-after`, esc(sc.after), size, ";color:var(--accent)"),
        sc.micro ? `<p id="${id}-micro" class="micro">${esc(sc.micro)}</p>` : "",
      ].join(""));
    }
    case "pills":
      return box([
        mask(`${id}-title`, esc(sc.title), fit(sc.title, 116)),
        `<div class="pills ${sc.layout}">${sc.pills.map((p, i) => `<span id="${id}-p${i}" class="pill ${i % 2 ? "pill-b" : "pill-a"}">${esc(p)}</span>`).join("")}</div>`,
      ].join(""));
    case "human":
      return box([
        ...sc.question.map((q, i) => mask(`${id}-q${i}`, esc(q), block(sc.question, 120))),
        mask(`${id}-ans`, esc(sc.answer), fit(sc.answer, 150), ";color:var(--accent)"),
        sc.micro ? `<p id="${id}-micro" class="micro">${esc(sc.micro)}</p>` : "",
      ].join(""), "human");
    case "testimonials":
      return box([
        mask(`${id}-title`, esc(sc.title), fit(sc.title, 104)),
        `<div class="cards ${sc.layout}">${sc.cards.map((c, i) => `<figure id="${id}-c${i}" class="card" style="--tilt:${sc.layout === "diagonal" ? (i % 2 ? 1 : -1) * 1.2 : 0}deg;--dy:${sc.layout === "stack" ? i * 18 : 0}px"><blockquote>« ${esc(c.quote)} »</blockquote><figcaption>${esc(c.author)}</figcaption></figure>`).join("")}</div>`,
        sc.rating ? `<div id="${id}-rating" class="rating"><span class="score">${formatStat(sc.rating.value, 1)} / 5</span><span class="stars">${[0, 1, 2, 3, 4].map((k) => `<i id="${id}-star${k}">★</i>`).join("")}</span>${sc.rating.count ? `<span class="count">${esc(sc.rating.count)}</span>` : ""}</div>` : "",
      ].join(""), "testi");
    case "cta":
      return box([
        ...sc.lines.map((l, i) => mask(`${id}-l${i}`, esc(l), block(sc.lines, 150), i === sc.lines.length - 1 ? ";color:var(--accent)" : "")),
        sc.sub ? `<p id="${id}-sub" class="micro sub">${esc(sc.sub)}</p>` : "",
        sc.brand ? `<img id="${id}-logo" class="logo" src="${base}/brand/beerecos-logo-${sc.background === "light" ? "blue" : "white"}.svg" alt="BeeRecos" />` : "",
        `<span id="${id}-btn" class="cta-btn">${esc(sc.button)}</span>`,
      ].join(""), "cta");
  }
}

/** Tweens GSAP d'un événement (courbes E.* : mêmes cubic-bezier que le moteur). */
function tween(e: PlanEvent): string {
  const t = s(e.atMs), d = s(e.durMs), sel = `"#${e.el}"`, dir = e.dir ?? -1;
  switch (e.anim) {
    case "mask": return `tl.fromTo(${sel}, { yPercent: 105, scale: 0.985, autoAlpha: 0 }, { yPercent: 0, scale: 1, autoAlpha: 1, duration: ${d}, ease: E.editorialOut, immediateRender: false }, ${t});`;
    case "accent": return `tl.fromTo(${sel}, { yPercent: 105, scale: 0.96, autoAlpha: 0 }, { yPercent: 0, scale: 1, autoAlpha: 1, duration: ${d}, ease: E.sharpOut, immediateRender: false }, ${t});`;
    case "counter": return [
      // Sans fonction de rappel (GSAP ne les exécute pas quand on se déplace dans la timeline) : la valeur est une
      // variable CSS entière animée, affichée par counter() — même image en aperçu, en capture et au rendu.
      `tl.set(${sel}, { autoAlpha: 1 }, ${t});`,
      `tl.fromTo(${sel}, { "--t": 0 }, { "--t": +document.querySelector(${sel}).dataset.n, duration: ${d}, ease: E.counter, immediateRender: false }, ${t});`,
      `tl.to(${sel}, { scale: 1.035, duration: 0.067, ease: "power1.out" }, ${s(e.atMs + e.durMs)});`,
      `tl.to(${sel}, { scale: 1, duration: 0.1, ease: "power1.in" }, ${s(e.atMs + e.durMs + 67)});`,
    ].join("\n      ");
    case "pill": return `tl.fromTo(${sel}, { x: ${dir * 55}, scale: 0.955, autoAlpha: 0 }, { x: 0, scale: 1, autoAlpha: 1, duration: ${d}, ease: E.springCard, immediateRender: false }, ${t});`;
    case "cardIn": return `tl.fromTo(${sel}, { x: ${dir * 120}, y: 30, rotation: ${dir * 1.5}, scale: 0.97, autoAlpha: 0 }, { x: 0, y: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: ${d}, ease: E.springCard, immediateRender: false }, ${t});`;
    case "cardOut": return `tl.to(${sel}, { x: ${dir * 80}, scale: 0.985, autoAlpha: 0, duration: ${d}, ease: "power2.in" }, ${t});`;
    case "rise": return `tl.fromTo(${sel}, { y: 100, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: ${d}, ease: E.editorialOut, immediateRender: false }, ${t});`;
    case "star": return `tl.fromTo(${sel}, { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: ${d}, ease: E.sharpOut, immediateRender: false }, ${t});`;
    case "button": return `tl.fromTo(${sel}, { scale: 0.92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: ${d}, ease: E.springCard, immediateRender: false }, ${t});`;
    case "logo": return `tl.fromTo(${sel}, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: ${d}, ease: E.editorialOut, immediateRender: false }, ${t});`;
    case "fade": return `tl.fromTo(${sel}, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: ${d}, ease: E.editorialOut, immediateRender: false }, ${t});`;
    // Mot-impact : flash blanc bref, puis le mot claque (grand → taille finale) avec une secousse.
    case "flash": return `tl.fromTo(${sel}, { autoAlpha: 0.9 }, { autoAlpha: 0, duration: 0.28, ease: "power2.out", immediateRender: false }, ${t});`;
    case "impact": return [
      `tl.fromTo(${sel}, { scale: 1.75, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.32, ease: "expo.out", immediateRender: false }, ${t});`,
      `tl.fromTo(${sel}, { x: -10 }, { x: 10, duration: 0.05, ease: "none", yoyo: true, repeat: 3, immediateRender: false }, ${s(e.atMs + 300)});`,
      `tl.to(${sel}, { x: 0, duration: 0.05 }, ${s(e.atMs + 500)});`,
    ].join("\n      ");
    // Barré : le trait se dessine de gauche à droite ; le mot barré s'estompe.
    case "strike": return `tl.fromTo(${sel}, { scaleX: 0, autoAlpha: 1 }, { scaleX: 1, autoAlpha: 1, duration: ${d}, ease: E.sharpOut, immediateRender: false }, ${t});`;
    case "dim": return `tl.to(${sel}, { opacity: 0.35, duration: ${d}, ease: "power1.out" }, ${t});`;
    // Titre en profondeur 3D (Réels filmés) : bascule depuis l'arrière, perspective.
    case "deep": return `tl.fromTo(${sel}, { rotationX: 80, yPercent: 35, autoAlpha: 0, transformPerspective: 900, transformOrigin: "50% 100%" }, { rotationX: 0, yPercent: 0, autoAlpha: 1, duration: ${d}, ease: E.sharpOut, immediateRender: false }, ${t});`;
    // Cartouche : la boîte se déroule de gauche à droite.
    case "cart": return `tl.fromTo(${sel}, { clipPath: "inset(0% 100% 0% 0%)", autoAlpha: 1 }, { clipPath: "inset(0% 0% 0% 0%)", duration: ${d}, ease: E.wipe, immediateRender: false }, ${t});`;
  }
}

const bandColor = (from: Background, to: Background) => (from !== "brand" && to !== "brand" ? PALETTE.brand : (from === "dark" || to === "dark") ? PALETTE.light : PALETTE.dark);

const CSS = `
      * { box-sizing: border-box; }
      body { margin: 0; background: #000; font-family: "Poppins", sans-serif; }
      #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
      .scene { position: absolute; inset: 0; overflow: hidden; color: var(--text); background-color: var(--fill); }
      .scene.tex { background-image: radial-gradient(var(--tex) 1.2px, transparent 1.6px); background-size: 32px 32px; background-position: 16px 16px; }
      .content { position: absolute; left: ${SAFE.left}px; right: ${SAFE.right}px; top: ${SAFE.top}px; bottom: ${SAFE.bottom}px; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
      .content.center { align-items: center; text-align: center; }
      .content.left { align-items: flex-start; text-align: left; }
      .content.human, .content.cta { gap: 10px; }
      .mask { overflow: hidden; padding: 0.04em 0.02em 0.06em; margin: -0.04em 0; max-width: 100%; }
      .in { display: inline-block; font-weight: 800; line-height: 0.96; letter-spacing: -0.03em; white-space: nowrap; will-change: transform; visibility: hidden; }
      .in em { font-style: normal; color: var(--accent); }
      @property --n { syntax: "<integer>"; inherits: true; initial-value: 0; }
      @property --i { syntax: "<integer>"; inherits: true; initial-value: 0; }
      @property --d { syntax: "<integer>"; inherits: true; initial-value: 0; }
      .stat { line-height: 0.88; letter-spacing: -0.045em; font-variant-numeric: tabular-nums; --n: calc(var(--t)); --i: calc((var(--n) - 5) / 10); --d: calc(var(--n) - var(--i) * 10); counter-reset: n var(--n) i var(--i) d var(--d); }
      .stat b { font-weight: inherit; }
      .stat .num::after { content: counter(n); }
      .stat.dec .num::after { content: counter(i) "," counter(d); }
      .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      .content.full .stat-mask { margin: 10px 0; }
      .micro { margin: 18px 0 0; font-size: ${TYPE.micro + 10}px; font-weight: 500; line-height: 1.35; opacity: 0.78; max-width: 760px; visibility: hidden; }
      .pills { display: flex; flex-direction: column; gap: 22px; margin-top: 40px; }
      .content.center .pills { align-items: center; }
      .pills.left { align-items: flex-start; }
      .pills.alternate { align-items: stretch; }
      .pills.alternate .pill:nth-child(even) { align-self: flex-end; }
      .pills.alternate .pill:nth-child(odd) { align-self: flex-start; }
      .pill { display: inline-block; padding: 24px 42px; border-radius: 36px; font-size: ${TYPE.pill + 16}px; font-weight: 700; line-height: 1.1; visibility: hidden; }
      .pill-a { background: ${PALETTE.brand}; color: ${PALETTE.white}; }
      .pill-b { background: ${PALETTE.white}; color: ${PALETTE.ink}; }
      .scene.light .pill-b { background: ${PALETTE.ink}; color: ${PALETTE.white}; }
      .cards { position: relative; height: 640px; margin-top: 40px; width: 100%; }
      .card { position: absolute; left: 0; right: 0; top: 0; margin: 0; padding: 48px 46px; border-radius: 30px; background: ${PALETTE.white}; color: ${PALETTE.ink}; border: 1px solid rgba(0,0,0,0.08); transform: rotate(var(--tilt)) translateY(var(--dy)); visibility: hidden; }
      .card blockquote { margin: 0; font-size: 46px; font-weight: 600; line-height: 1.22; letter-spacing: -0.01em; }
      .card figcaption { margin-top: 28px; font-size: 28px; font-weight: 500; color: ${PALETTE.muted}; }
      .rating { position: absolute; left: ${SAFE.left}px; right: ${SAFE.right}px; bottom: ${SAFE.bottom + 20}px; display: flex; align-items: center; gap: 24px; padding: 26px 34px; border-radius: 28px; background: ${PALETTE.ink}; color: ${PALETTE.white}; visibility: hidden; }
      .rating .score { font-size: 64px; font-weight: 800; letter-spacing: -0.03em; }
      .rating .stars i { font-style: normal; font-size: 44px; color: ${PALETTE.brand}; display: inline-block; visibility: hidden; }
      .rating .count { font-size: 26px; opacity: 0.75; }
      .content.testi { justify-content: flex-start; }
      .logo { height: 168px; width: auto; margin-top: 46px; visibility: hidden; }
      .cta-btn { display: inline-block; margin-top: 30px; padding: 32px 56px; border-radius: 999px; background: ${PALETTE.brand}; color: ${PALETTE.white}; font-size: 50px; font-weight: 700; letter-spacing: 0.01em; visibility: hidden; }
      .scene.brand .cta-btn { background: ${PALETTE.white}; color: ${PALETTE.brand}; }
      .bee { position: absolute; left: 0; top: ${MASCOT_TOP}px; width: ${MASCOT.w}px; height: ${MASCOT.h}px; z-index: 55; }
      .bee div { width: 100%; height: 100%; transform-origin: 50% 100%; }
      .bee img { width: 100%; height: 100%; display: block; filter: drop-shadow(0 18px 18px rgba(0,0,0,0.28)); }
      .with-bee .content { bottom: ${H - MASCOT_TOP + 20}px; }
      .flash { position: absolute; inset: 0; background: #FFFFFF; opacity: 0; visibility: hidden; z-index: 40; pointer-events: none; }
      .impact { letter-spacing: -0.05em; line-height: 0.9; }
      .mask-impact { overflow: visible; }
      .mask-strike { overflow: visible; }
      .mask-strike .in { position: relative; }
      .strike-line { position: absolute; left: -2%; right: -2%; top: 50%; height: 0.11em; margin-top: -0.055em; background: var(--accent); transform-origin: 0 50%; border-radius: 0.05em; visibility: hidden; }
      .deep { text-shadow: 0.02em 0.02em 0 rgba(0,0,0,0.22), 0.04em 0.04em 0 rgba(0,0,0,0.18), 0.06em 0.06em 0 rgba(0,0,0,0.14), 0.08em 0.08em 0.02em rgba(0,0,0,0.12); }
      .mask-deep { overflow: visible; }
      .cart { background: var(--accent); color: #FFFFFF; padding: 0.08em 0.22em 0.12em; border-radius: 0.14em; }
      .cart em { color: #FFFFFF; text-decoration: underline; text-decoration-thickness: 0.07em; text-underline-offset: 0.08em; }
      .mask-cart { overflow: visible; margin: 0.06em 0; }
      .end-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 60; }
      .band { position: absolute; top: 0; left: 0; height: ${H}px; width: ${BAND}px; transform: skewX(-${SKEW_DEG}deg); visibility: hidden; z-index: 50; }`;

/** `outro` (par défaut oui) : la vidéo de fin officielle des Reels BeeRecos, jouée après l'appel à l'action. */
export type RenderOptions = { assetBase: string; preview?: boolean; mediaUrl?: (file: string) => string; outro?: boolean; resolveVoice?: (src: string, sceneId: string) => string };

/** Composition complète (aperçu = rendu). */
export function renderEditorial(sb: Storyboard, opts: RenderOptions, plan: Plan = planStoryboard(sb)): string {
  const base = opts.assetBase.replace(/\/$/, "");
  const clips: string[] = [];
  const tweens: string[] = [];
  const total = plan.durationMs;
  plan.scenes.forEach((p, i) => {
    const t = BG[p.scene.background];
    const enter = i === 0 ? 0 : plan.transitions[i - 1];
    const startMs = i === 0 ? 0 : (enter as Plan["transitions"][number]).atMs - (enter as Plan["transitions"][number]).durMs / 2;
    const out = plan.transitions[i];
    const endMs = out ? out.atMs + out.durMs / 2 : total;
    clips.push(`      <section id="sc-${p.scene.id}" class="clip scene ${p.scene.background}${t.texture ? " tex" : ""}" data-start="${s(startMs)}" data-duration="${s(endMs - startMs)}" data-track-index="0" style="z-index:${i + 1};--fill:${t.fill};--text:${t.text};--accent:${t.accent};--tex:${t.texture ?? "transparent"};visibility:hidden">${sceneHtml(p.scene, base)}</section>`);
    tweens.push(`tl.set("#sc-${p.scene.id}", { autoAlpha: 1 }, ${s(startMs)});`, `tl.set("#sc-${p.scene.id}", { autoAlpha: 0 }, ${s(endMs)});`);
    for (const e of p.events) tweens.push(tween(e));
  });
  // Transitions : wipe diagonal (front incliné de ${SKEW_DEG}°, bande de marque) ou cut sec sur le beat.
  plan.transitions.forEach((tr, k) => {
    const next = plan.scenes[k + 1].scene.id;
    if (tr.kind === "cut") return;
    const lr = tr.kind === "wipe-lr";
    // Opacité 0 au départ : le lecteur Hyperframes force « visibility: visible » sur les éléments sans timing ;
    // la bande n'existe à l'écran que pendant sa transition (sinon elle reste figée sur le bord gauche).
    clips.push(`      <div id="band-${k}" class="band" style="background:${bandColor(tr.from, tr.to)};opacity:0"></div>`);
    const from = lr ? -(SKEW_PX / 2 + BAND) : W + SKEW_PX / 2 + BAND, to = lr ? W + SKEW_PX / 2 : -SKEW_PX / 2;
    const half = SKEW_PX / 2;
    const poly = (e: number) => lr
      ? `polygon(0px 0px, ${Math.round(e + half)}px 0px, ${Math.round(e - half)}px ${H}px, 0px ${H}px)`
      : `polygon(${Math.round(e + half)}px 0px, ${W}px 0px, ${W}px ${H}px, ${Math.round(e - half)}px ${H}px)`;
    const bandX = (e: number) => Math.round(lr ? e : e - BAND);
    const t0 = s(tr.atMs - tr.durMs / 2), dur = s(tr.durMs);
    // Sans fonction de rappel : le clip-path (chaîne de nombres) et la bande sont animés directement par GSAP.
    tweens.push(
      `tl.fromTo("#sc-${next}", { clipPath: "${poly(from)}" }, { clipPath: "${poly(to)}", duration: ${dur}, ease: E.wipe, immediateRender: false }, ${t0});`,
      `tl.set("#band-${k}", { autoAlpha: 0, x: ${bandX(from)} }, 0);`,
      `tl.fromTo("#band-${k}", { x: ${bandX(from)}, autoAlpha: 1 }, { x: ${bandX(to)}, duration: ${dur}, ease: E.wipe, immediateRender: false }, ${t0});`,
      `tl.set("#band-${k}", { autoAlpha: 0 }, ${s(tr.atMs + tr.durMs / 2)});`,
    );
  });
  // Mascotte officielle (option du Studio IA) : personnage central, toujours en mouvement. Elle entre en sautant,
  // respire (léger rebond continu), saute d'une place à l'autre à chaque scène (arc + écrasement à l'atterrissage),
  // réagit aux moments forts (bond + frétillement), saute sur le bouton de l'appel à l'action (sans bras ni jambes : tout passe par le corps), puis sort avant la vidéo de fin.
  // Calques : #bee (place, x) > #bee-hop (sauts, y) > #bee-bob (respiration) > #bee-sq (écrasement, réactions) > img.
  if (sb.mascot) {
    const T = (ms: number) => s(ms);
    clips.push(`      <div id="bee" class="bee" style="opacity:0"><div id="bee-hop"><div id="bee-bob"><div id="bee-sq"><img src="${base}/${MASCOT.file}" alt="" width="${MASCOT.w}" height="${MASCOT.h}" /></div></div></div></div>`);
    tweens.push(
      `tl.set("#bee", { autoAlpha: 0, x: ${MASCOT_X[0]} }, 0);`,
      // Entrée : jaillit du bas avec un rebond.
      `tl.fromTo("#bee-hop", { y: 420 }, { y: 0, duration: 0.55, ease: "back.out(2.2)", immediateRender: false }, 0.2);`,
      `tl.to("#bee", { autoAlpha: 1, duration: 0.15 }, 0.2);`,
      `tl.fromTo("#bee-sq", { scaleX: 0.8, scaleY: 1.25 }, { scaleX: 1, scaleY: 1, duration: 0.6, ease: "elastic.out(1, 0.45)", immediateRender: false }, 0.6);`,
    );
    // Respiration continue (nombre de répétitions fini : la timeline garde une durée exacte).
    const bobs = Math.max(1, Math.floor((total - 1200) / 550) | 1);
    tweens.push(`tl.fromTo("#bee-bob", { y: 0, rotation: -2 }, { y: -16, rotation: 2, duration: 0.55, ease: "sine.inOut", yoyo: true, repeat: ${bobs}, immediateRender: false }, 0.8);`);
    // Place de repos par scène (gauche ↔ centre) ; la scène du milieu fait « coucou » depuis le bord droit.
    const spot = (i: number) => MASCOT_X[i % 2];
    const peekAt = plan.transitions.length >= 3 ? Math.floor(plan.transitions.length / 2) : -1;
    const squash = (at: number) => [
      `tl.to("#bee-sq", { scaleX: 1.2, scaleY: 0.8, duration: 0.07, ease: "power2.out" }, ${T(at)});`,
      `tl.to("#bee-sq", { scaleX: 1, scaleY: 1, duration: 0.45, ease: "elastic.out(1, 0.4)" }, ${T(at + 70)});`,
    ];
    plan.transitions.forEach((tr, k) => {
      const t0 = Math.max(900, tr.atMs - 250);
      const x = spot(k + 1);
      if (k === peekAt) {
        // Coucou : elle file hors champ pendant le balayage, passe la tête par le bord droit, puis saute à sa place.
        tweens.push(
          `tl.to("#bee", { x: -${MASCOT.w + 60}, duration: 0.3, ease: "power2.in" }, ${T(t0)});`,
          `tl.set("#bee", { x: ${W - Math.round(MASCOT.w * 0.42)} }, ${T(t0 + 320)});`,
          `tl.set("#bee-sq", { rotation: -28 }, ${T(t0 + 320)});`,
          `tl.fromTo("#bee-hop", { y: 60 }, { y: -40, duration: 0.3, ease: "back.out(2)", immediateRender: false }, ${T(t0 + 330)});`,
          `tl.to("#bee-sq", { rotation: -18, duration: 0.12, ease: "sine.inOut", yoyo: true, repeat: 3 }, ${T(t0 + 650)});`,
          `tl.to("#bee", { x: ${x}, duration: 0.5, ease: "power1.inOut" }, ${T(t0 + 1150)});`,
          `tl.to("#bee-hop", { y: -200, duration: 0.25, ease: "power2.out" }, ${T(t0 + 1150)});`,
          `tl.to("#bee-sq", { rotation: 0, duration: 0.3, ease: "power2.out" }, ${T(t0 + 1150)});`,
          `tl.to("#bee-hop", { y: 0, duration: 0.25, ease: "power2.in" }, ${T(t0 + 1400)});`,
          ...squash(t0 + 1650),
        );
        return;
      }
      tweens.push(
        `tl.to("#bee-sq", { scaleX: 1.15, scaleY: 0.82, duration: 0.09, ease: "power2.out" }, ${T(t0)});`,
        `tl.to("#bee-sq", { scaleX: 0.9, scaleY: 1.12, duration: 0.12, ease: "power2.out" }, ${T(t0 + 90)});`,
        `tl.to("#bee", { x: ${x}, duration: 0.5, ease: "power1.inOut" }, ${T(t0 + 90)});`,
        `tl.to("#bee-hop", { y: -230, rotation: ${k % 2 ? -14 : 14}, duration: 0.25, ease: "power2.out" }, ${T(t0 + 90)});`,
        `tl.to("#bee-hop", { y: 0, rotation: 0, duration: 0.25, ease: "power2.in" }, ${T(t0 + 340)});`,
        ...squash(t0 + 590),
      );
    });
    // Sur fond bleu, un fin contour blanc la détache (mascotte bleue).
    for (const p of plan.scenes) tweens.push(`tl.set("#bee img", { filter: "${p.scene.background === "brand" ? "drop-shadow(0 0 4px #FFFFFF) drop-shadow(0 0 2px #FFFFFF) drop-shadow(0 18px 18px rgba(0,0,0,0.28))" : "drop-shadow(0 18px 18px rgba(0,0,0,0.28))"}" }, ${T(p.startMs + (p.index ? 180 : 0))});`);
    // Saut SUR un élément (mot fort, chiffre, bouton) : position mesurée sur l'élément réel au moment du saut.
    // Le mot s'écrase sous son poids puis rebondit ; elle revient à sa place avant le changement de scène.
    const jumpOn = (el: string, land: number, back: number, home: number, press = false) => {
      // Elle rapetisse pendant le saut (moitié de sa taille) et se pose AU-DESSUS du mot, la base au ras des lettres :
      // le mot reste lisible ; elle ne s'attarde pas (0,7 s) puis revient à sa place, à sa taille.
      const sel = JSON.stringify(`#${el}`);
      tweens.push(
        `tl.to("#bee-sq", { scaleX: 1.15, scaleY: 0.82, duration: 0.08, ease: "power2.out" }, ${T(land - 330)});`,
        `tl.to("#bee-sq", { scaleX: 0.9, scaleY: 1.12, duration: 0.1, ease: "power2.out" }, ${T(land - 250)});`,
        `tl.to("#bee", { x: () => BX(${sel}), duration: 0.42, ease: "power1.inOut" }, ${T(land - 250)});`,
        // Réduction sur un calque intérieur (jamais sur #bee : elle écraserait aussi la hauteur du saut).
        `tl.to("#bee-bob", { scale: ${PERCH}, transformOrigin: "50% 100%", duration: 0.42, ease: "power1.inOut" }, ${T(land - 250)});`,
        `tl.to("#bee-hop", { y: () => BY(${sel}) - 170, rotation: 10, duration: 0.24, ease: "power2.out" }, ${T(land - 250)});`,
        `tl.to("#bee-hop", { y: () => BY(${sel}), rotation: 0, duration: 0.18, ease: "power2.in" }, ${T(land - 10)});`,
        ...squash(land + 170),
        `tl.to(${sel}, { scaleY: ${press ? 0.86 : 0.9}, scaleX: 1.04, transformOrigin: "50% 100%", duration: 0.07, ease: "power2.out" }, ${T(land + 170)});`,
        `tl.to(${sel}, { scaleY: 1, scaleX: 1, duration: 0.5, ease: "elastic.out(1, 0.35)" }, ${T(land + 240)});`,
      );
      if (back <= land + 400) return;
      tweens.push(
        `tl.to("#bee", { x: ${home}, duration: 0.45, ease: "power1.inOut" }, ${T(back)});`,
        `tl.to("#bee-bob", { scale: 1, duration: 0.45, ease: "power1.inOut" }, ${T(back)});`,
        `tl.to("#bee-hop", { y: () => BY(${sel}) - 120, duration: 0.2, ease: "power2.out" }, ${T(back)});`,
        `tl.to("#bee-hop", { y: 0, duration: 0.25, ease: "power2.in" }, ${T(back + 200)});`,
        ...squash(back + 450),
      );
    };
    for (const p of plan.scenes) {
      const i = p.index, home = spot(i), sc = p.scene;
      const next = plan.transitions[i] ? plan.transitions[i].atMs - 250 : total - 700;
      const backAt = (land: number) => Math.min(land + 950, next - 800);
      const find = (pred: (e: PlanEvent) => boolean) => p.events.find(pred);
      if (sc.type === "hook-stat") {
        // Stoppe le chiffre : elle saute dessus pendant qu'il tourne et l'arrête pile sur la valeur.
        const c = find((e) => e.anim === "counter");
        if (c) jumpOn(c.el, c.atMs + c.durMs - 170, backAt(c.atMs + c.durMs), home, true);
        continue;
      }
      if (sc.type === "cta") {
        const b = find((e) => e.anim === "button");
        if (b) jumpOn(b.el, b.atMs + b.durMs + 120, 0, home, true);
        continue;
      }
      // Saut sur le mot fort : mot en couleur (réponse, mot remplacé, mot-impact, ligne accentuée).
      const target = sc.type === "human" ? find((e) => e.el === `${sc.id}-ans`)
        : sc.type === "strike" ? find((e) => e.el === `${sc.id}-after`)
        : sc.type === "impact" ? find((e) => e.el === `${sc.id}-word`)
        : sc.type === "statement" && sc.accentWords.length ? find((e) => e.el === `${sc.id}-l${Math.max(0, sc.lines.findIndex((l) => sc.accentWords.some((a) => l.toLowerCase().includes(a.toLowerCase()))))}`)
        : undefined;
      // Sur une ligne qui contient un mot en couleur, elle vise le mot lui-même.
      const el = target && sc.type === "statement" ? `${target.el} em` : target?.el;
      if (target && el) { const land = target.atMs + target.durMs + 250; if (land + 600 < next) jumpOn(el, land, backAt(land), home); }
    }
    // Sortie : petit bond puis plongeon avant la vidéo de fin.
    tweens.push(
      `tl.to("#bee-hop", { y: -120, duration: 0.18, ease: "power2.out" }, ${T(Math.max(0, total - 650))});`,
      `tl.to("#bee-hop", { y: 520, duration: 0.35, ease: "power2.in" }, ${T(Math.max(0, total - 470))});`,
      `tl.to("#bee", { autoAlpha: 0, duration: 0.1 }, ${T(Math.max(0, total - 120))});`,
    );
  }
  // Voix d'Audrey (rendu) : chaque phrase commence avec le contenu de sa scène.
  for (const p of plan.scenes) {
    const a = sb.assets?.voice[p.scene.id];
    if (!a || p.voiceAtMs === undefined) continue;
    const src = opts.resolveVoice ? opts.resolveVoice(a.src, p.scene.id) : a.src;
    clips.push(`      <audio id="vo-${escapeHtml(p.scene.id)}" src="${escapeHtml(src)}" data-start="${s(p.voiceAtMs)}" data-duration="${a.duration}" data-track-index="2" data-volume="1"></audio>`);
  }
  // Sons : le pic de chaque son tombe sur l'instant visé (centre du wipe, valeur finale du compteur…).
  plan.audio.forEach((a, i) => {
    const at = Math.max(0, a.atMs - SFX_PEAK_MS[a.sfx]);
    clips.push(`      <audio id="sfx-${i}" src="${base}/sfx/${a.sfx}.wav" data-start="${s(at)}" data-duration="0.6" data-volume="${Math.min(1, (sb.assets ? 0.38 : 0.55) * a.gain).toFixed(2)}" data-track-index="${3 + (i % 3)}"></audio>`);
  });
  if (sb.music) {
    const url = opts.mediaUrl?.(sb.music.file) ?? `${base}/${sb.music.file}`;
    clips.push(`      <audio id="music" src="${escapeHtml(url)}" data-start="0" data-duration="${s(total)}" data-volume="${sb.music.volume}" data-track-index="2"></audio>`);
  }
  // Même fin que les Reels classiques (décision du 2026-11-10) : vidéo de fin officielle, plein cadre, après le CTA.
  const outro = opts.outro !== false;
  if (outro) {
    clips.push(`      <video id="end-video" class="clip end-video" src="${base}/${END_VIDEO.file}" data-start="${s(total)}" data-duration="${s(END_VIDEO.durationMs)}" data-has-audio="false" muted playsinline data-track-index="7" style="visibility:hidden"></video>`);
    tweens.push(`tl.set("#end-video", { autoAlpha: 1 }, ${s(total)});`);
  }
  const length = total + (outro ? END_VIDEO.durationMs : 0);
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>Editorial Impact</title>
    <script src="${base}/gsap-3.14.2.min.js"></script>${opts.preview ? `\n    <script src="${base}/hyperframe.runtime-0.8.126.iife.js"></script>` : ""}
    <style>
      ${[500, 600, 700, 800].map((w) => `@font-face { font-family: "Poppins"; font-weight: ${w}; src: url("${base}/fonts/poppins-latin-${w}-normal.woff2") format("woff2"); }`).join("\n      ")}${CSS}
    </style>
  </head>
  <body>
    <div id="root"${sb.mascot ? ` class="with-bee"` : ""} data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${s(length)}" data-fps="30">
${clips.join("\n")}
    </div>
    <script>
      ${easingSource()}${sb.mascot ? `
      // Position d'un élément dans la composition (1080 × 1920), sans les transformations animées.
      const ROOT = document.getElementById("root");
      const POS = (sel) => { const el = document.querySelector(sel); let x = 0, y = 0, n = el; while (n && n !== ROOT) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
      const BX = (sel) => { const p = POS(sel); return Math.max(0, Math.min(${W - MASCOT.w - 150}, Math.round(p.x + p.w / 2 - ${MASCOT.w / 2}))); };
      // Base de la mascotte (réduite, ancrée en bas) posée juste au-dessus du haut des lettres.
      const BY = (sel) => Math.round(POS(sel).y + ${Math.round(MASCOT.h * 0.06)} - ${MASCOT.h} - ${MASCOT_TOP});` : ""}
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${tweens.join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

/** Fichiers de public/hyperframes/ nécessaires au rendu de ce Reel (voix en plus). */
export function editorialAssets(sb: Storyboard, plan: Plan = planStoryboard(sb)): string[] {
  const logos = sb.scenes.some((x) => x.type === "cta" && x.brand) ? ["brand/beerecos-logo-white.svg", "brand/beerecos-logo-blue.svg"] : [];
  return [
    ...[500, 600, 700, 800].map((w) => `fonts/poppins-latin-${w}-normal.woff2`),
    "gsap-3.14.2.min.js", ...logos, ...(sb.mascot ? [MASCOT.file] : []),
    ...[...new Set(plan.audio.map((a) => `sfx/${a.sfx}.wav`))], END_VIDEO.file,
  ];
}

import { COLORS, FONT_FAMILY, FONT_FILES, FRAME, LOGOS, PICTOGRAM, SAFE, SAFE_WIDTH, logoClearSpace } from "./brand";
import { END_VIDEO } from "../montage/brand";
import { GUIDE_BASE_HEIGHT, GUIDE_BASE_WIDTH, GUIDE_RATIO, guideGsap, type GuidePose } from "./guide";
import { fitSize, textWidth } from "./metrics";
import { SHAPES, type ShapeName } from "./shapes";
import { parseStorySpec, voiceAsset, SEQUENCES, type SequenceKey, type StorySpec } from "./spec";
import { storyBeats } from "./timeline";

/**
 * Montage du template « Recommandation » : génère la composition Hyperframes (HTML + une chronologie GSAP en pause,
 * pilotée image par image). Le MÊME code sert à l'aperçu dans BeeMarketing et au rendu MP4 sur le serveur.
 *
 * Fil rouge : une carte « Mise en relation » entre, glisse entre l'apporteur et le professionnel, devient un contrat,
 * disparaît sur la rupture, renaît du repère « Toi » et franchit les trois étapes, puis laisse place au logo et au CTA.
 */

export type CompositionOptions = {
  /** Dossier des ressources Hyperframes (polices, GSAP, logos) : URL dans l'aperçu, "." dans le projet de rendu. */
  assetBase: string;
  /** Ajoute le runtime Hyperframes auto-hébergé (lecteur intégré). Le moteur de rendu injecte le sien. */
  preview?: boolean;
  /** Bande son (musique + effets) déjà produite pour cette spec. */
  soundtrackSrc?: string;
  /** Réécrit l'adresse d'une voix (ex. copie locale dans le projet de rendu). */
  resolveVoice?: (src: string, key: SequenceKey) => string;
};

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Tout texte saisi est échappé : aucune balise ni script ne peut entrer dans la composition. */
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

type Token = { t: string; em: boolean; space: boolean };
/** Découpe une ligne en mots, `*mot*` = mis en valeur ; la ponctuation collée reste collée. */
export function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let space = false;
  line.split(/(\*[^*]+\*)/).forEach((seg) => {
    if (!seg) return;
    const em = seg.startsWith("*") && seg.endsWith("*") && seg.length > 2;
    (em ? seg.slice(1, -1) : seg).split(/(\s+)/).forEach((piece) => {
      if (!piece) return;
      if (/^\s+$/.test(piece)) { space = true; return; }
      out.push({ t: piece, em, space: space && out.length > 0 });
      space = false;
    });
  });
  return out;
}
const plain = (tokens: Token[]) => tokens.map((k) => (k.space ? " " : "") + k.t).join("");

type Line = { tokens: Token[]; size: number };
/**
 * Lignes d'un message : on respecte les retours à la ligne écrits, puis on coupe une ligne trop longue
 * (taille < `prefer`) en deux lignes équilibrées plutôt que de réduire le texte.
 */
export function layoutLines(text: string, weight: 400 | 600 | 700, max: number, prefer: number, width = SAFE_WIDTH): Line[] {
  const queue = text.split("\n").map((l) => tokenize(l.trim())).filter((t) => t.length);
  const lines: Line[] = [];
  while (queue.length) {
    const tokens = queue.shift()!;
    const size = fitSize(plain(tokens), weight, width, max, 36);
    if (size >= prefer || tokens.length < 2 || lines.length + queue.length >= 5) { lines.push({ tokens, size }); continue; }
    let best = 1, bestW = Infinity;
    for (let i = 1; i < tokens.length; i++) {
      const a = textWidth(plain(tokens.slice(0, i)), weight, 1), b = textWidth(plain(tokens.slice(i).map((k, j) => (j ? k : { ...k, space: false }))), weight, 1);
      if (Math.max(a, b) < bestW) { bestW = Math.max(a, b); best = i; }
    }
    queue.unshift(tokens.slice(0, best), tokens.slice(best).map((k, j) => (j ? k : { ...k, space: false })));
  }
  return lines;
}

const LH = 1.14;
const blockHeight = (lines: Line[]) => Math.round(lines.reduce((n, l) => n + l.size * LH, 0));

/** Comme layoutLines, en réduisant la taille maximale jusqu'à ce que le bloc tienne dans `maxHeight` : rien ne se superpose. */
export function fitBlock(text: string, weight: 400 | 600 | 700, max: number, prefer: number, maxHeight: number, width = SAFE_WIDTH): Line[] {
  let size = max;
  let lines = layoutLines(text, weight, size, prefer, width);
  while (blockHeight(lines) > maxHeight && size > 40) {
    size -= 6;
    lines = layoutLines(text, weight, size, Math.min(prefer, size), width);
  }
  return lines;
}

function linesHtml(id: string, lines: Line[], emClass: "em-blue" | "em-box") {
  return lines.map((l, i) => {
    const words = l.tokens.map((k) => (k.space ? " " : "") + (k.em
      ? emClass === "em-box" ? `<span class="em-box"><span class="bx"></span><span class="tx">${escapeHtml(k.t)}</span></span>` : `<span class="em-blue">${escapeHtml(k.t)}</span>`
      : escapeHtml(k.t))).join("");
    return `<div class="ln" id="${id}-l${i}" style="font-size:${l.size}px;height:${Math.round(l.size * LH)}px"><span class="in">${words}</span></div>`;
  }).join("");
}

const shape = (name: ShapeName, cls: string, style: string, fill: string) => {
  const s = SHAPES[name];
  return `<svg class="${cls}" style="${style}" viewBox="${s.viewBox}" aria-hidden="true"><path fill="${fill}" d="${s.d}"${s.transform ? ` transform="${s.transform}"` : ""}/></svg>`;
};
/** Repère du réseau : hexagone officiel (ponctuation autorisée par la charte). */
const HEX = SHAPES.hexagone;
const hexNode = (id: string, x: number, y: number, size: number, label: string) => `
      <div class="node" id="${id}" style="left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px">
        <svg class="hex" viewBox="${HEX.viewBox}" aria-hidden="true"><path d="${HEX.d}" transform="${HEX.transform ?? ""}"/></svg>
        <p class="node-label">${escapeHtml(label)}</p>
      </div>`;

/** « CRM INTÉGRÉ. » → « CRM intégré » : sigles courts et noms de marque gardent leur casse. */
const ACRONYMS = new Set(["CRM", "IA", "PME", "TPE", "RH", "SEO", "B2B", "ETI"]);
const KEEP_CASE: Record<string, string> = { beecard: "BeeCard", beerecos: "BeeRecos", beeschool: "BeeSchool", beemarketing: "BeeMarketing" };
export const sentence = (title: string) => {
  const words = title.replace(/[.!*]+$/g, "").split(/\s+/).map((w, i) => {
    const lower = w.toLowerCase();
    if (KEEP_CASE[lower]) return KEEP_CASE[lower];
    if (ACRONYMS.has(w)) return w;
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  });
  return words.join(" ");
};

export function buildStoryComposition(input: StorySpec, opts: CompositionOptions): string {
  const parsed = parseStorySpec(input);
  if (!parsed.ok) throw new Error(parsed.errors.join(" "));
  const spec = parsed.spec;
  const base = opts.assetBase.replace(/\/$/, "");
  const b = storyBeats(spec);
  const C = COLORS;
  const W = FRAME.width;
  const top = SAFE.top + 20;

  // ── Typographie : chaque ligne prend la plus grande taille qui tient dans la zone utile.
  const nodeY = 1185, nodeX = [210, 500, 790], NODE = 126;
  const hookCompL = spec.hook.complement ? fitBlock(spec.hook.complement, 400, 46, 40, 120) : [];
  const hookCompH = hookCompL.length ? blockHeight(hookCompL) + 40 : 30;
  // La carte (168 px à l'échelle 0,8) doit tenir entre l'accroche et les repères du réseau.
  const hookL = fitBlock(spec.hook.text, 700, 250, 96, nodeY - NODE / 2 - 40 - 168 - 10 - hookCompH - top);
  const hookH = blockHeight(hookL);
  // Le surlignage (em-box) ajoute ~0,2 em de marge : la ligne est calculée sur une largeur réduite d'autant.
  const consL = fitBlock(spec.consequence.text, 700, 150, 96, 400, SAFE_WIDTH - 40);
  const consCardY = Math.max(760, top + blockHeight(consL) + 60);
  const ruptL = fitBlock(spec.rupture.text, 700, 300, 180, 900);
  const ruptH = blockHeight(ruptL);
  const valMax = nodeY - NODE / 2 - 70 - top;
  const valL = (() => {
    for (let k = 0; k < 20; k++) {
      const lines = fitBlock(spec.value.text, 700, 150 - k * 6, 96, valMax).map((l) => (l.tokens.some((t) => t.em) ? { ...l, size: fitSize(plain(l.tokens), 700, SAFE_WIDTH, 230 - k * 8, 36) } : l));
      if (blockHeight(lines) <= valMax) return lines;
    }
    return fitBlock(spec.value.text, 700, 60, 40, valMax);
  })();
  const stepL = spec.steps.items.map((s) => fitBlock(s.title, 700, 150, 96, 330));
  const sigL = fitBlock(spec.signature.tagline, 600, 64, 56, 240);
  const verbSize = fitSize(spec.cta.verb, 700, SAFE_WIDTH, 150, 60);
  const kwSize = Math.min(118, fitSize(spec.cta.keyword, 700, SAFE_WIDTH - 260, 118, 60));
  const ctaCompL = fitBlock(spec.cta.complement, 600, 56, 48, 220);

  // ── Positions (px) dans le cadre 1080×1920, à l'intérieur des zones de sécurité Instagram.
  const card = { w: 600, x: (W - 600) / 2, y: 840 };
  const cardHookY = top + hookH + hookCompH + 10;
  const ruptTop = Math.round((FRAME.height - ruptH) / 2) - 180;
  // Signature : logo de fin officiel (le même que les vidéos montées), baseline posée dessous, sur fond blanc.
  const logo = { w: 740, h: Math.round(740 * LOGOS.endHorizontal.ratio) };
  const baseH = Math.round(740 * LOGOS.endBaseline.ratio);
  const logoTop = 600;
  const baseTop = logoTop + logo.h + 56;
  const tagTop = baseTop + baseH + logoClearSpace(logo.w);
  // Appel à l'action : le guide se place au-dessus du message, le texte en dessous.
  const ctaGuide: GuidePose = { cx: W / 2, cy: SAFE.top + 20 + 110, h: 220 };
  const verbTop = SAFE.top + 20 + 220 + 44;
  const fieldTop = verbTop + Math.round(verbSize * LH) + 34;
  const field = { h: 200, w: SAFE_WIDTH };

  const voices = SEQUENCES.map((k) => ({ k, a: voiceAsset(spec, k) })).filter((v) => v.a);

  // ── Le guide (pictogramme officiel) : une pose par scène, calculée pour ne jamais recouvrir un texte.
  const gw = (h: number) => h * GUIDE_RATIO;
  const nodeTop = nodeY - NODE / 2;
  const hookCardBottom = cardHookY + 168;
  const line1W = textWidth(plain(hookL[0].tokens), 700, hookL[0].size);
  const line1H = hookL[0].size * LH;
  const room = SAFE_WIDTH - line1W - 50;
  const hookGuideH = Math.min(255, line1H * 0.92, room / GUIDE_RATIO);
  const fallbackH = Math.max(80, Math.min(170, nodeTop - hookCardBottom - 46));
  const hookGuide: GuidePose = hookGuideH >= 140
    ? { cx: SAFE.left + SAFE_WIDTH - gw(hookGuideH) / 2 - 10, cy: top + line1H / 2, h: hookGuideH }
    : { cx: nodeX[1], cy: hookCardBottom + 16 + fallbackH / 2, h: fallbackH };
  const consFree = 1480 - (consCardY + 455 + 50);
  const consGuide: GuidePose = { cx: W / 2, cy: consCardY + 505 + Math.min(220, consFree) / 2, h: Math.max(100, Math.min(220, consFree)) };
  const ruptFree = 1480 - (ruptTop + ruptH + 50);
  const ruptGuide: GuidePose = { cx: W / 2, cy: ruptTop + ruptH + 50 + Math.min(230, ruptFree) / 2, h: Math.max(100, Math.min(230, ruptFree)) };
  const valBottom = top + blockHeight(valL);
  const valFree = nodeTop - 24 - (valBottom + 30);
  const valGuide: GuidePose = valFree >= 110
    ? { cx: nodeX[2], cy: nodeTop - 24 - Math.min(210, valFree) / 2, h: Math.min(210, valFree) }
    : { cx: nodeX[2], cy: 1395, h: 160 };
  const subH = (t: string) => (textWidth(t, 400, 52) > SAFE_WIDTH ? 130 : 65);
  const stepsBottom = Math.max(...stepL.map((l, i) => top + 30 + blockHeight(l) + 18 + subH(spec.steps.items[i].complement)));
  const stepsFree = 820 - 24 - (stepsBottom + 24);
  const stepsGuide: GuidePose = stepsFree >= 110
    ? { cx: SAFE.left + SAFE_WIDTH - gw(Math.min(240, stepsFree)) / 2, cy: 820 - 24 - Math.min(240, stepsFree) / 2, h: Math.min(240, stepsFree) }
    : { cx: 830, cy: 1405, h: 150 };
  const poses = { hook: hookGuide, cons: consGuide, rupt: ruptGuide, value: valGuide, steps: stepsGuide, cta: ctaGuide };
  const fonts = FONT_FILES.map((f) => `@font-face { font-family: "${FONT_FAMILY}"; font-weight: ${f.weight}; font-display: block; src: url("${base}/fonts/${f.file}") format("woff2"); }`).join("\n      ");

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${FRAME.height}" />
    <title>${escapeHtml(spec.title)}</title>
    ${FONT_FILES.map((f) => `<link rel="preload" as="font" type="font/woff2" href="${base}/fonts/${f.file}" />`).join("\n    ")}
    <script src="${base}/gsap-3.14.2.min.js"></script>${opts.preview ? `\n    <script src="${base}/hyperframe.runtime-0.8.126.iife.js"></script>` : ""}
    <style>
      ${fonts}
      * { box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${FRAME.height}px; background: ${C.white}; font-family: "${FONT_FAMILY}", sans-serif; -webkit-font-smoothing: antialiased; }
      #root { position: relative; width: ${W}px; height: ${FRAME.height}px; overflow: hidden; background: ${C.white}; color: ${C.black}; }
      .layer { position: absolute; inset: 0; }
      .blk { position: absolute; left: ${SAFE.left}px; width: ${SAFE_WIDTH}px; }
      .center { text-align: center; }
      .ln { overflow: hidden; line-height: ${LH}; font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
      .in { display: inline-block; will-change: transform; }
      .em-blue { color: ${C.blue}; }
      .em-box { position: relative; display: inline-block; padding: 0 0.1em; margin: 0 -0.02em; }
      .em-box .bx { position: absolute; inset: 0.1em 0 0.06em; background: ${C.white}; border-radius: 0.12em; transform-origin: left center; }
      .em-box .tx { position: relative; }
      .sub { margin: 0; font-weight: 400; font-size: 46px; line-height: 1.25; }
      .wipe { position: absolute; width: 4600px; height: 4600px; border-radius: 50%; background: ${C.blue}; transform: scale(0); }
      .deco { position: absolute; }
      /* Réseau : hexagones officiels + liens */
      .node { position: absolute; text-align: center; }
      .hex { display: block; width: 100%; height: auto; overflow: visible; }
      .hex path { fill: ${C.white}; stroke: ${C.blue}; stroke-width: 3.4; vector-effect: non-scaling-stroke; }
      .node.on .hex path { fill: ${C.blue}; }
      .rupt-node .node-label { color: ${C.white}; }
      .node-label { margin: 14px -60px 0; font-size: 36px; font-weight: 600; line-height: 1.1; white-space: nowrap; }
      #links { position: absolute; inset: 0; width: ${W}px; height: ${FRAME.height}px; }
      #links line { stroke: ${C.blue}; stroke-width: 8; stroke-linecap: round; }
      .dot { position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; background: ${C.blue}; }
      /* Carte de mise en relation */
      #card { position: absolute; left: ${card.x}px; top: ${card.y}px; width: ${card.w}px; height: 210px; border-radius: 34px; background: ${C.white}; box-shadow: 0 30px 70px rgba(0,0,0,0.16), 0 0 0 2px rgba(0,0,0,0.06); overflow: hidden; transform-origin: center center; }
      .card-head { display: flex; align-items: center; gap: 24px; padding: 34px 34px 0; }
      .card-ico { width: 74px; flex: none; }
      .card-ico path { fill: ${C.blue}; }
      .card-label { margin: 0; font-size: 40px; font-weight: 600; line-height: 1.1; color: ${C.black}; }
      .card-route { margin: 6px 0 0; font-size: 30px; font-weight: 400; color: ${C.black}; opacity: 0.72; }
      .pill { position: absolute; right: 30px; top: 150px; display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 22px; border-radius: 24px; font-size: 28px; font-weight: 600; white-space: nowrap; transform-origin: right center; }
      .pill.blue { background: ${C.blue}; color: ${C.white}; }
      .pill.green { background: ${C.green}; color: ${C.black}; }
      .pill svg { width: 26px; height: 26px; }
      .doc { position: absolute; left: 34px; right: 34px; top: 222px; }
      .doc i { display: block; height: 16px; margin-bottom: 18px; border-radius: 8px; background: ${C.black}; opacity: 0.1; transform-origin: left center; }
      .doc svg { width: 230px; height: 70px; overflow: visible; }
      .doc svg path { fill: none; stroke: ${C.blue}; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
      .track { position: absolute; left: 34px; right: 34px; top: 214px; }
      .row { display: flex; align-items: center; gap: 22px; height: 88px; font-size: 36px; font-weight: 600; }
      .mark { position: relative; width: 56px; height: 56px; flex: none; }
      .mark .ring { position: absolute; inset: 0; border-radius: 50%; border: 4px solid rgba(0,0,0,0.18); }
      .mark .fill { position: absolute; inset: 0; border-radius: 50%; background: ${C.blue}; transform: scale(0); }
      .mark .ok { position: absolute; inset: 0; border-radius: 50%; background: ${C.green}; transform: scale(0); }
      .mark .ok svg { position: absolute; inset: 14px; }
      .row-label { opacity: 0.4; }
      .foot { position: absolute; left: ${SAFE.left}px; width: ${SAFE_WIDTH}px; top: 1400px; margin: 0; font-size: 38px; font-weight: 400; line-height: 1.2; }
      .caption { position: absolute; left: ${SAFE.left}px; width: ${SAFE_WIDTH}px; margin: 0; font-size: 34px; font-weight: 400; color: ${C.white}; opacity: 0.85; text-align: center; }
      /* Signature et appel à l'action */
      /* Le guide : UN conteneur pour le pictogramme entier ; seules opacité, translation et échelle uniforme centrée bougent. */
      #guide { position: absolute; left: 0; top: 0; width: ${GUIDE_BASE_WIDTH}px; height: ${GUIDE_BASE_HEIGHT}px; transform-origin: 50% 50%; pointer-events: none; }
      #guide-in { position: absolute; inset: 0; transform-origin: 50% 50%; }
      #guide img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
      #logo, #logo-base { position: absolute; left: ${(W - logo.w) / 2}px; width: ${logo.w}px; transform-origin: center top; }
      #logo { top: ${logoTop}px; height: ${logo.h}px; }
      #logo-base { top: ${baseTop}px; height: ${baseH}px; }
      .tag { color: ${C.black}; }
      .tag .ln { font-weight: 600; }
      #field { position: absolute; left: ${SAFE.left}px; top: ${fieldTop}px; width: ${field.w}px; height: ${field.h}px; border-radius: ${field.h / 2}px; background: ${C.white}; box-shadow: 0 30px 70px rgba(0,0,0,0.16), 0 0 0 2px rgba(0,0,0,0.06); display: flex; align-items: center; padding: 0 44px 0 34px; gap: 28px; transform-origin: center center; }
      .avatar { width: 112px; height: 112px; flex: none; border-radius: 50%; background: ${C.blue}; opacity: 0.16; }
      .placeholder { position: absolute; left: 174px; font-size: 40px; font-weight: 400; color: ${C.black}; opacity: 0.45; white-space: nowrap; }
      .typed { display: flex; align-items: center; font-size: ${kwSize}px; font-weight: 700; color: ${C.blue}; letter-spacing: 0.02em; line-height: 1; }
      .caret { display: inline-block; width: 7px; height: ${Math.round(kwSize * 0.82)}px; margin-left: 8px; background: ${C.blue}; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${FRAME.height}" data-duration="${endTotal(b.total)}" data-fps="${FRAME.fps}">
      ${shape("organique-large", "deco", `left:520px;top:1080px;width:760px;opacity:0.07`, C.blue).replace('class="deco"', 'class="deco" id="deco-hook"')}

      <!-- 0 · Accroche : lisible dès la première image -->
      <div class="blk" id="hook-title" style="top:${top}px">${linesHtml("hook", hookL, "em-blue")}</div>
      ${hookCompL.length ? `<div class="blk" id="hook-sub" style="top:${top + hookH + 20}px">${hookCompL.map((l, i) => `<div class="ln" id="hook-s${i}" style="font-size:${l.size}px;font-weight:400;height:${Math.round(l.size * LH)}px"><span class="in">${escapeHtml(plain(l.tokens))}</span></div>`).join("")}</div>` : ""}

      <div class="layer" id="net">
        <svg id="links" viewBox="0 0 ${W} ${FRAME.height}" aria-hidden="true">
          <line id="link-a" x1="${nodeX[0]}" y1="${nodeY}" x2="${nodeX[1]}" y2="${nodeY}" />
          <line id="link-b" x1="${nodeX[1]}" y1="${nodeY}" x2="${nodeX[2]}" y2="${nodeY}" />
        </svg>
        ${hexNode("n-from", nodeX[0], nodeY, NODE, spec.card.from)}
        ${hexNode("n-contact", nodeX[1], nodeY, NODE, spec.card.contact)}
        ${hexNode("n-to", nodeX[2], nodeY, NODE, spec.card.to)}
        <div class="dot" id="dot" style="left:${nodeX[0]}px;top:${nodeY}px"></div>
      </div>

      <div class="wipe" id="wipe-a"></div>
      <div class="blk" id="cons-title" style="top:${top}px;color:${C.white}">${linesHtml("cons", consL, "em-box")}</div>
      <p class="caption" id="cons-caption" style="top:${consCardY + 455}px">Exemple de parcours</p>

      <!-- Démonstration : grands mots d'étape -->
      ${stepL.map((lines, i) => `<div class="blk" id="step-${i}" style="top:${top + 30}px">${linesHtml(`step${i}`, lines, "em-blue")}<p class="sub" id="step-${i}-sub" style="margin-top:18px;font-size:52px">${escapeHtml(spec.steps.items[i].complement)}</p></div>`).join("")}
      ${spec.steps.footnote ? `<p class="foot" id="foot">${escapeHtml(spec.steps.footnote)}</p>` : ""}

      <!-- La carte qui circule -->
      <div id="card">
        <div class="card-head">
          <svg class="card-ico" viewBox="${HEX.viewBox}" aria-hidden="true"><path d="${HEX.d}" transform="${HEX.transform ?? ""}"/></svg>
          <div><p class="card-label">${escapeHtml(spec.card.label)}</p><p class="card-route">${escapeHtml(spec.card.from)} → ${escapeHtml(spec.card.to)}</p></div>
        </div>
        <div class="pill blue" id="pill-0">${escapeHtml(spec.card.status)}</div>
        <div class="pill green" id="pill-1">${CHECK}${escapeHtml(spec.consequence.status)}</div>
        ${spec.steps.items.map((s, i) => `<div class="pill ${i === 2 ? "green" : "blue"}" id="pill-s${i}">${i === 2 ? CHECK : ""}${escapeHtml(sentence(s.title))}</div>`).join("")}
        <div class="doc" id="doc"><i style="width:100%"></i><i style="width:82%"></i><i style="width:64%"></i>
          <svg viewBox="0 0 230 70"><path id="sign" d="M6 52 C 28 10, 42 10, 46 40 S 70 62, 84 30 S 112 6, 120 42 S 150 58, 168 34 L 224 34" /></svg></div>
        <div class="track" id="track">${spec.steps.items.map((s, i) => `
          <div class="row" id="row-${i}"><span class="mark"><span class="ring"></span><span class="fill" id="fill-${i}"></span><span class="ok" id="ok-${i}">${CHECK_WHITE}</span></span><span class="row-label" id="rl-${i}">${escapeHtml(sentence(s.title))}</span></div>`).join("")}
        </div>
      </div>

      <!-- Rupture : coupe franche sur fond noir -->
      <div class="layer" id="rupt" style="background:${C.black}">
        <div class="blk center" id="rupt-title" style="top:${ruptTop}px;color:${C.white}">${linesHtml("rupt", ruptL, "em-blue")}</div>
      </div>

      <!-- Valeur -->
      <div class="blk" id="val-title" style="top:${top}px">${linesHtml("val", valL, "em-blue")}</div>

      <!-- Signature : fond blanc, logo de fin officiel et baseline (comme les vidéos montées) -->
      ${shape("organique-s", "deco", "left:-120px;top:120px;width:520px;opacity:0.1", C.blue).replace('class="deco"', 'class="deco" id="deco-s"')}
      ${shape("organique-haute", "deco", "left:800px;top:1180px;width:420px;opacity:0.1", C.blue).replace('class="deco"', 'class="deco" id="deco-h"')}
      <img id="logo" src="${base}/${LOGOS.endHorizontal.file}" alt="BeeRecos" width="${logo.w}" height="${logo.h}" />
      <img id="logo-base" src="${base}/${LOGOS.endBaseline.file}" alt="#MonReseauCestTonReseau" width="${logo.w}" height="${baseH}" />
      <div class="blk center tag" id="sig-tag" style="top:${tagTop}px">${linesHtml("sig", sigL, "em-blue")}</div>

      <!-- Appel à l'action : le mot-clé se saisit dans un champ commentaire illustré -->
      <div class="blk center" id="cta-verb" style="top:${verbTop}px;color:${C.black}"><div class="ln" id="cta-v" style="font-size:${verbSize}px;height:${Math.round(verbSize * LH)}px"><span class="in">${escapeHtml(spec.cta.verb)}</span></div></div>
      <div id="field">
        <span class="avatar"></span>
        <span class="placeholder" id="ph">Ajoute un commentaire…</span>
        <span class="typed">${[...spec.cta.keyword].map((ch, i) => `<span id="k${i}">${escapeHtml(ch)}</span>`).join("")}<span class="caret" id="caret"></span></span>
      </div>
      <div class="blk center tag" id="cta-comp" style="top:${fieldTop + field.h + 56}px">${linesHtml("ctac", ctaCompL, "em-blue")}</div>

      <div id="guide" aria-hidden="true"><div id="guide-in"><img class="g-bleu" src="${base}/${PICTOGRAM.blue}" alt="" width="${GUIDE_BASE_WIDTH}" height="${GUIDE_BASE_HEIGHT}" /><img class="g-blanc" src="${base}/${PICTOGRAM.white}" alt="" width="${GUIDE_BASE_WIDTH}" height="${GUIDE_BASE_HEIGHT}" style="opacity:0" /></div></div>

      ${opts.soundtrackSrc ? `<audio id="soundtrack" src="${escapeHtml(opts.soundtrackSrc)}" data-start="0" data-duration="${b.total}" data-track-index="1" data-volume="0.6"></audio>` : ""}
      ${endVideoClip(base, b.total)}
      ${voices.map(({ k, a }) => `<audio id="vo-${k}" src="${escapeHtml(opts.resolveVoice ? opts.resolveVoice(a!.src, k) : a!.src)}" data-start="${b.voiceAt[k]}" data-duration="${a!.duration}" data-track-index="2" data-volume="1.25"></audio>`).join("\n      ")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      Promise.all(${JSON.stringify(FONT_FILES.map((f) => f.weight))}.map((w) => document.fonts.load(w + " 100px ${FONT_FAMILY}"))).catch(() => {}).then(() => {
        const tl = gsap.timeline({ paused: true });
${timelineScript(spec, b, { card, cardHookY, consCardY, nodeX, nodeY, logo, logoTop, poses, hookL, consL, valL, stepL, sigL, ctaCompL, hookCompL, ruptL })}
        window.__timelines["main"] = tl;
        if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
      });
    </script>
  </body>
</html>
`;
  return html;
}

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK_WHITE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="#FFFFFF" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

type Layout = {
  card: { w: number; x: number; y: number }; cardHookY: number; consCardY: number; nodeX: number[]; nodeY: number;
  logo: { w: number; h: number }; logoTop: number; poses: Record<"hook" | "cons" | "rupt" | "value" | "steps" | "cta", GuidePose>;
  hookL: Line[]; consL: Line[]; valL: Line[]; stepL: Line[][]; sigL: Line[]; ctaCompL: Line[]; hookCompL: Line[]; ruptL: Line[];
};

/** Chronologie GSAP : entrées rapides qui se posent (expo/power3), petits rebonds réservés aux éléments d'interface. */
function timelineScript(spec: StorySpec, b: ReturnType<typeof storyBeats>, L: Layout): string {
  const s = b.start;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const lines: string[] = [];
  const add = (code: string) => lines.push(`        ${code}`);
  const ids = (p: string, n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => `#${p}-l${i} .in`));
  const enter = (p: string, n: number, at: number, from = "yPercent: 105", stagger = 0.08, dur = 0.3) =>
    add(`tl.fromTo(${ids(p, n)}, { ${from} }, { yPercent: 0, xPercent: 0, duration: ${dur}, ease: "expo.out", stagger: ${stagger} }, ${r(at)});`);
  const exitUp = (p: string, n: number, at: number) =>
    add(`tl.to(${ids(p, n)}, { yPercent: -110, duration: 0.2, ease: "power2.in", stagger: 0.04 }, ${r(at)});`);
  const show = (sel: string, at: number) => add(`tl.set(${JSON.stringify(sel)}, { autoAlpha: 1 }, ${r(at)});`);
  const hide = (sel: string, at: number) => add(`tl.set(${JSON.stringify(sel)}, { autoAlpha: 0 }, ${r(at)});`);
  const cardCenterX = L.card.x + L.card.w / 2;
  const cx = (x: number) => r(x - cardCenterX);
  const cy = (y: number) => r(y - L.card.y);

  // État initial (t = 0) : seuls l'accroche, le réseau et la carte existent.
  add(`tl.set(["#cons-title", "#cons-caption", "#rupt", "#val-title", "#step-0", "#step-1", "#step-2", "#foot", "#deco-s", "#deco-h", "#logo", "#logo-base", "#sig-tag", "#cta-verb", "#field", "#cta-comp", "#pill-1", "#pill-s0", "#pill-s1", "#pill-s2", "#doc", "#track", "#dot"], { autoAlpha: 0 }, 0);`);
  add(`tl.set("#links line", { attr: { "stroke-dasharray": 300, "stroke-dashoffset": 300 } }, 0);`);

  // ── 0 · ACCROCHE — message lisible dès la première image, mise en place rapide.
  add(`tl.fromTo("#hook-l0", { scale: 1.12, transformOrigin: "left center" }, { scale: 1, duration: 0.42, ease: "expo.out" }, 0);`);
  if (L.hookL.length > 1) add(`tl.fromTo(${JSON.stringify(L.hookL.slice(1).map((_, i) => `#hook-l${i + 1}`))}, { scale: 0.9, transformOrigin: "left center" }, { scale: 1, duration: 0.4, ease: "expo.out", stagger: 0.07 }, 0);`);
  if (L.hookCompL.length) add(`tl.fromTo(${JSON.stringify(L.hookCompL.map((_, i) => `#hook-s${i} .in`))}, { yPercent: 105 }, { yPercent: 0, duration: 0.3, ease: "expo.out", stagger: 0.08 }, 0.32);`);
  add(`tl.fromTo(["#n-from", "#n-contact", "#n-to"], { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.32, ease: "back.out(1.7)", stagger: 0.08 }, 0.18);`);
  // La carte entre par la gauche, au-dessus de l'apporteur, puis glisse vers le professionnel.
  const hookScale = 0.8;
  const hookY = cy(L.cardHookY - (210 * (1 - hookScale)) / 2);
  add(`tl.set("#card", { x: ${cx(L.nodeX[0] + 130) - 760}, y: ${hookY}, scale: ${hookScale} }, 0);`);
  add(`tl.to("#card", { x: ${cx(L.nodeX[0] + 130)}, duration: 0.34, ease: "power3.out" }, ${b.hook.cardIn});`);
  add(`tl.to("#card", { x: ${cx(L.nodeX[2] - 130)}, duration: 0.5, ease: "power2.inOut" }, ${b.hook.travel});`);
  add(`tl.to("#link-a", { attr: { "stroke-dashoffset": 0 }, duration: 0.25, ease: "none" }, ${b.hook.travel});`);
  add(`tl.to("#link-b", { attr: { "stroke-dashoffset": 0 }, duration: 0.25, ease: "none" }, ${r(b.hook.travel + 0.25)});`);
  show("#dot", b.hook.travel);
  add(`tl.fromTo("#dot", { x: 0 }, { x: ${L.nodeX[2] - L.nodeX[0]}, duration: 0.5, ease: "power2.inOut" }, ${b.hook.travel});`);
  add(`tl.set("#n-to", { attr: { class: "node on" } }, ${r(b.hook.travel + 0.5)});`);
  hide("#dot", r(b.hook.travel + 0.52));
  exitUp("hook", L.hookL.length, b.hook.exit);
  hide("#hook-title", r(b.hook.exit + 0.3));
  if (L.hookCompL.length) add(`tl.to("#hook-sub", { autoAlpha: 0, y: -20, duration: 0.15, ease: "power2.in" }, ${b.hook.exit});`);

  // ── 1 · CONSÉQUENCE — le bleu naît de la carte, qui devient un contrat.
  const wipeAt = (sel: string, x: number, y: number, at: number) => {
    add(`tl.set(${JSON.stringify(sel)}, { autoAlpha: 1, left: ${r(x - 2300)}, top: ${r(y - 2300)}, scale: 0 }, ${r(at)});`);
    add(`tl.to(${JSON.stringify(sel)}, { scale: 1, duration: 0.36, ease: "power2.inOut" }, ${r(at)});`);
  };
  wipeAt("#wipe-a", L.nodeX[2] - 130, L.cardHookY + 84, b.consequence.wipe - 0.08);
  add(`tl.to(["#net", "#deco-hook"], { autoAlpha: 0, duration: 0.18 }, ${r(b.consequence.wipe)});`);
  add(`tl.to("#card", { x: 0, y: ${cy(L.consCardY)}, scale: 1, height: 420, duration: 0.36, ease: "power3.out" }, ${r(b.consequence.wipe)});`);
  show("#cons-title", s.consequence);
  enter("cons", L.consL.length, s.consequence + 0.1);
  add(`tl.fromTo("#cons-title .bx", { scaleX: 0 }, { scaleX: 1, duration: 0.26, ease: "power3.out" }, ${r(s.consequence + 0.38)});`);
  // Le mot passe en bleu (invisible sur le fond bleu) au départ du surlignage blanc : il apparaît À TRAVERS le surlignage.
  add(`tl.set("#cons-title .tx", { color: "${COLORS.blue}" }, ${r(s.consequence + 0.38)});`);
  show("#doc", b.consequence.doc);
  add(`tl.fromTo("#doc i", { scaleX: 0 }, { scaleX: 1, duration: 0.25, ease: "power3.out", stagger: 0.06 }, ${b.consequence.doc});`);
  add(`tl.fromTo("#sign", { attr: { "stroke-dasharray": 420, "stroke-dashoffset": 420 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.32, ease: "power1.inOut" }, ${r(b.consequence.doc + 0.12)});`);
  add(`tl.to("#pill-0", { autoAlpha: 0, scale: 0.8, duration: 0.12 }, ${r(b.consequence.signed - 0.1)});`);
  add(`tl.fromTo("#pill-1", { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, ${b.consequence.signed});`);
  add(`tl.fromTo("#cons-caption", { autoAlpha: 0, y: 16 }, { autoAlpha: 0.85, y: 0, duration: 0.25, ease: "power2.out" }, ${r(b.consequence.signed + 0.15)});`);

  // ── 2 · RUPTURE — coupe franche : noir, question immense, plus rien ne bouge.
  show("#rupt", s.rupture);
  hide(["#card", "#wipe-a", "#cons-title", "#cons-caption"].join(","), s.rupture);
  add(`tl.fromTo(${JSON.stringify(L.ruptL.map((_, i) => `#rupt-l${i}`))}, { scale: 1.06 }, { scale: 1, duration: 0.14, ease: "power2.out" }, ${s.rupture});`);

  // ── 3 · VALEUR — retour au blanc, la phrase arrive par groupes, VALEUR prend la place.
  hide("#rupt", s.value);
  add(`tl.set("#net", { autoAlpha: 1 }, ${s.value});`);
  add(`tl.set(["#n-contact", "#n-to"], { scale: 0, autoAlpha: 0, attr: { class: "node" } }, ${s.value});`);
  add(`tl.set("#links line", { attr: { "stroke-dashoffset": 300 } }, ${s.value});`);
  add(`tl.fromTo("#n-from", { x: ${540 - L.nodeX[0]}, y: -40, scale: 1.2 }, { x: 0, y: 0, scale: 1, duration: 0.4, ease: "power3.inOut", immediateRender: false }, ${s.value});`);
  show("#val-title", s.value);
  L.valL.forEach((l, i) => {
    const em = l.tokens.some((k) => k.em);
    const at = r(b.value.lines + i * 0.09 + (em ? 0.08 : 0));
    add(em
      ? `tl.fromTo("#val-l${i}", { scale: 1.28, transformOrigin: "left center" }, { scale: 1, duration: 0.45, ease: "expo.out" }, ${at}); tl.fromTo("#val-l${i} .in", { yPercent: 105 }, { yPercent: 0, duration: 0.3, ease: "expo.out" }, ${at});`
      : `tl.fromTo("#val-l${i} .in", { yPercent: 105 }, { yPercent: 0, duration: 0.28, ease: "expo.out" }, ${at});`);
  });
  add(`tl.fromTo(["#n-contact", "#n-to"], { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(1.7)", stagger: 0.09, immediateRender: false }, ${b.value.nodes});`);
  add(`tl.to("#link-a", { attr: { "stroke-dashoffset": 0 }, duration: 0.28, ease: "power2.out" }, ${b.value.link1});`);
  add(`tl.to("#link-b", { attr: { "stroke-dashoffset": 0 }, duration: 0.28, ease: "power2.out" }, ${b.value.link2});`);
  show("#dot", b.value.pulse);
  add(`tl.fromTo("#dot", { x: 0, scale: 1 }, { x: ${L.nodeX[2] - L.nodeX[0]}, duration: 0.6, ease: "power1.inOut", immediateRender: false }, ${b.value.pulse});`);
  add(`tl.set(["#n-from", "#n-contact", "#n-to"], { attr: { class: "node on" } }, ${r(b.value.pulse + 0.6)});`);
  add(`tl.to("#dot", { scale: 2.2, autoAlpha: 0, duration: 0.25, ease: "power2.out" }, ${r(b.value.pulse + 0.6)});`);
  exitUp("val", L.valL.length, b.value.exit);
  hide("#val-title", r(b.value.exit + 0.3));

  // ── 4 · DÉMONSTRATION — la carte renaît du repère « Toi » et franchit trois étapes.
  add(`tl.to("#net", { autoAlpha: 0, duration: 0.2 }, ${b.value.exit});`);
  hide(["#doc", "#pill-1", "#pill-0"].join(","), s.steps - 0.3);
  add(`tl.set("#card", { autoAlpha: 1, height: 500, x: ${cx(L.nodeX[0])}, y: ${cy(L.nodeY - 250)}, scale: 0.2 }, ${r(b.value.exit)});`);
  add(`tl.to("#card", { x: 0, y: ${cy(820)}, scale: 1, duration: 0.38, ease: "power3.out" }, ${r(b.value.exit + 0.02)});`);
  show("#track", r(b.value.exit));
  spec.steps.items.forEach((_, i) => {
    const at = b.steps[i];
    show(`#step-${i}`, at);
    add(`tl.fromTo(${ids(`step${i}`, L.stepL[i].length)}, { xPercent: 18, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 0.3, ease: "expo.out", stagger: 0.07 }, ${r(at + 0.04)});`);
    add(`tl.fromTo("#step-${i}-sub", { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.26, ease: "power3.out" }, ${r(at + 0.14)});`);
    if (i > 0) {
      add(`tl.to("#step-${i - 1}", { x: -120, autoAlpha: 0, duration: 0.16, ease: "power2.in" }, ${r(at - 0.14)});`);
      add(`tl.to("#fill-${i - 1}", { scale: 0, duration: 0.15 }, ${r(at)});`);
      add(`tl.fromTo("#ok-${i - 1}", { scale: 0 }, { scale: 1, duration: 0.28, ease: "back.out(2)" }, ${r(at)});`);
      add(`tl.to("#pill-s${i - 1}", { autoAlpha: 0, duration: 0.1 }, ${r(at)});`);
    }
    add(`tl.fromTo("#fill-${i}", { scale: 0 }, { scale: 1, duration: 0.3, ease: "back.out(2.2)" }, ${r(at + 0.1)});`);
    add(`tl.to("#rl-${i}", { opacity: 1, duration: 0.2 }, ${r(at + 0.1)});`);
    add(`tl.fromTo("#pill-s${i}", { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.28, ease: "back.out(2)" }, ${r(at + 0.12)});`);
  });
  add(`tl.to("#fill-2", { scale: 0, duration: 0.15 }, ${r(b.steps[2] + 0.42)});`);
  add(`tl.fromTo("#ok-2", { scale: 0 }, { scale: 1, duration: 0.28, ease: "back.out(2)" }, ${r(b.steps[2] + 0.42)});`);
  if (spec.steps.footnote) add(`tl.fromTo("#foot", { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power3.out" }, ${r(b.steps[2] + 0.18)});`);

  // ── 5 · SIGNATURE — la carte s'efface sur le blanc ; le logo officiel se pose (opacité + échelle homothétique), puis la baseline.
  add(`tl.to("#card", { scale: 0.7, autoAlpha: 0, duration: 0.25, ease: "power2.in" }, ${r(b.signature.wipe)});`);
  hide(["#step-2", "#foot", "#track"].join(","), r(b.signature.wipe + 0.3));
  add(`tl.fromTo(["#deco-s", "#deco-h"], { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 0.08, scale: 1, duration: 0.5, ease: "power3.out" }, ${r(b.signature.wipe + 0.15)});`);
  add(`tl.fromTo("#logo", { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power3.out" }, ${b.signature.logo});`);
  add(`tl.fromTo("#logo-base", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: "power2.out" }, ${r(b.signature.logo + 0.25)});`);
  show("#sig-tag", b.signature.tagline);
  enter("sig", L.sigL.length, b.signature.tagline, "yPercent: 105", 0.09, 0.32);

  // ── 6 · APPEL À L'ACTION — le logo monte, le mot-clé se tape, puis tout reste immobile jusqu'à la fin.
  add(`tl.to(["#logo", "#logo-base"], { autoAlpha: 0, scale: 0.96, duration: 0.25, ease: "power2.in" }, ${b.cta.logoMove});`);
  add(`tl.to("#sig-tag", { autoAlpha: 0, y: -30, duration: 0.2, ease: "power2.in" }, ${b.cta.logoMove});`);
  show("#cta-verb", b.cta.verb);
  add(`tl.fromTo("#cta-v .in", { yPercent: 105 }, { yPercent: 0, duration: 0.32, ease: "expo.out" }, ${b.cta.verb});`);
  add(`tl.fromTo("#field", { autoAlpha: 0, scale: 0.92, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.6)" }, ${b.cta.field});`);
  add(`tl.set(${JSON.stringify([...spec.cta.keyword].map((_, i) => `#k${i}`))}, { display: "none" }, 0);`);
  b.cta.typing.forEach((t, i) => add(`tl.set("#k${i}", { display: "inline" }, ${t});`));
  hide("#ph", b.cta.typing[0]);
  for (let t = b.cta.stable; t < b.total - 0.2; t += 0.5) add(`tl.set("#caret", { opacity: ${Math.round((t - b.cta.stable) / 0.5) % 2 ? 1 : 0} }, ${r(t)});`);
  show("#cta-comp", b.cta.complement);
  enter("ctac", L.ctaCompL.length, b.cta.complement, "yPercent: 105", 0.08, 0.3);
  // ── LE GUIDE — entre avec les mots, accompagne les transitions, se tait sur la rupture, réagit à VALEUR et à CLUB.
  const g = guideGsap(spec.motion);
  const P = L.poses;
  add(g.couleur(0, "bleu"));
  add(g.entrer(0, P.hook));
  add(g.reagir(r(b.hook.travel + 0.5)));
  add(g.accompagner(s.consequence, P.cons));
  add(g.couleur(r(s.consequence + 0.18), "blanc"));
  add(g.place(s.rupture, P.rupt));
  add(g.couleur(s.value, "bleu"));
  add(g.place(s.value, P.value)); // coupe franche avec le fond : le guide ne traverse pas le réseau
  const valueEm = Math.max(0, L.valL.findIndex((l) => l.tokens.some((k) => k.em)));
  add(g.reagir(r(b.value.lines + valueEm * 0.09 + 0.08 + 0.3)));
  add(g.accompagner(b.value.exit, P.steps));
  b.steps.slice(0, 2).forEach((t) => add(g.pousser(r(t + 0.12))));
  add(g.reagir(r(b.steps[2] + 0.42)));
  add(g.sortir(b.signature.wipe));
  add(g.couleur(b.cta.logoMove, "bleu"));
  add(g.entrer(r(b.cta.logoMove + 0.15), P.cta));
  add(g.reagir(r(b.cta.typing[b.cta.typing.length - 1] + 0.15)));

  // Fin : la chronologie couvre toute la durée (dernière image stable, rien n'est coupé).
  // Même fin que les Reels (2026-11-10) : vidéo de fin officielle BeeRecos après l'appel à l'action.
  add(`tl.set("#end-video", { autoAlpha: 1 }, ${b.total});`);
  add(`tl.set({}, {}, ${endTotal(b.total)});`);
  return lines.join("\n");
}

/** Vidéo de fin officielle (la même que les Reels filmés), jouée plein cadre après l'appel à l'action, sans son. */
export const endTotal = (total: number) => Math.round((total + END_VIDEO.durationMs / 1000) * 1000) / 1000;
export function endVideoClip(base: string, total: number): string {
  return `<video id="end-video" class="clip" src="${base}/${END_VIDEO.file}" data-start="${total}" data-duration="${END_VIDEO.durationMs / 1000}" data-has-audio="false" muted playsinline data-track-index="7" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:90;visibility:hidden"></video>`;
}

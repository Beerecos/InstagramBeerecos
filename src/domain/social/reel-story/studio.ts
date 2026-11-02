import { COLORS, FONT_FAMILY, FONT_FILES, FRAME, PICTOGRAM, SAFE, SAFE_WIDTH } from "./brand";
import { escapeHtml, fitBlock, layoutLines } from "./composition";
import { GUIDE_BASE_HEIGHT, GUIDE_BASE_WIDTH, guideGsap } from "./guide";
import { fitSize } from "./metrics";
import { brandCase } from "./spec";
import type { GuideMode } from "./guide";

/**
 * Entrée « vidéo studio » : une vidéo verticale fournie (face caméra, interview…) habillée aux couleurs BeeRecos.
 * Accroche dans les deux premières secondes, sous-titres issus d'une VRAIE transcription de l'audio (jamais inventés),
 * pictogramme guide discret, puis carte finale « Commente CLUB » stable au moins trois secondes.
 */

export type Caption = { start: number; end: number; text: string };
export type StudioSpec = {
  kind: "studio";
  title: string;
  hook: string;
  duration: number;
  captions: Caption[];
  cta: { verb: string; keyword: string; complement: string };
  motion: GuideMode;
};

export const STUDIO_MIN_SECONDS = 8;
export const STUDIO_MAX_SECONDS = 90;
const CTA_SECONDS = 4.5;

export function parseStudioSpec(input: unknown): { ok: true; spec: StudioSpec } | { ok: false; errors: string[] } {
  const o = (input ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const title = typeof o.title === "string" ? o.title.trim().slice(0, 80) : "";
  const hook = typeof o.hook === "string" ? brandCase(o.hook.trim()).slice(0, 60) : "";
  const duration = Number(o.duration);
  if (!title) errors.push("Titre manquant.");
  if (!hook) errors.push("Accroche manquante (affichée dès la première seconde).");
  if (!Number.isFinite(duration) || duration < STUDIO_MIN_SECONDS || duration > STUDIO_MAX_SECONDS) errors.push(`Durée de la vidéo entre ${STUDIO_MIN_SECONDS} et ${STUDIO_MAX_SECONDS} s.`);
  const captions = (Array.isArray(o.captions) ? o.captions : []).map((c) => c as Caption)
    .filter((c) => Number.isFinite(c?.start) && Number.isFinite(c?.end) && c.end > c.start && typeof c.text === "string" && c.text.trim())
    .map((c) => ({ start: Math.max(0, c.start), end: Math.min(duration, c.end), text: brandCase(c.text.trim()).slice(0, 140) }));
  const cta = (o.cta ?? {}) as Record<string, unknown>;
  const keyword = String(cta.keyword ?? "CLUB").toUpperCase();
  if (!/^[A-ZÀ-Ý0-9]{2,20}$/.test(keyword)) errors.push("Mot-clé invalide (2 à 20 lettres ou chiffres, ex. DIGITALISATION).");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    spec: {
      kind: "studio", title, hook, duration: Math.round(duration * 100) / 100, captions,
      cta: { verb: String(cta.verb ?? "COMMENTE"), keyword, complement: brandCase(String(cta.complement ?? "pour recevoir le lien de visite.")) },
      motion: o.motion === "discret" ? "discret" : "dynamique",
    },
  };
}

/** Composition Hyperframes d'une vidéo studio (le fichier vidéo est dans le projet sous `videoSrc`). */
export function buildStudioComposition(spec: StudioSpec, opts: { assetBase: string; videoSrc: string; preview?: boolean }): string {
  const base = opts.assetBase.replace(/\/$/, "");
  const W = FRAME.width, H = FRAME.height;
  const ctaAt = Math.max(2.5, spec.duration - CTA_SECONDS);
  const hookL = fitBlock(spec.hook.toUpperCase(), 700, 104, 72, 380, SAFE_WIDTH - 60);
  const verbSize = fitSize(spec.cta.verb, 700, SAFE_WIDTH, 150, 60);
  const kwSize = Math.min(118, fitSize(spec.cta.keyword, 700, SAFE_WIDTH - 260, 118, 60));
  const compL = layoutLines(spec.cta.complement, 600, 56, 48);
  const g = guideGsap(spec.motion);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const guideSmall = { cx: SAFE.left + SAFE_WIDTH - 50, cy: SAFE.top + 70, h: 120 };
  const guideCta = { cx: W / 2, cy: SAFE.top + 130, h: 220 };
  const verbTop = SAFE.top + 20 + 220 + 44;
  const fieldTop = verbTop + Math.round(verbSize * 1.14) + 34;
  const typing = [...spec.cta.keyword].map((_, i) => r(ctaAt + 0.5 + i * 0.12));
  const fonts = FONT_FILES.map((f) => `@font-face { font-family: "${FONT_FAMILY}"; font-weight: ${f.weight}; font-display: block; src: url("${base}/fonts/${f.file}") format("woff2"); }`).join("\n      ");
  const tweens = [
    g.couleur(0, "blanc"),
    g.entrer(0, guideSmall),
    // Accroche lisible dès la première image : seule une translation courte la met en mouvement.
    `tl.fromTo("#hook", { yPercent: 14 }, { yPercent: 0, duration: 0.35, ease: "expo.out" }, 0);`,
    `tl.to("#hook", { autoAlpha: 0, y: -24, duration: 0.25, ease: "power2.in" }, ${r(Math.min(3.2, ctaAt - 0.4))});`,
    ...spec.captions.filter((c) => c.start < ctaAt).map((c, i) => `tl.set("#cap-${i}", { autoAlpha: 1 }, ${r(c.start)}); tl.set("#cap-${i}", { autoAlpha: 0 }, ${r(Math.min(c.end, ctaAt))});`),
    `tl.fromTo("#cta", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, ${r(ctaAt)});`,
    g.accompagner(r(ctaAt), guideCta),
    `tl.fromTo("#cta-v .in", { yPercent: 105 }, { yPercent: 0, duration: 0.32, ease: "expo.out" }, ${r(ctaAt + 0.12)});`,
    `tl.fromTo("#field", { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(1.6)" }, ${r(ctaAt + 0.3)});`,
    `tl.set(${JSON.stringify([...spec.cta.keyword].map((_, i) => `#k${i}`))}, { display: "none" }, 0);`,
    ...typing.map((t, i) => `tl.set("#k${i}", { display: "inline" }, ${t});`),
    `tl.set("#ph", { autoAlpha: 0 }, ${typing[0]});`,
    g.reagir(r((typing[typing.length - 1] ?? ctaAt) + 0.15)),
    `tl.fromTo("#cta-comp", { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power3.out" }, ${r((typing[typing.length - 1] ?? ctaAt) + 0.3)});`,
    `tl.set({}, {}, ${spec.duration});`,
  ];
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${escapeHtml(spec.title)}</title>
    <script src="${base}/gsap-3.14.2.min.js"></script>${opts.preview ? `\n    <script src="${base}/hyperframe.runtime-0.8.126.iife.js"></script>` : ""}
    <style>
      ${fonts}
      html, body { margin: 0; width: ${W}px; height: ${H}px; background: ${COLORS.black}; font-family: "${FONT_FAMILY}", sans-serif; }
      #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: ${COLORS.black}; }
      #studio { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      #hook { position: absolute; left: ${SAFE.left}px; top: ${SAFE.top + 170}px; width: ${SAFE_WIDTH - 60}px; padding: 22px 28px; background: ${COLORS.blue}; border-radius: 28px; color: ${COLORS.white}; }
      #hook .ln { font-weight: 700; line-height: 1.12; white-space: nowrap; }
      .cap { position: absolute; left: ${SAFE.left}px; width: ${SAFE_WIDTH}px; top: 1250px; text-align: center; visibility: hidden; opacity: 0; }
      .cap span { display: inline; padding: 6px 14px; line-height: 1.45; font-size: 50px; font-weight: 600; color: ${COLORS.white}; background: rgba(0,0,0,0.72); border-radius: 12px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
      #cta { position: absolute; inset: 0; background: ${COLORS.blue}; }
      .center { position: absolute; left: ${SAFE.left}px; width: ${SAFE_WIDTH}px; text-align: center; color: ${COLORS.white}; }
      .ln { overflow: hidden; line-height: 1.14; font-weight: 700; white-space: nowrap; }
      .in { display: inline-block; }
      #field { position: absolute; left: ${SAFE.left}px; top: ${fieldTop}px; width: ${SAFE_WIDTH}px; height: 200px; border-radius: 100px; background: ${COLORS.white}; display: flex; align-items: center; padding: 0 44px 0 34px; gap: 28px; }
      .avatar { width: 112px; height: 112px; flex: none; border-radius: 50%; background: ${COLORS.blue}; opacity: 0.16; }
      .placeholder { position: absolute; left: 174px; font-size: 40px; color: ${COLORS.black}; opacity: 0.45; white-space: nowrap; }
      .typed { font-size: ${kwSize}px; font-weight: 700; color: ${COLORS.blue}; line-height: 1; }
      #guide { position: absolute; left: 0; top: 0; width: ${GUIDE_BASE_WIDTH}px; height: ${GUIDE_BASE_HEIGHT}px; transform-origin: 50% 50%; }
      #guide-in { position: absolute; inset: 0; transform-origin: 50% 50%; }
      #guide img { position: absolute; inset: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${spec.duration}" data-fps="${FRAME.fps}">
      <video id="studio" src="${escapeHtml(opts.videoSrc)}" data-start="0" data-duration="${spec.duration}" data-track-index="0" data-has-audio="true" playsinline></video>
      <div id="hook">${hookL.map((l) => `<div class="ln" style="font-size:${l.size}px"><span class="in">${escapeHtml(l.tokens.map((k) => (k.space ? " " : "") + k.t).join(""))}</span></div>`).join("")}</div>
      ${spec.captions.filter((c) => c.start < ctaAt).map((c, i) => `<p class="cap" id="cap-${i}"><span>${escapeHtml(c.text)}</span></p>`).join("\n      ")}
      <div id="cta" style="visibility:hidden;opacity:0">
        <div class="center" style="top:${verbTop}px"><div class="ln" id="cta-v" style="font-size:${verbSize}px"><span class="in">${escapeHtml(spec.cta.verb)}</span></div></div>
        <div id="field"><span class="avatar"></span><span class="placeholder" id="ph">Ajoute un commentaire…</span><span class="typed">${[...spec.cta.keyword].map((ch, i) => `<span id="k${i}">${escapeHtml(ch)}</span>`).join("")}</span></div>
        <div class="center" id="cta-comp" style="top:${fieldTop + 256}px">${compL.map((l) => `<div class="ln" style="font-size:${l.size}px;font-weight:600"><span class="in">${escapeHtml(l.tokens.map((k) => (k.space ? " " : "") + k.t).join(""))}</span></div>`).join("")}</div>
      </div>
      <div id="guide" aria-hidden="true"><div id="guide-in"><img class="g-bleu" src="${base}/${PICTOGRAM.blue}" alt="" /><img class="g-blanc" src="${base}/${PICTOGRAM.white}" alt="" style="opacity:0" /></div></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      Promise.all(${JSON.stringify(FONT_FILES.map((f) => f.weight))}.map((w) => document.fonts.load(w + " 100px ${FONT_FAMILY}"))).catch(() => {}).then(() => {
        const tl = gsap.timeline({ paused: true });
        ${tweens.join("\n        ")}
        window.__timelines["main"] = tl;
        if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
      });
    </script>
  </body>
</html>
`;
}

/** Sous-titres à partir des segments d'une transcription (OpenAI verbose_json) : lignes courtes, temps réels. */
export function captionsFromSegments(segments: { start: number; end: number; text: string }[], maxChars = 34): Caption[] {
  const out: Caption[] = [];
  for (const s of segments) {
    const words = s.text.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const chunks: string[][] = [[]];
    for (const w of words) {
      const cur = chunks[chunks.length - 1];
      if (cur.length && [...cur, w].join(" ").length > maxChars) chunks.push([w]); else cur.push(w);
    }
    const total = words.join(" ").length || 1;
    let t = s.start;
    for (const c of chunks) {
      const text = c.join(" ");
      const d = ((s.end - s.start) * text.length) / total;
      out.push({ start: Math.round(t * 100) / 100, end: Math.round((t + d) * 100) / 100, text });
      t += d;
    }
  }
  return out;
}

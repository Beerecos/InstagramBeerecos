#!/usr/bin/env node
// Génère les projets HyperFrames (accroche 4 s + signature 6 s) pour chaque format à partir de hyperframes/src/*.html
// et de config/promo.json, puis (option --render) les rend en MP4 muets dans public/clips/.
// Usage : node scripts/build-hyperframes.mjs [--render] [--check]
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "config/promo.json"), "utf8"));
const args = new Set(process.argv.slice(2));
const fps = cfg.video.fps;
const scene = (id) => cfg.scenes.find((s) => s.id === id);
const px = (n) => `${Math.round(n * 10) / 10}px`;

// Vidéo de la rencontre (site de référence) : deux regards qui se croisent, reliés par le trait bleu.
const MEDIA = cfg.media.intro;
const VID = { w: MEDIA.w, h: MEDIA.h, a: MEDIA.a.map((n, i) => n * (i ? MEDIA.h : MEDIA.w)), b: MEDIA.b.map((n, i) => n * (i ? MEDIA.h : MEDIA.w)) };

for (const fmt of Object.values(cfg.formats)) {
  const { width: W, height: H, title, visual: V } = fmt;
  const v = fmt.id === "9x16";
  const dot = cfg.marker.size;
  // Cadrage « cover » centré entre les deux personnes.
  const focus = [(VID.a[0] + VID.b[0]) / 2, (VID.a[1] + VID.b[1]) / 2];
  const s = Math.max(V.w / VID.w, V.h / VID.h) * 1.02;
  const iw = VID.w * s;
  const ih = VID.h * s;
  const ox = Math.min(Math.max(focus[0] * s - V.w / 2, 0), iw - V.w);
  const oy = Math.min(Math.max(focus[1] * s - V.h / 2, 0), ih - V.h);
  const A = [VID.a[0] * s - ox, VID.a[1] * s - oy];
  const B = [VID.b[0] * s - ox, VID.b[1] * s - oy];
  const cx = (A[0] + B[0]) / 2;
  const cy = (A[1] + B[1]) / 2;
  const center = { x: V.x + V.w / 2, y: V.y + V.h / 2 };
  const jobs = {
    intro: {
      vars: {
        "title-x": px(title.x), "title-y": px(title.y), "title-w": px(v ? title.width : 770), "title-h": px(title.height), "title-size": px(v ? title.fontSize + 6 : 74),
        "v-x": px(V.x), "v-y": px(V.y), "v-w": px(V.w), "v-h": px(V.h),
        "img-x": px(-ox), "img-y": px(-oy), "img-w": px(iw), "img-h": px(ih), "focus-x": px(cx + ox), "focus-y": px(cy + oy), dot: `${dot}px`,
      },
      tokens: {
        VW: String(V.w), VH: String(V.h), AX: String(Math.round(A[0])), AY: String(Math.round(A[1])), BX: String(Math.round(B[0])), BY: String(Math.round(B[1])),
        LINK_LEN: String(Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]))), MEDIA_START: String(MEDIA.start),
        POINTS: JSON.stringify({ cx: V.x + cx, cy: V.y + cy, ex: center.x, ey: center.y, drift: MEDIA.drift * iw }), DOT: String(dot),
        T_RENCONTRE: String(cfg.audio.voice[0].at + 3.1),
      },
      media: { "media/rencontre.mp4": MEDIA.video },
    },
    outro: {
      vars: {
        dot: `${dot}px`, "lockup-top": px(v ? 600 : 170), "logo-w": px(v ? 400 : 300), "site-gap": px(v ? 70 : 44),
        "site-size": px(v ? 50 : 42), "sig-gap": px(v ? 34 : 22), "sig-size": px(v ? 54 : 44),
      },
      tokens: {
        DOT_PATH: JSON.stringify({ x: center.x - dot / 2, y: center.y - dot / 2, tx: W / 2 - dot / 2, ty: (v ? 600 + 210 : 170 + 160) - dot / 2 }),
        SITE: cfg.labels.site, HASHTAG: cfg.labels.hashtag,
      },
      media: {},
    },
  };
  for (const [name, job] of Object.entries(jobs)) {
    const sc = scene(name === "intro" ? "s01" : "s09");
    const dir = join(root, "hyperframes/build", `${name}-${fmt.id}`);
    mkdirSync(join(dir, "media"), { recursive: true });
    cpSync(join(root, "public/fonts"), join(dir, "fonts"), { recursive: true });
    cpSync(join(root, "public/brand"), join(dir, "brand"), { recursive: true });
    cpSync(join(root, "hyperframes/vendor/gsap-3.14.2.min.js"), join(dir, "gsap-3.14.2.min.js"));
    for (const [to, from] of Object.entries(job.media)) cpSync(join(root, "public", from), join(dir, to));
    const tokens = {
      ...job.tokens,
      // Marge de 10 images en fin de clip : Remotion n'atteint jamais la dernière image du fichier (pas de noir au raccord).
      W: String(W), H: String(H), DUR: String((sc.duration + 10) / fps),
      VARS: Object.entries(job.vars).map(([k, val]) => `--${k}: ${val};`).join(" "),
    };
    const html = readFileSync(join(root, `hyperframes/src/${name}.html`), "utf8").replace(/\{\{(\w+)\}\}/g, (_, k) => {
      if (!(k in tokens)) throw new Error(`Jeton manquant ${k} dans ${name}.html`);
      return tokens[k];
    });
    writeFileSync(join(dir, "index.html"), html);
    const hf = (a) => execFileSync("npx", ["hyperframes", ...a], { cwd: dir, stdio: "inherit" });
    if (args.has("--check")) hf(["check"]);
    if (args.has("--render")) {
      const out = join(root, "public/clips", `${name}-${fmt.id}.mp4`);
      hf(["render", "--fps", String(fps), "--crf", "12", "--output", out]);
      console.log(`→ ${out}`);
    }
  }
}
console.log("Projets HyperFrames générés dans hyperframes/build/");

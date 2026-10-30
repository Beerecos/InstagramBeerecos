#!/usr/bin/env node
// Génère les projets HyperFrames (accroche + signature) pour chaque format à partir de hyperframes/src/*.html
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
const C = cfg.colors;

for (const fmt of Object.values(cfg.formats)) {
  const { width: W, height: H, stage, title } = fmt;
  const v = fmt.id === "9x16";
  const dot = cfg.marker.size * stage.scale;
  const common = {
    black: C.black, blue: C.blue, "blue-soft": C.blueSoft, grey: C.grey, line: C.line, surface: C.surface,
    "stage-x": `${stage.x}px`, "stage-y": `${stage.y}px`, "stage-scale": stage.scale,
  };
  const jobs = {
    intro: {
      vars: { ...common, dot: `${cfg.marker.size}px`, "title-x": `${title.x}px`, "title-y": `${v ? 230 : title.y - 30}px`,
              "title-w": `${title.width}px`, "title-size": `${title.fontSize + (v ? 4 : 0)}px` },
      tokens: { TIMES: JSON.stringify(cfg.captions.slice(0, 3).map((c) => c.start)), DOT: String(cfg.marker.size) },
    },
    outro: {
      vars: { ...common, dot: `${dot}px`, gap: v ? "40px" : "22px", "logo-w": v ? "380px" : "300px",
              "tag-size": v ? "40px" : "36px", "cta-size": v ? "44px" : "38px", "hash-size": v ? "76px" : "66px" },
      tokens: {
        DOT: JSON.stringify({
          x: stage.x + cfg.marker.outroStart[0] * stage.scale - dot / 2,
          y: stage.y + cfg.marker.outroStart[1] * stage.scale - dot / 2,
          cx: W / 2 - dot / 2, cy: H / 2 - dot / 2,
        }),
        TAGLINE: cfg.labels.tagline, CTA: cfg.labels.cta, CTA_URL: cfg.labels.ctaUrl, HASHTAG: cfg.labels.hashtag,
      },
    },
  };
  for (const [name, job] of Object.entries(jobs)) {
    const sc = scene(name === "intro" ? "s01" : "s10");
    const dir = join(root, "hyperframes/build", `${name}-${fmt.id}`);
    mkdirSync(dir, { recursive: true });
    cpSync(join(root, "public/fonts"), join(dir, "fonts"), { recursive: true });
    cpSync(join(root, "public/brand"), join(dir, "brand"), { recursive: true });
    cpSync(join(root, "hyperframes/vendor/gsap-3.14.2.min.js"), join(dir, "gsap-3.14.2.min.js"));
    const tokens = {
      ...job.tokens, // Marge de 10 images en fin de clip : Remotion n'atteint jamais la dernière image du fichier (pas de noir au raccord).
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

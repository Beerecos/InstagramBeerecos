#!/usr/bin/env node
// Rend en MP4 un Reel motion design téléchargé depuis BeeMarketing (Studio vidéo → « Télécharger la composition »).
// Usage : npm run reel:render -- <reel.html> [sortie.mp4]
// Prérequis : Node 22+, FFmpeg ; Hyperframes installe son navigateur au premier rendu (`npx hyperframes browser`).
// Le rendu se fait sur votre poste : aucune donnée n'est envoyée à un service tiers.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HYPERFRAMES = "hyperframes@0.8.126";
const [input, output] = process.argv.slice(2);
if (!input) {
  console.error("Usage : npm run reel:render -- <reel.html> [sortie.mp4]");
  process.exit(1);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const name = basename(input).replace(/\.html?$/i, "");
const project = join(root, "projets", name);
mkdirSync(project, { recursive: true });

// Ressources locales (polices Poppins, GSAP, logo officiel BeeRecos) à la place des URL de l'application.
cpSync(join(root, "public/hyperframes/fonts"), join(project, "fonts"), { recursive: true });
cpSync(join(root, "public/hyperframes/gsap-3.14.2.min.js"), join(project, "gsap-3.14.2.min.js"));
cpSync(join(root, "public/hyperframes/brand"), join(project, "brand"), { recursive: true });
const html = readFileSync(input, "utf8").replace(/https?:\/\/[^"']+\/hyperframes\//g, "./");
writeFileSync(join(project, "index.html"), html);

const out = resolve(output ?? join(root, "export", `${name}.mp4`));
mkdirSync(dirname(out), { recursive: true });
const run = (args) => execFileSync("npx", ["-y", HYPERFRAMES, ...args], { cwd: project, stdio: "inherit" });
run(["check"]);
run(["render", "--quality", "delivery", "--output", out]);
if (!existsSync(out)) process.exit(1);
console.log(`\nReel rendu : ${out}\nAvant publication : bash .claude/skills/motion-design-reel/scripts/qa-reel.sh ${out}`);

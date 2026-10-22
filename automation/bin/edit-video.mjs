#!/usr/bin/env node
// Montage d'une vidéo tournée décrit par <projet>.edit.json (voir docs/EDIT-JSON.md).
// Usage : npm run video -- <commande> …
//   new <prise.mp4>                         crée <prise>.edit.json (un seul morceau = toute la prise)
//   transcribe <p.edit.json> [--model=small] transcript mot à mot en français, recalé sur l'énergie audio
//   autocut <p.edit.json>                   montre le plan de coupe numéroté (rien n'est écrit)
//   autocut <p.edit.json> --apply [--drop=2,5-6]  applique le plan (sauvegarde .bak-cuts)
//   validate <p.edit.json>                  vérifie le fichier (erreurs en français) et les fichiers référencés
//   build <p.edit.json>                     écrit la composition Hyperframes index.html à côté du fichier
//   preview <p.edit.json> <ms>[,<ms>…]      images PNG aux instants donnés (ms de la prise)
//   render <p.edit.json> [sortie.mp4]       rendu MP4 1080×1920, puis contrôle qualité
//   animations [--json]                     catalogue des animations (kit + mes-animations) avec exemples
//   animation-check [nom]                   contrôle une animation (ou toutes) avant usage
//   animation-preview <nom> [--props='{…}'] images de l'animation seule (sinon avec ses réglages d'exemple)
//   split <session.mov> [--expected=72] [--gap=1.5] [--noise=-35]  plan de découpe d'un long tournage (rien n'est coupé)
//   split <session.mov> --apply [--web]     coupe selon <session>.decoupe.json relu (une prise par Reel)
// Node 24 exécute directement le TypeScript du domaine (src/domain/video) : une seule définition du format.
// Tout tourne sur le poste : transcription whisper.cpp locale (via Hyperframes), aucun envoi à un service tiers.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CaptionsSchema, layout, parseEdit, toOutputMs } from "../../src/domain/video/edit.ts";
import { buildAnimationPreview, buildEditComposition } from "../../src/domain/video/edit-composition.ts";
import { checkAnimation } from "../../src/domain/video/animations.ts";
import { ANIMATIONS, animationSource } from "../../src/domain/video/registry.ts";
import { checkPlan, clock, ffmpegArgs, parseSilences, planSplit, segmentName } from "../lib/decoupe.mjs";
import { applyAutoCut, energyFrames, normalizeTranscript, parseDropList, planAutoCut, refineWithEnergy, speechIslands } from "../../src/domain/video/pipeline.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HYPERFRAMES = "hyperframes@0.8.126";
const hyperframes = (args, cwd, stdio = "inherit") => execFileSync("npx", ["-y", HYPERFRAMES, ...args], { cwd, stdio, maxBuffer: 64 * 1024 * 1024 });

class UserError extends Error {}
const fail = (msg) => {
  throw new UserError(msg);
};
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

/** Lit et valide un edit.json ; renvoie { edit, words, dir } ou la liste des erreurs. */
export function loadEdit(file) {
  const dir = dirname(resolve(file));
  let raw;
  try {
    raw = readJson(file);
  } catch (e) {
    return { errors: [`• ${file} → JSON illisible : ${e.message}`] };
  }
  const parsed = parseEdit(raw);
  if (!parsed.ok) return { errors: parsed.errors };
  const { edit } = parsed;
  const missing = [edit.video, edit.captions, ...edit.sounds.map((x) => x.file)].filter((f) => f && !existsSync(join(dir, f)));
  if (missing.length) return { errors: missing.map((f) => `• fichier introuvable à côté de l'edit.json : ${f}`) };
  let words = [];
  if (edit.captions) {
    const captions = CaptionsSchema.safeParse(readJson(join(dir, edit.captions)));
    if (!captions.success) return { errors: [`• ${edit.captions} → liste de mots { text, startMs, endMs } attendue`] };
    words = captions.data;
  }
  return { edit, words, dir, raw };
}

const mustLoad = (file) => {
  const loaded = loadEdit(file);
  if (loaded.errors) fail(`${file} n'est pas valide :\n${loaded.errors.join("\n")}`);
  return loaded;
};

/** Durée d'un média en ms (ffprobe). */
export function probeDurationMs(file) {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  const s = Number.parseFloat(out);
  if (!Number.isFinite(s)) fail(`Durée illisible pour ${file}`);
  return Math.round(s * 1000);
}

/** Énergie audio par fenêtres de 20 ms (ffmpeg → PCM 16 kHz mono). */
function audioEnergy(file) {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 1024 * 1024 * 1024 });
  return energyFrames(new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2)), 16000);
}

export function cmdNew(video) {
  const name = basename(video);
  if (!/^[\w.-]+$/.test(name)) fail(`Renomme la prise sans espace ni accent (lettres, chiffres, . _ -) : « ${name} »`);
  const file = join(dirname(resolve(video)), `${name.replace(/\.[^.]+$/, "")}.edit.json`);
  if (existsSync(file)) fail(`${file} existe déjà : je ne l'écrase pas.`);
  writeJson(file, { video: name, ranges: [{ fromMs: 0, toMs: probeDurationMs(video) }] });
  return `✅ Projet créé : ${file}\nÉtape suivante : npm run video -- transcribe ${file}`;
}

export function cmdTranscribe(file, { model = "small" } = {}) {
  const { edit, dir, raw } = mustLoad(file);
  const video = join(dir, edit.video);
  const work = mkdtempSync(join(tmpdir(), "transcribe-"));
  try {
    // Modèle multilingue + langue forcée : un modèle « .en » traduirait le français en anglais.
    hyperframes(["transcribe", video, "--dir", work, "--model", model, "--language", "fr", "--json"], work, ["ignore", "ignore", "inherit"]);
    const words = refineWithEnergy(normalizeTranscript(readJson(join(work, "transcript.json"))), speechIslands(audioEnergy(video)));
    const captions = `${edit.video.replace(/\.[^.]+$/, "")}.json`;
    writeJson(join(dir, captions), words);
    writeJson(file, { ...raw, captions });
    return `✅ ${words.length} mot(s) transcrits → ${join(dir, captions)}\nÉtape suivante : npm run video -- autocut ${file}`;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const fmt = (ms) => `${(ms / 1000).toFixed(2)} s`;

export function cmdAutocut(file, { apply = false, drop } = {}) {
  const { edit, words, dir, raw } = mustLoad(file);
  if (!words.length) fail(`Pas de transcript : lance d'abord npm run video -- transcribe ${file}`);
  const clauses = planAutoCut(words);
  const dropSet = drop === undefined ? new Set(clauses.filter((c) => c.suggestDrop).map((c) => c.n)) : parseDropList(drop);
  const ranges = applyAutoCut(words, clauses, dropSet, probeDurationMs(join(dir, edit.video)));
  const kept = ranges.reduce((n, r) => n + r.toMs - r.fromMs, 0);
  const before = edit.ranges.reduce((n, r) => n + r.toMs - r.fromMs, 0);
  const lines = clauses.map((c) => `${dropSet.has(c.n) ? "✂" : " "} ${String(c.n).padStart(3)}  ${fmt(c.fromMs).padStart(8)}  ${c.text}${c.fillers ? `  [${c.fillers} hésitation(s) retirée(s)]` : ""}${c.suggestDrop ? `  ← ${c.suggestDrop}` : ""}`);
  const summary = `Durée : ${fmt(before)} → ${fmt(kept)} (${ranges.length} morceau(x)).`;
  if (!apply) return `Plan de coupe (✂ = phrase retirée) :\n${lines.join("\n")}\n\n${summary}\nPour appliquer : npm run video -- autocut ${file} --apply --drop=${[...dropSet].join(",")}`;
  copyFileSync(file, `${file}.bak-cuts`);
  writeJson(file, { ...raw, ranges });
  const check = loadEdit(file);
  if (check.errors) {
    copyFileSync(`${file}.bak-cuts`, file);
    fail(`Coupe annulée, le résultat n'était pas valide :\n${check.errors.join("\n")}`);
  }
  return `✅ Coupe appliquée (sauvegarde : ${file}.bak-cuts).\n${summary}\nVérifie les raccords : npm run video -- preview ${file} ${ranges.slice(1, 4).map((r) => r.fromMs).join(",") || ranges[0].fromMs}`;
}

/** Ressources locales de la composition (polices Poppins, GSAP, logo officiel BeeRecos). */
function copyAssets(dir) {
  cpSync(join(root, "public/hyperframes/fonts"), join(dir, "fonts"), { recursive: true });
  cpSync(join(root, "public/hyperframes/brand"), join(dir, "brand"), { recursive: true });
  cpSync(join(root, "public/hyperframes/gsap-3.14.2.min.js"), join(dir, "gsap-3.14.2.min.js"));
}

/** Écrit index.html + ressources locales à côté de l'edit.json. */
export function cmdBuild(file) {
  const { edit, words, dir } = mustLoad(file);
  copyAssets(dir);
  const out = join(dir, "index.html");
  writeFileSync(out, buildEditComposition(edit, words, { assetBase: ".", mediaBase: "." }));
  return { out, dir, edit };
}

export function cmdPreview(file, list) {
  if (!list) fail("Indique au moins un instant en ms de la prise, ex. : preview p.edit.json 9800,12000");
  const at = list.split(",").map((x) => Number(x.replace(/^ms:/, "").trim()));
  if (at.some((x) => !Number.isFinite(x) || x < 0)) fail(`Instants invalides : « ${list} » (ms de la prise, séparés par des virgules)`);
  const { dir, edit } = cmdBuild(file);
  const segs = layout(edit.ranges);
  // Instants donnés en ms de la prise → secondes du montage.
  const secs = at.map((ms) => (toOutputMs(segs, ms) / 1000).toFixed(3));
  hyperframes(["snapshot", "--at", secs.join(","), "--no-end", "--describe", "false", "--output", join(dir, "snapshots")], dir);
  return `✅ Images dans ${join(dir, "snapshots")} (planche : contact-sheet.jpg). Ouvre-les avant de dire que c'est bon.`;
}

export function cmdRender(file, output) {
  const { dir, edit } = cmdBuild(file);
  const out = resolve(output ?? join(root, "export", `${edit.video.replace(/\.[^.]+$/, "")}.mp4`));
  hyperframes(["check"], dir);
  hyperframes(["render", "--quality", "delivery", "--output", out], dir);
  if (!existsSync(out)) fail("Le rendu n'a pas produit de fichier.");
  // Contrôle qualité (format, cadence, audio, volume, zones Instagram) : informatif, il ne bloque pas le rendu.
  try {
    execFileSync("bash", [join(root, ".claude/skills/motion-design-reel/scripts/qa-reel.sh"), out], { stdio: "inherit" });
  } catch {
    console.error("⚠ Le contrôle qualité signale des points à corriger (voir ci-dessus).");
  }
  return `✅ Vidéo rendue : ${out}`;
}

export function cmdAnimations({ json = false } = {}) {
  const list = Object.entries(ANIMATIONS).map(([name, d]) => ({ name, source: animationSource(name), label: d.label, description: d.description, lengthMs: d.lengthMs, example: d.example }));
  if (json) return JSON.stringify(list, null, 2);
  return list
    .map((a) => `• ${a.name} (${a.source}, ~${(a.lengthMs / 1000).toFixed(1)} s) — ${a.label}\n  ${a.description}\n  { "name": "${a.name}", "fromMs": …, "toMs": …, "props": ${JSON.stringify(a.example)} }`)
    .join("\n");
}

export function cmdAnimationCheck(name) {
  const names = name ? [name] : Object.keys(ANIMATIONS);
  if (name && !Object.hasOwn(ANIMATIONS, name)) fail(`Animation « ${name} » introuvable (enregistre-la dans src/domain/video/mes-animations/registre.ts)`);
  const report = names.map((n) => [n, checkAnimation(n, ANIMATIONS[n])]);
  const bad = report.filter(([, e]) => e.length);
  if (bad.length) fail(bad.map(([n, e]) => `${n} :\n${e.map((x) => `  • ${x}`).join("\n")}`).join("\n"));
  return `✅ ${names.length} animation(s) conforme(s) : ${names.join(", ")}`;
}

export function cmdAnimationPreview(name, { props } = {}) {
  if (!Object.hasOwn(ANIMATIONS, name)) fail(`Animation « ${name} » introuvable`);
  const def = ANIMATIONS[name];
  let values = def.example;
  if (typeof props === "string") {
    try {
      values = JSON.parse(props);
    } catch {
      fail(`--props doit être du JSON, ex. --props='${JSON.stringify(def.example)}'`);
    }
  }
  const dir = join(root, "projets", "_animations", name);
  mkdirSync(dir, { recursive: true });
  copyAssets(dir);
  writeFileSync(join(dir, "index.html"), buildAnimationPreview(name, values, { assetBase: "." }));
  const d = def.lengthMs / 1000;
  const at = [0.5 + Math.min(0.7, d * 0.3), 0.5 + d * 0.6, 0.5 + Math.max(0, d - 0.45)].map((x) => x.toFixed(2));
  hyperframes(["snapshot", "--at", at.join(","), "--no-end", "--describe", "false", "--output", join(dir, "snapshots")], dir);
  return `✅ Aperçu de « ${name} » : ${join(dir, "snapshots", "contact-sheet.jpg")} (entrée, milieu, sortie). Ouvre-le et décris-le.`;
}

/**
 * Découpe d'une session de tournage (ex. 80 Go, 72 Reels) : 1) plan à partir des pauses de la voix, écrit dans
 * <session>.decoupe.json à relire (titres, fusions, suppressions) ; 2) --apply coupe chaque Reel dans <session>-reels/.
 * Sans --web : copie sans réencodage (rapide, qualité d'origine, début calé sur l'image clé précédente).
 * Avec --web : H.264 1080 px, coupe exacte, fichiers légers pour la page Montage (500 Mo au plus par prise).
 */
export function cmdSplit(source, { expected, gap = "1.5", noise = "-35", apply = false, web = false } = {}) {
  if (!existsSync(source)) fail(`Fichier introuvable : ${source}`);
  const planFile = join(dirname(resolve(source)), `${basename(source).replace(/\.[^.]+$/, "")}.decoupe.json`);
  const durationMs = probeDurationMs(source);
  if (!apply) {
    if (existsSync(planFile)) fail(`${planFile} existe déjà (peut-être relu à la main) : je ne l'écrase pas. Supprime-le pour recalculer, ou lance --apply.`);
    const n = expected === undefined ? undefined : Number(expected);
    if (expected === true || (n !== undefined && !(Number.isInteger(n) && n >= 1))) fail("--expected attend un nombre de Reels, ex. --expected=72");
    // Seule la piste audio est lue (pas d'image décodée) : quelques minutes pour des heures de tournage.
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", source, "-map", "0:a:0", "-vn", "-sn", "-dn", "-af", `silencedetect=noise=${Number(noise)}dB:d=${Number(gap)}`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) fail(`ffmpeg n'a pas pu lire l'audio de ${source} :\n${(r.stderr ?? "").split("\n").slice(-5).join("\n")}`);
    const { segments, warnings } = planSplit(parseSilences(r.stderr, durationMs), durationMs, { expected: n });
    writeJson(planFile, { source: basename(source), durationMs, segments });
    const rows = segments.map((s) => `  ${String(s.n).padStart(3)}  ${clock(s.fromMs)} → ${clock(s.toMs)}  (${Math.round((s.toMs - s.fromMs) / 1000)} s)`);
    return [`Plan de découpe : ${segments.length} Reel(s) dans ${clock(durationMs)} de tournage.`, ...rows, ...warnings.map((w) => `⚠ ${w}`),
      `\nRelis ${planFile} (ajoute un titre, fusionne ou supprime un morceau), puis : npm run video -- split ${source} --apply${web ? " --web" : ""}`].join("\n");
  }
  if (!existsSync(planFile)) fail(`Pas de plan : lance d'abord npm run video -- split ${source}`);
  const plan = readJson(planFile);
  const errors = checkPlan(plan, durationMs);
  if (errors.length) fail(`${planFile} n'est pas valide :\n${errors.join("\n")}`);
  const outDir = join(dirname(resolve(source)), `${basename(source).replace(/\.[^.]+$/, "")}-reels`);
  mkdirSync(outDir, { recursive: true });
  const width = Math.max(2, String(plan.segments.length).length);
  const done = [];
  plan.segments.forEach((s, i) => {
    const seg = { ...s, n: i + 1 };
    const out = join(outDir, segmentName(seg, width));
    if (existsSync(out)) return done.push(`  = ${basename(out)} (déjà coupé)`);
    execFileSync("ffmpeg", ffmpegArgs(source, seg, out, { web: Boolean(web) }), { stdio: "inherit" });
    done.push(`  ✓ ${basename(out)}`);
  });
  return [`✅ ${plan.segments.length} Reel(s) dans ${outDir}`, ...done, "Ensuite, pour chaque Reel : page Montage (envoi de la prise) ou npm run video -- new <reel.mp4>."].join("\n");
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const flags = Object.fromEntries(rest.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split(/=(.*)/s)).map(([k, v]) => [k, v ?? true]));
  const [arg1, arg2] = rest.filter((a) => !a.startsWith("--"));
  const commands = {
    new: () => cmdNew(arg1),
    transcribe: () => cmdTranscribe(arg1, { model: flags.model }),
    autocut: () => cmdAutocut(arg1, { apply: Boolean(flags.apply), drop: typeof flags.drop === "string" ? flags.drop : flags.drop === true ? "" : undefined }),
    validate: () => {
      const { edit, words } = mustLoad(arg1);
      return `✅ ${arg1} est valide (${edit.ranges.length} morceau(x), ${edit.custom.length} animation(s), ${words.length} mot(s)).`;
    },
    build: () => `✅ Composition écrite : ${cmdBuild(arg1).out}`,
    preview: () => cmdPreview(arg1, arg2),
    render: () => cmdRender(arg1, arg2),
    animations: () => cmdAnimations({ json: Boolean(flags.json) }),
    "animation-check": () => cmdAnimationCheck(arg1),
    "animation-preview": () => cmdAnimationPreview(arg1, { props: flags.props }),
    split: () => cmdSplit(arg1, { expected: flags.expected, gap: flags.gap, noise: flags.noise, apply: Boolean(flags.apply), web: Boolean(flags.web) }),
  };
  const needsFile = !["animations", "animation-check"].includes(cmd);
  if (!Object.hasOwn(commands, cmd) || (needsFile && !arg1)) {
    console.error(`Usage : npm run video -- <${Object.keys(commands).join("|")}> <fichier> …  (détails en tête de automation/bin/edit-video.mjs)`);
    return 1;
  }
  try {
    console.log(commands[cmd]());
    return 0;
  } catch (e) {
    // Les échecs de ffmpeg / Hyperframes ont déjà affiché leur sortie ; on garde la pile pour les erreurs inattendues.
    console.error(e instanceof UserError || /phrase|Liste|Intervalle/i.test(e.message) ? `❌ ${e.message}` : e);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

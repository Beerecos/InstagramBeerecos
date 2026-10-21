#!/usr/bin/env node
// Montage d'une vidéo tournée décrit par <projet>.edit.json (voir docs/EDIT-JSON.md).
// Usage :
//   npm run video:validate -- <projet>.edit.json   vérifie le fichier (erreurs en français) et les fichiers référencés
//   npm run video:build -- <projet>.edit.json      écrit la composition Hyperframes index.html à côté du fichier
// Node 24 exécute directement le TypeScript du domaine (src/domain/video) : une seule définition du format.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CaptionsSchema, parseEdit } from "../../src/domain/video/edit.ts";
import { buildEditComposition } from "../../src/domain/video/edit-composition.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Lit et valide un edit.json ; renvoie { edit, words, dir } ou la liste des erreurs. */
export function loadEdit(file) {
  const dir = dirname(resolve(file));
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
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
    const captions = CaptionsSchema.safeParse(JSON.parse(readFileSync(join(dir, edit.captions), "utf8")));
    if (!captions.success) return { errors: [`• ${edit.captions} → liste de mots { text, startMs, endMs } attendue`] };
    words = captions.data;
  }
  return { edit, words, dir };
}

function main([cmd, file]) {
  if (!["validate", "build"].includes(cmd) || !file) {
    console.error("Usage : npm run video:validate -- <projet>.edit.json | npm run video:build -- <projet>.edit.json");
    return 1;
  }
  const loaded = loadEdit(file);
  if (loaded.errors) {
    console.error(`❌ ${file} n'est pas valide :\n${loaded.errors.join("\n")}`);
    return 1;
  }
  if (cmd === "validate") {
    console.log(`✅ ${file} est valide (${loaded.edit.ranges.length} morceau(x), ${loaded.edit.custom.length} animation(s), ${loaded.words.length} mot(s)).`);
    return 0;
  }
  // Ressources locales (polices Poppins, GSAP) copiées à côté de la composition, comme reel:render.
  cpSync(join(root, "public/hyperframes/fonts"), join(loaded.dir, "fonts"), { recursive: true });
  cpSync(join(root, "public/hyperframes/gsap-3.14.2.min.js"), join(loaded.dir, "gsap-3.14.2.min.js"));
  const out = join(loaded.dir, "index.html");
  writeFileSync(out, buildEditComposition(loaded.edit, loaded.words, { assetBase: ".", mediaBase: "." }));
  console.log(`✅ Composition écrite : ${out}\nAperçu : cd ${loaded.dir} && npx hyperframes@0.8.126 preview`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

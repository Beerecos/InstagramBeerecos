import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CustomAnimationSchema, parseEdit } from "@/domain/video/edit";
import { checkAnimation, renderAnimation } from "@/domain/video/animations";
import { ANIMATIONS } from "@/domain/video/registry";

/**
 * Les commandes de montage (`.claude/skills/<nom>/SKILL.md`) sont elles-mêmes testées : en-tête valide, sections du
 * gabarit, et chaque exemple JSON (```json edit = edit.json complet, ```json custom = une entrée de custom[]) valide.
 */
const SKILLS = ["nouvelle-video", "transcrire", "couper", "titre", "mot-cle", "animation", "nouvelle-animation", "exporter"];
const SECTIONS = ["## À demander à l'utilisateur", "## Réglages", "## Ce que tu écris dans le JSON", "## Déroulé standard (dans cet ordre)", "## Garde-fous"];
const read = (name: string) => readFileSync(new URL(`../../.claude/skills/${name}/SKILL.md`, import.meta.url), "utf8");

describe.each(SKILLS)("skill /%s", (name) => {
  const text = read(name);

  it("en-tête : nom du dossier et description avec les mots de l'utilisateur", () => {
    const head = text.match(/^---\nname: (.+)\ndescription: (.+)\n---\n/);
    expect(head?.[1]).toBe(name);
    expect(head?.[2]).toMatch(/À utiliser pour « .+ »/);
  });

  it("suit le gabarit et renvoie aux règles communes", () => {
    for (const s of SECTIONS) expect(text).toContain(s);
    expect(text).toContain("docs/EDIT-JSON.md");
  });

  it("ses exemples JSON sont valides", () => {
    const blocks = [...text.matchAll(/```json (edit|custom)\n([\s\S]*?)```/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const [, kind, body] of blocks) {
      const data = JSON.parse(body);
      if (kind === "edit") {
        const r = parseEdit(data);
        expect(r.ok ? [] : r.errors).toEqual([]);
      } else {
        const c = CustomAnimationSchema.parse(data);
        expect(c.toMs).toBeGreaterThan(c.fromMs);
        expect(renderAnimation(c.name, c.props, { id: "a0", start: 0, duration: 2, accent: "#693BFC" }, ANIMATIONS).error).toBeUndefined();
      }
    }
  });
});

it("catalogue : chaque animation (kit et mes-animations) est conforme et documentée par une commande", () => {
  for (const [name, def] of Object.entries(ANIMATIONS)) expect([name, checkAnimation(name, def)]).toEqual([name, []]);
  expect(read("animation")).toContain("npm run video -- animations");
});

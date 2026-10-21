import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CustomAnimationSchema, parseEdit } from "@/domain/video/edit";
import { KIT_ANIMATIONS, renderAnimation } from "@/domain/video/animations";

/**
 * Les commandes de montage (`.claude/skills/<nom>/SKILL.md`) sont elles-mêmes testées : en-tête valide, sections du
 * gabarit, et chaque exemple JSON (```json edit = edit.json complet, ```json custom = une entrée de custom[]) valide.
 */
const SKILLS = ["nouvelle-video", "transcrire", "couper", "titre", "mot-cle", "exporter"];
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
        expect(renderAnimation(c.name, c.props, { id: "a0", start: 0, duration: 2, accent: "#693BFC" }).error).toBeUndefined();
      }
    }
  });
});

it("chaque animation du kit a sa commande", () => {
  for (const name of Object.keys(KIT_ANIMATIONS)) expect(SKILLS).toContain(name);
});

import { describe, expect, it } from "vitest";
import { initialEdit } from "@/domain/social/montage/montage";
import { buildMontageProject, MAX_RENDER_VIDEO_BYTES, MONTAGE_ASSETS } from "@/domain/social/montage/project";

describe("projet de rendu d'un montage", () => {
  const edit = { ...initialEdit("prise.mp4", 5000), logo: { width: 220, right: 170, bottom: 260, opacity: 1 }, custom: [{ name: "logo-fin", fromMs: 3000, toMs: 5000, props: {} }] };
  const load = async (path: string) => new TextEncoder().encode(`contenu de ${path}`);

  it("ZIP complet : composition, prise et ressources officielles, chemins locaux", async () => {
    const p = await buildMontageProject(edit, [], new Uint8Array([1, 2, 3]), load);
    expect(p.files).toEqual(["index.html", "prise.mp4", ...MONTAGE_ASSETS]);
    expect(p.html).toContain('src="./prise.mp4"');
    expect(p.files).toContain("brand/beerecos-logo-transparent.png");
    expect(p.html).toContain('src="./brand/beerecos-logo-transparent.png"');
    expect(p.html).toContain('src="./brand/beerecos-video-fin.mp4"');
    expect(p.files).toContain("brand/beerecos-video-fin.mp4");
    expect(p.html).toContain('src="./gsap-3.14.2.min.js"');
    expect(p.html).not.toMatch(/https?:\/\//);
    expect([...p.zip.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("refuse une prise trop lourde ou une ressource absente", async () => {
    await expect(buildMontageProject(edit, [], { byteLength: MAX_RENDER_VIDEO_BYTES + 1 } as Uint8Array, load)).rejects.toThrow("190 Mo");
    await expect(buildMontageProject(edit, [], new Uint8Array(1), async () => new Uint8Array())).rejects.toThrow("Ressource de rendu introuvable");
  });
});

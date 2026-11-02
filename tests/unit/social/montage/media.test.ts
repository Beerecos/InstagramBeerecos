import { describe, expect, it } from "vitest";
import { mediaErrors, mediaFileName, usedMedia } from "@/domain/social/montage/media";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { checkAnimation } from "@/domain/social/montage/animations";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import type { Edit } from "@/domain/social/montage/edit";

const ID = "1a2b3c4d-0000-4000-8000-000000000000";
const EDIT: Edit = {
  video: "p.mp4", accent: "bleu", ranges: [{ fromMs: 0, toMs: 6000 }], subtitles: false, captionStyle: {}, voiceGain: 1,
  custom: [{ name: "image", fromMs: 1000, toMs: 3000, props: { fichier: "club-1a2b3c4d.jpg", mode: "encart" } }],
  sounds: [{ file: "whoosh-1a2b3c4d.mp3", atMs: 500, volume: 0.5 }],
};

describe("bibliothèque de médias du Studio", () => {
  it("nom de fichier simple, unique et du bon type", () => {
    expect(mediaFileName("Whoosh Été.MP3", "son", ID)).toBe("whoosh-ete-1a2b3c4d.mp3");
    expect(mediaFileName("photo.webp", "image", ID)).toBe("photo-1a2b3c4d.webp");
    expect(mediaFileName("photo.webp", "son", ID)).toBeNull();
    expect(mediaFileName("logo.svg", "image", ID)).toBeNull();
    expect(mediaFileName("sans-extension", "son", ID)).toBeNull();
  });

  it("repère les médias utilisés et ceux absents de la bibliothèque", () => {
    expect(usedMedia(EDIT)).toEqual(["whoosh-1a2b3c4d.mp3", "club-1a2b3c4d.jpg"]);
    expect(mediaErrors(EDIT, [{ fileName: "whoosh-1a2b3c4d.mp3", kind: "son" }, { fileName: "club-1a2b3c4d.jpg", kind: "image" }])).toEqual([]);
    expect(mediaErrors(EDIT, [{ fileName: "whoosh-1a2b3c4d.mp3", kind: "image" }])).toEqual([
      "• sounds[0] → « whoosh-1a2b3c4d.mp3 » n'est pas un son de la bibliothèque",
      "• custom[0] → « club-1a2b3c4d.jpg » n'est pas une image de la bibliothèque",
    ]);
  });

  it("l'animation image respecte le gabarit du kit et utilise l'URL du média (échappée)", () => {
    expect(checkAnimation("image", ANIMATIONS.image)).toEqual([]);
    const html = buildEditComposition(EDIT, [], { assetBase: "/hf", preview: true, mediaUrl: (f) => `https://s.test/${f}?a=1&b=2` });
    expect(html).toContain('src="https://s.test/club-1a2b3c4d.jpg?a=1&amp;b=2"');
    expect(html).toContain('<audio id="sfx-0" src="https://s.test/whoosh-1a2b3c4d.mp3?a=1&amp;b=2"');
    expect(buildEditComposition(EDIT, [], { assetBase: ".", mediaBase: "." })).toContain('src="./club-1a2b3c4d.jpg"');
  });
});

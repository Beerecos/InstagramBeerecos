import { describe, expect, it } from "vitest";
import { buildEditComposition, duckPieces, speechWindows } from "@/domain/social/montage/edit-composition";
import { layout, parseEdit } from "@/domain/social/montage/edit";
import { initialEdit } from "@/domain/social/montage/montage";
import { mediaErrors, usedMedia } from "@/domain/social/montage/media";

const words = [
  { text: "Bonjour", startMs: 1000, endMs: 1500 },
  { text: "Cédric", startMs: 1600, endMs: 2000 },
  { text: "coupé", startMs: 4200, endMs: 4600 },
  { text: "fin.", startMs: 7000, endMs: 7400 },
];

describe("B-roll et musique baissée pendant la voix (2026-11-03)", () => {
  const base = { ...initialEdit("prise.mp4", 9000), ranges: [{ fromMs: 0, toMs: 4000 }, { fromMs: 5000, toMs: 9000 }] };

  it("pose un clip d'illustration muet au-dessus de la prise, calé sur les coupes", () => {
    const edit = { ...base, broll: [{ file: "plan-reunion.mp4", fromMs: 5500, toMs: 7000, clipInMs: 2000, focusX: 30 }] };
    expect(parseEdit(edit).ok).toBe(true);
    const html = buildEditComposition(edit, words, { assetBase: "." });
    // 5500 source → 4500 montage ; 1,5 s ; lit le clip à partir de 2 s ; cadrage à 30 %.
    expect(html).toContain('<video id="broll-0" class="broll" src="./plan-reunion.mp4" data-start="4.5" data-duration="1.5" data-media-start="2" data-has-audio="false" muted');
    expect(html).toContain("object-position: 30% 50%");
    expect(html).toMatch(/\.broll \{[^}]*z-index: 2/);
    expect(usedMedia(edit)).toContain("plan-reunion.mp4");
  });

  it("refuse un clip trop court, un format non vidéo et un clip absent de la bibliothèque", () => {
    expect(parseEdit({ ...base, broll: [{ file: "x.mp4", fromMs: 100, toMs: 200 }] }).ok).toBe(false);
    expect(parseEdit({ ...base, broll: [{ file: "x.png", fromMs: 0, toMs: 1000 }] }).ok).toBe(false);
    const edit = { ...base, broll: [{ file: "x.mp4", fromMs: 0, toMs: 1000, clipInMs: 0, focusX: 50 }] };
    expect(mediaErrors(edit, [{ fileName: "x.mp4", kind: "image" }]).join(" ")).toMatch(/n'est pas un clip vidéo/);
    expect(mediaErrors(edit, [{ fileName: "x.mp4", kind: "video" }])).toEqual([]);
  });

  it("calcule les fenêtres de parole en temps du montage (mots coupés exclus)", () => {
    expect(speechWindows(words, layout(base.ranges))).toEqual([{ fromMs: 880, toMs: 2120 }, { fromMs: 5880, toMs: 6520 }]);
  });

  it("découpe la musique en morceaux : plein volume hors parole, baissé pendant la voix", () => {
    const pieces = duckPieces(0, 8000, [{ fromMs: 880, toMs: 2120 }, { fromMs: 5880, toMs: 6520 }], 0.8, 0.2, 8000);
    expect(pieces).toEqual([
      { atMs: 0, durationMs: 880, mediaStartMs: 0, volume: 0.8 },
      { atMs: 880, durationMs: 1240, mediaStartMs: 880, volume: 0.2 },
      { atMs: 2120, durationMs: 3760, mediaStartMs: 2120, volume: 0.8 },
      { atMs: 5880, durationMs: 640, mediaStartMs: 5880, volume: 0.2 },
      { atMs: 6520, durationMs: 1480, mediaStartMs: 6520, volume: 0.8 },
    ]);
    // Le fichier est lu en continu : chaque morceau reprend là où le précédent s'arrête.
    pieces.forEach((p, i) => { if (i) expect(p.mediaStartMs).toBe(pieces[i - 1].mediaStartMs + pieces[i - 1].durationMs); });
  });

  it("écrit les morceaux dans la composition ; sans baisse, le son reste un seul clip", () => {
    const ducked = buildEditComposition({ ...base, sounds: [{ file: "musique.mp3", atMs: 0, volume: 0.8, duck: { volume: 0.2 } }] }, words, { assetBase: "." });
    expect(ducked).toContain('id="sfx-0-1" src="./musique.mp3" data-start="0.88" data-duration="1.24" data-media-start="0.88" data-volume="0.2"');
    expect(ducked).not.toContain('id="sfx-0"');
    const plain = buildEditComposition({ ...base, sounds: [{ file: "musique.mp3", atMs: 0, volume: 0.8 }] }, words, { assetBase: "." });
    expect(plain).toContain('<audio id="sfx-0" src="./musique.mp3" data-start="0" data-volume="0.8"');
  });
});

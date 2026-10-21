import { describe, expect, it, vi } from "vitest";
import { parseEdit } from "@/domain/video/edit";
import { buildEditComposition } from "@/domain/video/edit-composition";
import { initialEdit, keptMs, newMontageSchema, safeVideoName, scribeToWords, uploadedSchema, videoNameOf } from "@/domain/video/montage";
import { SCRIBE_URL, transcribeWithScribe } from "@/server/montages/scribe";

describe("domaine Montage", () => {
  it("nom de fichier sûr : accents, espaces et signes retirés, seules les vidéos acceptées", () => {
    expect(safeVideoName("Prise Cédric (1).MOV")).toBe("prise-cedric-1.mov");
    expect(safeVideoName("../../etc/passwd.mp4")).toBe("etc-passwd.mp4");
    expect(safeVideoName("😀.mp4")).toBe("prise.mp4");
    expect(safeVideoName("photo.jpg")).toBeNull();
    expect(safeVideoName("sans-extension")).toBeNull();
  });

  it("le montage initial est un edit.json valide sur toute la prise", () => {
    const edit = initialEdit("prise.mp4", 42300);
    expect(parseEdit(edit).ok).toBe(true);
    expect(keptMs(edit.ranges)).toBe(42300);
    expect(videoNameOf("org/id/prise.mp4")).toBe("prise.mp4");
  });

  it("limites d'envoi : 500 Mo, 1 s à 10 min", () => {
    expect(newMontageSchema.safeParse({ title: "x", fileName: "a.mp4", size: 600 * 1024 * 1024 }).success).toBe(false);
    expect(uploadedSchema.safeParse({ durationMs: 500, islands: null }).success).toBe(false);
    expect(uploadedSchema.safeParse({ durationMs: 30_000, islands: [{ fromMs: 0, toMs: 100 }] }).success).toBe(true);
  });

  it("Scribe → transcript : secondes en ms, espaces et événements sonores ignorés", () => {
    const words = scribeToWords({
      words: [
        { text: "Bonjour", start: 0.07, end: 0.6, type: "word" },
        { text: " ", start: 0.6, end: 0.7, type: "spacing" },
        { text: "(rires)", start: 0.7, end: 1.2, type: "audio_event" },
        { text: "BeeRecos", start: 1.2, end: 1.2, type: "word" },
      ],
    });
    expect(words).toEqual([
      { text: " Bonjour", startMs: 70, endMs: 600 },
      { text: " BeeRecos", startMs: 1200, endMs: 1201 },
    ]);
    expect(() => scribeToWords({ text: "pas de mots" })).toThrow();
  });
});

describe("appel ElevenLabs Scribe", () => {
  it("envoie l'URL signée (pas le fichier), en français, mot à mot", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ words: [{ text: "Salut", start: 0, end: 0.4, type: "word" }] })));
    const words = await transcribeWithScribe("https://stockage.test/prise.mp4?token=abc", "cle", fetchMock as unknown as typeof fetch);
    expect(words).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SCRIBE_URL);
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("cle");
    const body = init.body as FormData;
    expect(body.get("cloud_storage_url")).toBe("https://stockage.test/prise.mp4?token=abc");
    expect(body.get("language_code")).toBe("fr");
    expect(body.get("timestamps_granularity")).toBe("word");
    expect(body.get("file")).toBeNull();
  });

  it("erreurs claires : clé refusée, aucune parole", async () => {
    await expect(transcribeWithScribe("u", "k", (async () => new Response("non", { status: 401 })) as unknown as typeof fetch)).rejects.toThrow("Clé ElevenLabs refusée");
    await expect(transcribeWithScribe("u", "k", (async () => new Response(JSON.stringify({ words: [] }))) as unknown as typeof fetch)).rejects.toThrow("Aucune parole");
  });
});

describe("composition d'un montage en ligne", () => {
  it("la prise est lue par URL signée, échappée dans l'attribut", () => {
    const html = buildEditComposition(initialEdit("prise.mp4", 5000), [], { assetBase: ".", mediaUrl: () => 'https://s.test/prise.mp4?token=a&b="x"' });
    expect(html).toContain('src="https://s.test/prise.mp4?token=a&amp;b=&quot;x&quot;"');
    expect(html).not.toContain('"x"');
  });
});

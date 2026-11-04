import { describe, expect, it } from "vitest";
import { imageError, imagePrompt, ImageRequestSchema } from "@/domain/instagram/visual-prompt";
import { generateImage } from "@/server/instagram/image";
import { planBrief } from "@/domain/instagram/carousel";

const req = (r: Record<string, unknown>) => ImageRequestSchema.parse({ description: "étudiante qui surligne un cahier", ...r });

describe("images réalistes des carrousels", () => {
  it("la consigne impose le réalisme et interdit texte, logo, marque et personne réelle", () => {
    const p = imagePrompt(req({ subject: "STABILO BOSS" }));
    expect(p).toMatch(/Photorealistic/);
    expect(p).toMatch(/no text/);
    expect(p).toMatch(/logos, brand names/);
    expect(p).toMatch(/never a real or famous person/);
    expect(p).toContain("STABILO BOSS");
    expect(imagePrompt(req({ mode: "produit" }))).toMatch(/transparent background/);
  });

  it("le plan demande une description de visuel par slide", () => {
    expect(planBrief("x", "y", [])).toMatch(/"visual"/);
  });

  it("appelle OpenAI côté serveur : portrait, WebP, fond transparent pour un objet", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => { sent = { url, init }; return new Response(JSON.stringify({ data: [{ b64_json: "QUJD" }] })); }) as unknown as typeof fetch;
    const r = await generateImage({ description: "surligneur jaune posé en diagonale", mode: "produit" }, { key: "sk-test", fetchImpl });
    expect(r).toEqual({ b64: "QUJD", mime: "image/webp", model: "gpt-image-1" });
    expect(sent!.url).toBe("https://api.openai.com/v1/images/generations");
    expect((sent!.init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    expect(JSON.parse(String(sent!.init.body))).toMatchObject({ model: "gpt-image-1", size: "1024x1536", background: "transparent", output_format: "webp", quality: "medium" });
  });

  it("sans clé ou avec une description vide : erreur lisible, aucun appel", async () => {
    const fetchImpl = (() => { throw new Error("ne doit pas appeler"); }) as unknown as typeof fetch;
    await expect(generateImage({ description: "une scène" }, { fetchImpl })).rejects.toThrow(/OPENAI_API_KEY/);
    await expect(generateImage({ description: "court" }, { key: "k", fetchImpl })).rejects.toThrow(/Décris/);
  });

  it("traduit les erreurs OpenAI", async () => {
    expect(imageError(403, "organization must be verified")).toMatch(/non vérifié/);
    expect(imageError(429, "")).toMatch(/Quota/);
    const fetchImpl = (async () => new Response("bad key", { status: 401 })) as unknown as typeof fetch;
    await expect(generateImage({ description: "une scène de club" }, { key: "k", fetchImpl })).rejects.toThrow(/Clé OpenAI refusée/);
  });
});

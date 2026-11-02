import { describe, expect, it } from "vitest";
import { DRAFT_TTL_MS, clearDraft, draftKey, readDraft, writeDraft, type DraftForm } from "@/lib/social/editorial-draft";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m }; };
const form: DraftForm = { title: "T", objective: "", cta: "", destinationUrl: "", brief: "", campaignId: "", workspaceId: "w1", variants: { linkedin: { enabled: true, subject: "", content: "Texte", date: "", media: [] } } };

describe("brouillon local de l'éditeur", () => {
  it("clé isolée par utilisateur, par contenu et par contexte de création", () => {
    const base = { editId: "", campaignId: "c1", workspaceId: "w1", day: "" };
    expect(draftKey(null, base)).toBeNull();
    expect(draftKey("u1", base)).not.toBe(draftKey("u2", base));
    expect(draftKey("u1", base)).not.toBe(draftKey("u1", { ...base, workspaceId: "w2" }));
    expect(draftKey("u1", { ...base, editId: "d1" })).toBe(draftKey("u1", { editId: "d1", campaignId: "", workspaceId: "", day: "" }));
  });
  it("écrit, relit, efface", () => {
    const s = memory(); const key = draftKey("u1", { editId: "d1", campaignId: "", workspaceId: "", day: "" });
    expect(writeDraft(key, form, 1000, s)).toBe(true);
    expect(readDraft(key, 2000, s)).toEqual(form);
    expect(readDraft(draftKey("u2", { editId: "d1", campaignId: "", workspaceId: "", day: "" }), 2000, s)).toBeNull();
    clearDraft(key, s);
    expect(readDraft(key, 2000, s)).toBeNull();
  });
  it("un brouillon trop ancien ou illisible est ignoré", () => {
    const s = memory();
    writeDraft("k", form, 0, s);
    expect(readDraft("k", DRAFT_TTL_MS + 1, s)).toBeNull();
    expect(s.m.has("k")).toBe(false);
    s.setItem("k2", "{pas du json");
    expect(readDraft("k2", 0, s)).toBeNull();
  });
  it("un stockage refusé est signalé", () => {
    expect(writeDraft("k", form, 0, { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {} })).toBe(false);
  });
});

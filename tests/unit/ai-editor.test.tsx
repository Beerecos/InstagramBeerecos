// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AiEditor from "@/components/reels/ai-editor";
const api = vi.hoisted(() => ({ get: vi.fn(), assetGet: vi.fn() }));
vi.mock("@/lib/social/montage-api", () => ({ reels: { get: api.get } }));
vi.mock("@/lib/social/studio-assets-api", () => ({ studioAssets: { get: api.assetGet } }));
vi.mock("@/components/social/MotionStyleSource", () => ({ default: ({ initialSpec, sourceRef }: { initialSpec?: { title: string }; sourceRef?: { assetId: string } }) => <textarea aria-label="Script de test" defaultValue={initialSpec?.title ?? sourceRef?.assetId ?? ""} /> }));
vi.mock("@/components/social/ReelsStudio", () => ({ AiVideoSource: () => null }));
vi.mock("@/domain/reels/ai-spec", () => ({ reelToMotion: () => ({ spec: { title: "Script reçu" }, warnings: [] }), storyToMotion: () => ({ title: "Modèle" }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("attend le script choisi avant de permettre la saisie", async () => {
  let resolve!: (v: unknown) => void;
  api.get.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  render(<AiEditor scriptId="V01" />);
  expect(screen.getByRole("status").textContent).toContain("Chargement");
  expect(screen.queryByLabelText("Script de test")).toBeNull();
  resolve({ reel: { data: {}, reelId: "V01", revision: 1 } });
  expect(await screen.findByLabelText("Script de test")).toHaveProperty("value", "Script reçu");
});
it("conserve la saisie quand le remplacement par un modèle est refusé", () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  render(<AiEditor />);
  fireEvent.change(screen.getByLabelText("Script de test"), { target: { value: "Mon scénario" } });
  fireEvent.click(screen.getByRole("button", { name: "Modèle « Recommandation »" }));
  expect(screen.getByLabelText("Script de test")).toHaveProperty("value", "Mon scénario");
});
it("quitte une conversion héritée pour la source suivante puis pour une création sans source", async () => {
  api.assetGet.mockResolvedValueOnce({ asset: { data: {} } });
  const { rerender } = render(<AiEditor sourceRef={{ kind: "story", assetId: "ancien", revision: 2 }} />);
  fireEvent.click(screen.getByRole("button", { name: "Reprendre en scènes" }));
  expect(await screen.findByLabelText("Script de test")).toHaveProperty("value", "Modèle");
  rerender(<AiEditor sourceRef={{ kind: "motion", assetId: "suivant", revision: 3 }} />);
  expect(screen.getByLabelText("Script de test")).toHaveProperty("value", "suivant");
  rerender(<AiEditor />);
  expect(screen.getByLabelText("Script de test")).toHaveProperty("value", "");
});

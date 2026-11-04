// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AiEditor from "@/components/reels/ai-editor";
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/social/montage-api", () => ({ reels: { get: api.get } }));
vi.mock("@/lib/social/studio-assets-api", () => ({ studioAssets: {} }));
vi.mock("@/components/social/MotionStyleSource", () => ({ default: ({ initialSpec }: { initialSpec?: { title: string } }) => <textarea aria-label="Script de test" defaultValue={initialSpec?.title ?? ""} /> }));
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

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PostPanel from "@/components/reels/post-panel";
import { emptyPost } from "@/domain/reels/post";
import type { MontageDetail } from "@/lib/social/montage-api";
const api = vi.hoisted(() => ({ savePost: vi.fn() }));
vi.mock("@/lib/social/montage-api", () => ({ montage: { savePost: api.savePost }, reels: {} }));
vi.mock("@/lib/social/editorial-api", () => ({ transferStudioMedia: vi.fn(), updateDeliverable: vi.fn() }));
vi.mock("@/lib/instagram/api", () => ({ instagram: { list: async () => ({ items: [] }), connection: async () => ({ connected: false }) } }));
vi.mock("@/components/post/publish-dialog", () => ({ default: () => null }));
const montage = { id: "reel-a", title: "Mon reel", updatedAt: "v1", post: { ...emptyPost("v1"), caption: "Serveur" }, renderStatus: "idle" } as unknown as MontageDetail;
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);
it("récupère la dernière légende locale après fermeture, sans écraser la version serveur", async () => {
  render(<PostPanel m={montage} />);
  fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Ma nouvelle légende" } });
  cleanup();
  render(<PostPanel m={montage} />);
  expect(screen.getByLabelText("Texte")).toHaveProperty("value", "Ma nouvelle légende");
  expect(screen.getByText(/Copie automatique sur cet appareil/)).toBeTruthy();
  expect(api.savePost).not.toHaveBeenCalled();
});
it("fige la saisie pendant la sauvegarde serveur et retire ensuite la copie de secours", async () => {
  let resolve!: (v: unknown) => void;
  api.savePost.mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<PostPanel m={montage} />);
  fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "Version finale" } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer la légende" }));
  expect(screen.getByLabelText("Texte").closest("fieldset")?.disabled).toBe(true);
  resolve({ post: { version: "v2" } });
  await screen.findByText("Enregistrée sur le serveur avec ce montage.");
  expect(localStorage.getItem("ibr.post.recovery.reel-a")).toBeNull();
  expect(screen.getByLabelText("Texte").closest("fieldset")?.disabled).toBe(false);
});
it("préserve la copie locale si le serveur refuse l'enregistrement", async () => {
  api.savePost.mockRejectedValue(new Error("Réseau indisponible"));
  render(<PostPanel m={montage} />);
  fireEvent.change(screen.getByLabelText("Texte"), { target: { value: "À conserver" } });
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer la légende" }));
  await screen.findByText("Réseau indisponible");
  expect(JSON.parse(localStorage.getItem("ibr.post.recovery.reel-a")!).caption).toBe("À conserver");
});
it("ignore une copie locale endommagée", async () => {
  localStorage.setItem("ibr.post.recovery.reel-a", '{"caption":42}');
  render(<PostPanel m={montage} />);
  await waitFor(() => expect(screen.getByLabelText("Texte")).toHaveProperty("value", "Serveur"));
});

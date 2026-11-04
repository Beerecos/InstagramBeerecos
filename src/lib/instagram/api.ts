"use client";
/** Client des routes /api/instagram (session de l'app ; le jeton Instagram ne transite jamais par le navigateur). */
import type { DraftInput, Publication } from "@/domain/instagram/publication";
import { photoCrop } from "@/domain/instagram/publication";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ConnectionView = {
  connected: boolean; username: string | null; expiresAt: string | null; needsRefresh: boolean;
  renewal?: "automatic" | "meta";
  webhook?: { appSecret: boolean; verifyToken: boolean; callbackUrl: string };
};

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/instagram${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
  return data;
}

export type LinkedInView = { connected: boolean; name: string | null; expiresAt: string | null; page: { configured: boolean; allowed: boolean }; appConfigured?: boolean };

export const instagram = {
  connection: () => call<ConnectionView>("/connection"),
  connect: (token: string) => call<ConnectionView>("/connection", { method: "POST", body: { token } }),
  refresh: () => call<ConnectionView>("/connection", { method: "PATCH" }),
  disconnect: () => call<ConnectionView>("/connection", { method: "DELETE" }),
  list: () => call<{ items: Publication[]; previews: Record<string, string> }>("/posts"),
  get: (id: string) => call<{ item: Publication; previews: Record<string, string> }>(`/posts/${id}`),
  save: (draft: DraftInput & { id?: string }) => call<{ item: Publication }>("/posts", { method: "POST", body: draft }),
  remove: (id: string) => call<{ ok: true }>(`/posts/${id}`, { method: "DELETE" }),
  publish: (id: string, videoUrl?: string) => call<{ item: Publication }>(`/posts/${id}/publish`, { method: "POST", body: { confirm: true, videoUrl } }),
  linkedin: (id: string, o: { text: string; target: "profil" | "page"; videoUrl?: string }) => call<{ item: Publication }>(`/posts/${id}/linkedin`, { method: "POST", body: { confirm: true, ...o } }),
  linkedinConnection: async (): Promise<LinkedInView> => {
    const res = await fetch("/api/linkedin/connection", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { error?: string } & LinkedInView;
    if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
    return data;
  },
  linkedinDisconnect: async () => { await fetch("/api/linkedin/connection", { method: "DELETE" }); },
};

/** Photo → JPEG au bon format Instagram, puis envoi direct dans le bucket privé. Renvoie son chemin. */
export async function uploadPhoto(file: File): Promise<{ path: string; cropped: boolean }> {
  if (!file.type.startsWith("image/")) throw new Error(`« ${file.name} » n'est pas une image.`);
  const bitmap = await createImageBitmap(file);
  const c = photoCrop(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = c.w; canvas.height = c.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Préparation de la photo impossible dans ce navigateur.");
  ctx.drawImage(bitmap, c.sx, c.sy, c.sw, c.sh, 0, 0, c.w, c.h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  if (!blob) throw new Error("Conversion de la photo impossible.");
  if (blob.size > 8 * 1024 * 1024) throw new Error(`« ${file.name} » dépasse 8 Mo une fois préparée.`);
  return { path: await uploadJpeg(blob), cropped: c.cropped };
}

/** Envoi direct d'un JPEG déjà au bon format (ex. slide générée en 1080 × 1350) dans le bucket privé. */
export async function uploadJpeg(blob: Blob): Promise<string> {
  const { path, token } = await call<{ path: string; token: string }>("/upload", { method: "POST" });
  const { error } = await createSupabaseBrowserClient().storage.from("ig-media").uploadToSignedUrl(path, token, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(`Envoi de l'image refusé : ${error.message}`);
  return path;
}

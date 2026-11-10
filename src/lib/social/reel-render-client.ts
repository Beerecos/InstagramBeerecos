import type { Storyboard } from "@/domain/social/editorial/schema";
import type { MotionSpec, MotionVoiceAsset, SequenceKey, StorySpec, VoiceAsset } from "@/domain/social/reel-story";
import { apiUrl } from "./api-config";
import { getAccessToken } from "./supabase";
import { createOnlineRenderer } from "./reel-render-online";

/**
 * Client du service de rendu des Reels. Deux modes, même contrat (`startRender` / `getRender`) :
 * - « local » : serveur de rendu server/reel-render.ts, même origine que BeeMarketing (`npm run dev` / `npm run preview`)
 *   ou NEXT_PUBLIC_REEL_RENDER_URL (serveur `npm run reel:server`) ;
 * - « online » : rendu depuis le site, sans poste de rendu (voix et rendu HeyGen via la fonction `studio-render`,
 *   reel-render-online.ts). Par défaut en production quand aucun serveur de rendu n'est configuré ;
 *   NEXT_PUBLIC_REEL_RENDER_MODE=local|online force le mode.
 */

export type RenderJob = {
  id: string; state: "queued" | "running" | "done" | "error"; step: string; progress: number;
  url?: string; downloadUrl?: string; file?: string; size?: number;
  probe?: { width: number; height: number; fps: string; duration: number; video: string; audio: string | null };
  voice: Partial<Record<SequenceKey, VoiceAsset>>; warnings: string[]; error?: string;
  /** Style « Motion BeeRecos - Dynamique » : voix par scène (temps mot à mot), version sans musique, sous-titres SRT. */
  motionVoice?: Record<string, MotionVoiceAsset>;
  extras?: { noMusicUrl?: string; srtUrl?: string };
  /** Server verified TTS provenance, canonical composition and MP4 audio track; not a listening verdict. */
  narrationVerified?: boolean;
  /** Durable online backend identity, usable to retrieve owner-bound narration proof. */
  serverJobId?: string;
  renderId?: string;
};

// Next.js n'injecte les variables publiques que lues littéralement (process.env.NEXT_PUBLIC_…).
// Pas de mode « local » implicite en développement : InstagramBeerecos n'embarque pas encore le serveur de rendu
// same-origin de BeeMarketing (server/reel-render.ts) ; le mode local exige NEXT_PUBLIC_REEL_RENDER_URL (`reel:server`).
const env: Record<string, string | undefined> = {
  NEXT_PUBLIC_REEL_RENDER_URL: process.env.NEXT_PUBLIC_REEL_RENDER_URL,
  NEXT_PUBLIC_REEL_RENDER_MODE: process.env.NEXT_PUBLIC_REEL_RENDER_MODE,
};
export const RENDER_BASE = (env.NEXT_PUBLIC_REEL_RENDER_URL ?? "").replace(/\/$/, "");

export function renderMode(e: Record<string, unknown> = env): "local" | "online" {
  const forced = String(e.NEXT_PUBLIC_REEL_RENDER_MODE ?? "").trim();
  if (forced === "local" || forced === "online") return forced;
  return String(e.NEXT_PUBLIC_REEL_RENDER_URL ?? "").trim() || e.DEV === true || e.DEV === "true" ? "local" : "online";
}
export const RENDER_MODE = renderMode();

/** Rendu en ligne : appels à la fonction `studio-render` avec la session de la personne connectée. */
let online: ReturnType<typeof createOnlineRenderer> | null = null;
function onlineRenderer() {
  if (online) return online;
  online = createOnlineRenderer({
    api: async (body) => {
      if (!apiUrl) throw new Error("Backend non configuré (NEXT_PUBLIC_BEE_API_URL) : le rendu en ligne a besoin du serveur BeeMarketing.");
      const token = await getAccessToken();
      const res = await fetch(`${apiUrl}/studio-render/admin`, {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Rendu en ligne : erreur serveur (${res.status}).`);
      return data as Record<string, unknown>;
    },
    loadAsset: async (path) => {
      const res = await fetch(`${window.location.origin}/hyperframes/${path}`);
      if (!res.ok) throw new Error(`Ressource de rendu introuvable : ${path} (HTTP ${res.status}).`);
      return new Uint8Array(await res.arrayBuffer());
    },
    upload: async (url, zip) => {
      const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: new Blob([zip as BlobPart], { type: "application/zip" }) });
      if (!res.ok) throw new Error(`Envoi du projet de rendu : HTTP ${res.status}.`);
    },
    audioDuration: async (mp3) => {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        const ctx = new Ctx();
        try { return (await ctx.decodeAudioData(mp3.slice().buffer)).duration; } finally { void ctx.close(); }
      } catch {
        return null;
      }
    },
    objectUrl: (bytes, type) => URL.createObjectURL(new Blob([bytes as BlobPart], { type })),
    now: () => Date.now(),
  });
  return online;
}
const isOnlineId = (id: string) => id.startsWith("en-ligne-");

export const UNAVAILABLE =
  "Le service de rendu vidéo n'est pas joignable depuis cette version de BeeMarketing. Ouvre BeeMarketing sur le poste qui génère les vidéos (npm run dev), ou configure NEXT_PUBLIC_REEL_RENDER_URL vers un serveur de rendu (npm run reel:server).";

async function call<T>(path: string, init?: RequestInit, fetcher: typeof fetch = fetch): Promise<T> {
  let res: Response;
  try {
    res = await fetcher(`${RENDER_BASE}${path}`, init);
  } catch {
    throw new Error(UNAVAILABLE);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error(UNAVAILABLE);
  const body = (await res.json()) as T & { error?: string; errors?: string[] };
  if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" ") || UNAVAILABLE);
  return body;
}

export const startRender = async (spec: StorySpec | MotionSpec | Storyboard, fetcher?: typeof fetch): Promise<{ id: string }> =>
  RENDER_MODE === "online" && !fetcher ? onlineRenderer().start(spec) : call<{ id: string }>("/api/reels/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec }) }, fetcher);

/** `saved` : dernier état enregistré du rendu (reprise après rechargement, sans relancer de génération). */
export async function getRender(id: string, fetcher?: typeof fetch, saved?: RenderJob): Promise<RenderJob> {
  if (isOnlineId(id)) return onlineRenderer().get(id, saved);
  const job = await call<RenderJob>(`/api/reels/render/${encodeURIComponent(id)}`, undefined, fetcher);
  // Les adresses renvoyées sont relatives au serveur de rendu.
  const abs = (u?: string) => (u && u.startsWith("/") ? `${RENDER_BASE}${u}` : u);
  const voice = Object.fromEntries(Object.entries(job.voice ?? {}).map(([k, v]) => [k, v && { ...v, src: abs(v.src)! }]));
  const motionVoice = job.motionVoice && Object.fromEntries(Object.entries(job.motionVoice).map(([k, v]) => [k, { ...v, src: abs(v.src)! }]));
  const extras = job.extras && { noMusicUrl: abs(job.extras.noMusicUrl), srtUrl: abs(job.extras.srtUrl) };
  return { ...job, url: abs(job.url), downloadUrl: abs(job.downloadUrl), voice, motionVoice, extras };
}

/** Empreinte du contenu éditorial (sans les fichiers produits) : relie un MP4 à la version exacte du montage. */
export { specFingerprint } from "@/domain/social/spec-fingerprint";

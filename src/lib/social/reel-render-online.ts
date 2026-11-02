import {
  AUDREY_VOICE_ID, PRONUNCIATION_VERSION, normalizeAiNarration, buildMotionComposition, buildMotionSoundtrack, buildSoundtrack, buildStoryComposition, buildZip, DEFAULT_VOICE_SPEED, encodeWav, MOTION_ASSETS, motionSrt,
  parseMotionSpec, parseStorySpec, PROJECT_ASSETS, restoreWord, sceneDurations, SEQUENCES, spokenFrench, spokenText, storyBeats, voiceWindow,
  type MotionSpec, type MotionVoiceAsset, type SequenceKey, type StorySpec, type VoiceAsset, type ZipEntry,
} from "@/domain/social/reel-story";
import type { RenderJob } from "./reel-render-client";
import { motionFingerprint } from "@/domain/social/reel-story/motion-spec";
import { specFingerprint } from "@/domain/social/spec-fingerprint";

/**
 * RENDU EN LIGNE d'une Vidéo IA (2026-10-24, « les vidéos se génèrent depuis le site en ligne ») : aucun poste de rendu.
 * Le navigateur assemble le projet Hyperframes avec les MÊMES fonctions que l'aperçu (composition, bande son) et les voix
 * HeyGen obtenues par la fonction serveur `studio-render` ; le ZIP part dans le stockage privé, HeyGen le rend
 * (HyperFrames cloud, 1080×1920, 30 i/s) et le MP4 revient par URL signée. Même contrat que le serveur local
 * (`startRender` / `getRender`) : l'interface ne change pas.
 * Écarts assumés avec le rendu local (signalés dans les avertissements) : pas de normalisation -14 LUFS ni de version
 * sans musique (FFmpeg). Une phrase trop longue bloque le rendu plutôt que d'accélérer Audrey ou de couper la voix.
 */

/** Identité réelle obligatoire pour toutes les générations IA. */
export const ONLINE_DEFAULT_VOICE = AUDREY_VOICE_ID;
/** Intervalle minimal entre deux interrogations du rendu HeyGen. */
const POLL_MS = 5000;

export type OnlineApi = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;
export type OnlineDeps = {
  api: OnlineApi;
  /** Ressource de public/hyperframes/ (polices, GSAP, logos, mascotte). */
  loadAsset: (path: string) => Promise<Uint8Array>;
  /** Dépôt du ZIP sur l'URL signée. */
  upload: (url: string, zip: Uint8Array) => Promise<void>;
  /** Durée réelle d'un MP3 (s), null si illisible. */
  audioDuration: (mp3: Uint8Array) => Promise<number | null>;
  /** Adresse locale d'un fichier produit (écoute de la voix, SRT). */
  objectUrl: (bytes: Uint8Array, type: string) => string;
  now: () => number;
};

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function speak(deps: OnlineDeps, text: string, voiceId: string, speed: number) {
  const r = await deps.api({ action: "tts", text, voiceId, speed });
  const audio = fromBase64(String(r.audioBase64 ?? ""));
  if (!audio.length) throw new Error("Voix HeyGen vide.");
  const words = (Array.isArray(r.words) ? r.words : []) as { text: string; start: number; end: number }[];
  const duration = typeof r.duration === "number" ? r.duration : 0;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Durée de la voix illisible.");
  if (typeof r.receiptId !== "string") throw new Error("Preuve de narration Audrey manquante.");
  return { audio, words, duration, receiptId: r.receiptId };
}

type Built = { entries: ZipEntry[]; voice: RenderJob["voice"]; motionVoice?: Record<string, MotionVoiceAsset>; warnings: string[]; srt?: string; title: string };

async function assets(deps: OnlineDeps, list: string[]): Promise<ZipEntry[]> {
  return Promise.all(list.map(async (path) => {
    const data = await deps.loadAsset(path);
    if (!data?.length) throw new Error(`Ressource de rendu introuvable : ${path}`);
    return { path, data };
  }));
}

async function buildMotion(deps: OnlineDeps, spec: MotionSpec, progress: (p: number) => void): Promise<Built> {
  const warnings: string[] = [];
  const voiceId = AUDREY_VOICE_ID;

  const motionVoice: Record<string, MotionVoiceAsset> = {};
  const files: ZipEntry[] = [];
  for (const [i, s] of spec.scenes.entries()) {
    const written = s.voice.split(/\s+/);
    const v = await speak(deps, spokenFrench(s.voice), voiceId, spec.voice.speed);
    motionVoice[s.id] = {
      src: deps.objectUrl(v.audio, "audio/mpeg"), duration: v.duration, text: s.voice, voiceId, speed: spec.voice.speed, pronunciationVersion: PRONUNCIATION_VERSION, receiptId: v.receiptId,
      words: v.words.map((w) => ({ text: restoreWord(w.text, written), start: w.start, end: w.end })),
    };
    files.push({ path: `voix/${s.id}.mp3`, data: v.audio });
    progress(Math.round(((i + 1) / spec.scenes.length) * 15));
  }
  const voiced: MotionSpec = { ...spec, assets: { voice: motionVoice } };
  const durs = sceneDurations(voiced);
  spec.scenes.forEach((s, i) => {
    if (motionVoice[s.id].duration > durs[i] + 0.05) warnings.push(`Scène ${i + 1} : la voix (${motionVoice[s.id].duration.toFixed(1)} s) déborde de sa scène — raccourcis la phrase.`);
  });
  const html = buildMotionComposition(voiced, { assetBase: ".", soundtrackSrc: "bande-son.wav", resolveVoice: (_src, id) => `voix/${id}.mp3` });
  const entries: ZipEntry[] = [
    { path: "index.html", data: new TextEncoder().encode(html) },
    { path: "narration.json", data: new TextEncoder().encode(JSON.stringify(voiced)) },
    { path: "bande-son.wav", data: encodeWav(buildMotionSoundtrack(voiced)) },
    ...files,
    ...(await assets(deps, MOTION_ASSETS)),
  ];
  return { entries, voice: {}, motionVoice, warnings, srt: motionSrt(voiced), title: spec.title };
}

async function buildStory(deps: OnlineDeps, spec: StorySpec, progress: (p: number) => void): Promise<Built> {
  const warnings: string[] = [];
  const voice: Partial<Record<SequenceKey, VoiceAsset>> = {};
  const files: ZipEntry[] = [];
  for (const [i, key] of SEQUENCES.entries()) {
    const line = spec.voice.lines[key]?.trim();
    if (line) {
      const window = voiceWindow(spec, key);
      const v = await speak(deps, spokenText(line), ONLINE_DEFAULT_VOICE, DEFAULT_VOICE_SPEED);
      if (v.duration > window) {
        throw new Error(`Voix « ${line} » : ${v.duration.toFixed(1)} s pour ${window.toFixed(1)} s disponibles — raccourcis la phrase ou allonge la séquence. Le débit d’Audrey est conservé.`);
      }
      voice[key] = { src: deps.objectUrl(v.audio, "audio/mpeg"), duration: v.duration, text: line, voiceId: AUDREY_VOICE_ID, speed: DEFAULT_VOICE_SPEED, pronunciationVersion: PRONUNCIATION_VERSION, receiptId: v.receiptId };
      files.push({ path: `voix/${key}.mp3`, data: v.audio });
    }
    progress(Math.round(((i + 1) / SEQUENCES.length) * 15));
  }
  const voiced: StorySpec = { ...spec, assets: { voice } };
  const beats = storyBeats(voiced);
  const windows = SEQUENCES.flatMap((k) => (voice[k] ? [{ start: beats.voiceAt[k], end: beats.voiceAt[k] + voice[k]!.duration }] : []));
  const html = buildStoryComposition(voiced, { assetBase: ".", soundtrackSrc: "bande-son.wav", resolveVoice: (_src, k) => `voix/${k}.mp3` });
  const entries: ZipEntry[] = [
    { path: "index.html", data: new TextEncoder().encode(html) },
    { path: "narration.json", data: new TextEncoder().encode(JSON.stringify(voiced)) },
    { path: "bande-son.wav", data: encodeWav(buildSoundtrack(voiced, windows)) },
    ...files,
    ...(await assets(deps, PROJECT_ASSETS)),
  ];
  return { entries, voice, warnings, title: spec.title };
}

const isMotionSpec = (spec: StorySpec | MotionSpec): spec is MotionSpec => (spec as { kind?: string }).kind === "motion";

type Running = { job: RenderJob; jobId?: string; renderId?: string; lastPoll: number; srtUrl?: string };

/** Rendus en ligne lancés depuis cet onglet. */
export function createOnlineRenderer(deps: OnlineDeps) {
  const jobs = new Map<string, Running>();
  let n = 0;

  async function run(r: Running, spec: StorySpec | MotionSpec) {
    const job = r.job;
    try {
      job.state = "running";
      const motion = isMotionSpec(spec);
      // Instagram BeeRecos : cette version a-t-elle déjà été soumise (autre appareil, onglet fermé) ? Alors on suit ce
      // rendu au lieu de payer voix et rendu une seconde fois. Serveur non mis à jour (action inconnue) : on continue.
      const fingerprint = motion ? motionFingerprint(spec) : specFingerprint(spec);
      try {
        const known = await deps.api({ action: "jobs", fingerprint });
        const prior = (Array.isArray(known.jobs) ? known.jobs : []).find((e: { state?: string; jobId?: string; renderId?: string }) => e && e.state !== "failed" && e.jobId && e.renderId) as { jobId: string; renderId: string } | undefined;
        if (prior) {
          r.jobId = prior.jobId; r.renderId = prior.renderId;
          job.serverJobId = prior.jobId; job.renderId = prior.renderId;
          job.warnings.push("Cette version a déjà été soumise au rendu : suivi repris, sans nouvelle voix ni nouveau rendu facturé (voix et SRT de l'aperçu non régénérés).");
          job.step = "Rendu de la vidéo (en ligne) — suivi repris";
          job.progress = 25;
          return;
        }
      } catch { /* index des rendus indisponible : génération normale */ }
      job.step = "Voix off";
      const built = motion ? await buildMotion(deps, spec, (p) => { job.progress = p; }) : await buildStory(deps, spec, (p) => { job.progress = p; });
      job.voice = built.voice;
      if (built.motionVoice) job.motionVoice = built.motionVoice;
      job.warnings.push(...built.warnings);
      job.step = "Envoi du projet";
      job.progress = 18;
      const up = await deps.api({ action: "upload-url" });
      r.jobId = String(up.jobId);
      job.serverJobId = r.jobId;
      await deps.upload(String(up.uploadUrl), buildZip(built.entries));
      const sub = await deps.api({ action: "submit", jobId: r.jobId, title: built.title, fingerprint });
      r.renderId = String(sub.renderId);
      job.renderId = r.renderId;
      if (built.srt) r.srtUrl = deps.objectUrl(new TextEncoder().encode(built.srt), "application/x-subrip");
      if (motion) job.warnings.push("Rendu en ligne : volume non normalisé à -14 LUFS et version sans musique non produite (disponibles avec le serveur de rendu local).");
      job.step = "Rendu de la vidéo (en ligne)";
      job.progress = 25;
    } catch (e) {
      job.state = "error";
      job.error = e instanceof Error ? e.message : "Rendu en ligne impossible.";
    }
  }

  function start(spec: unknown): { id: string } {
    const isMotion = (spec as { kind?: string } | null)?.kind === "motion";
    const parsed = isMotion ? parseMotionSpec(spec) : parseStorySpec(spec);
    if (!parsed.ok) throw new Error(["La vidéo ne peut pas être générée.", ...parsed.errors].join(" "));
    const id = `en-ligne-${++n}-${deps.now()}`;
    const r: Running = { job: { id, state: "queued", step: "En attente", progress: 0, voice: {}, warnings: [] }, lastPoll: 0 };
    jobs.set(id, r);
    const normalized = normalizeAiNarration(parsed.spec);
    void run(r, normalized);
    return { id };
  }

  /**
   * Reprise après rechargement (Instagram BeeRecos) : le suivi repart de l'état enregistré du rendu (identifiants
   * serveur `serverJobId` / `renderId`), jamais d'une nouvelle génération. Sans `renderId`, l'envoi est réconcilié
   * avec le serveur : `submit` sur le même jobId est idempotent (preuve stockée, clé `studio-<jobId>` côté HeyGen) ;
   * si le projet n'est jamais arrivé, le serveur refuse et rien n'est facturé.
   */
  async function resume(saved: RenderJob): Promise<Running | null> {
    if (!saved.serverJobId) return null;
    const r: Running = { job: { ...saved, warnings: [...(saved.warnings ?? [])] }, jobId: saved.serverJobId, renderId: saved.renderId, lastPoll: 0 };
    if (!r.renderId) {
      const sub = await deps.api({ action: "submit", jobId: r.jobId });
      r.renderId = String(sub.renderId);
      r.job.renderId = r.renderId;
    }
    r.job.state = "running";
    r.job.step = "Rendu de la vidéo (en ligne) — suivi repris";
    jobs.set(saved.id, r);
    return r;
  }

  async function get(id: string, saved?: RenderJob): Promise<RenderJob> {
    let r = jobs.get(id);
    if (!r && saved && saved.id === id) {
      try { r = (await resume(saved)) ?? undefined; }
      catch (e) { return { ...saved, state: "error", error: `Reprise du rendu impossible : ${e instanceof Error ? e.message : "serveur indisponible"}.` }; }
      if (!r) return { ...saved, state: "error", error: "La génération a été interrompue avant l'envoi du projet au serveur : rien n'a été rendu. Relance la génération." };
    }
    if (!r) throw new Error("Rendu introuvable (la page a été rechargée ?) : relancez la génération.");
    const job = r.job;
    if (job.state !== "running" || !r.renderId || deps.now() - r.lastPoll < POLL_MS) return { ...job };
    r.lastPoll = deps.now();
    try {
      const s = await deps.api({ action: "status", jobId: r.jobId, renderId: r.renderId });
      if (s.state === "error") { job.state = "error"; job.error = String(s.error ?? "Rendu échoué."); }
      else if (s.state === "done") {
        if (s.narrationVerified !== true) { job.state = "error"; job.error = "Narration Audrey non vérifiée : régénérez la vidéo."; return { ...job }; }
        job.narrationVerified = true;
        job.url = String(s.url);
        job.downloadUrl = String(s.url);
        job.size = typeof s.size === "number" ? s.size : undefined;
        job.file = `${r.jobId}.mp4`;
        if (r.srtUrl) job.extras = { srtUrl: r.srtUrl };
        job.progress = 100;
        job.step = "Terminé";
        job.state = "done";
      } else job.progress = Math.min(95, job.progress + 3);
    } catch (e) {
      // Une interrogation manquée n'arrête pas le rendu : on réessaie au tour suivant.
      job.step = `Rendu de la vidéo (en ligne) — ${e instanceof Error ? e.message : "réseau indisponible"}, nouvel essai…`;
    }
    return { ...job };
  }

  return { start, get };
}

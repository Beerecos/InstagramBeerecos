"use client";
/**
 * Import de prises filmées (2026-11-12) : un seul moteur pour l'écran « Importer ma vidéo » et pour le nouveau studio.
 * Lecture → dépôt signé de chaque prise, bout à bout → transcription → ouverture du montage.
 */
import { useEffect, useRef, useState } from "react";
import { videoDurationMs } from "@/lib/social/video-duration";
import { montage } from "@/lib/social/montage-api";
import { MAX_UPLOAD_BYTES } from "@/domain/social/montage/montage";
import { energyFrames, speechIslands } from "@/domain/social/montage/pipeline";
import { MAX_TAKES } from "@/domain/social/montage/edit";

export const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm";

/** Îlots de parole (énergie par fenêtres de 20 ms) pour recaler le transcript ; facultatif. */
export async function measureSpeech(file: File): Promise<{ fromMs: number; toMs: number }[] | null> {
  if (file.size > 200 * 1024 * 1024) return null;
  try {
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(await file.arrayBuffer());
    await ctx.close();
    const ch = audio.getChannelData(0);
    const pcm = new Int16Array(ch.length);
    for (let i = 0; i < ch.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(ch[i] * 32767)));
    return speechIslands(energyFrames(pcm, audio.sampleRate));
  } catch {
    return null;
  }
}

/** Envoie une prise de plus sur un montage existant (lot S3 bis) : dépôt signé, puis enregistrement mesuré. */
export async function sendTake(id: string, file: File, setStep: (s: string) => void, label: string) {
  setStep(`Lecture de ${label}…`);
  const [durationMs, islands] = await Promise.all([videoDurationMs(file), measureSpeech(file)]);
  const added = await montage.addTake(id, { fileName: file.name, size: file.size });
  setStep(`Envoi de ${label}…`);
  const res = await fetch(added.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "video/mp4" }, body: file });
  if (!res.ok) throw new Error(`Envoi de ${label} interrompu (${res.status}) : relancez.`);
  await montage.takeUploaded(id, { file: added.file, durationMs, islands });
}

/** Vidéos retenues, triées par nom (ordre des prises), ou le message qui explique le refus. */
export function pickVideos(list: FileList | File[] | null): { files: File[] } | { error: string } | null {
  const all = [...(list ?? [])];
  if (!all.length) return null;
  const videos = all.filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
  if (!videos.length) return { error: "Ce fichier n'est pas une vidéo .mp4 ou .mov." };
  if (videos.length > MAX_TAKES) return { error: `${MAX_TAKES} prises au plus : sélectionne moins de vidéos.` };
  if (videos.some((file) => file.size > MAX_UPLOAD_BYTES)) return { error: "Une prise dépasse 500 Mo : exporte-la plus légère." };
  return { files: videos.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })) };
}

/** Le titre reprend le nom du premier fichier (sans extension). */
export const titleFromFile = (file: File) => file.name.replace(/\.[^.]+$/, "").trim() || "Ma vidéo";

export function useVideoImport({ onDone, reelId }: { onDone: (id: string) => void; reelId?: string }) {
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const running = useRef(false);
  useEffect(() => {
    if (!step) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);

  async function transcribeReceived(id: string) {
    setStep("Transcription et préparation des séquences…");
    setError(null);
    try {
      await montage.transcribe(id);
      onDone(id);
    } catch (err) {
      setError(`La vidéo est enregistrée, mais la transcription n’a pas abouti : ${err instanceof Error ? err.message : "service indisponible"}. Relancez sans renvoyer le fichier, ou ouvrez le montage pour reprendre.`);
    } finally {
      running.current = false;
      setStep(null);
    }
  }

  /** Envoie les prises dans l'ordre donné, puis lance la transcription. */
  async function start(files: File[], title?: string) {
    if (running.current) return;
    const file = files[0];
    if (!file) { setError("Choisissez une vidéo."); return; }
    if (files.length > MAX_TAKES) { setError(`${MAX_TAKES} prises au plus par montage.`); return; }
    if (files.some((f) => f.size > MAX_UPLOAD_BYTES)) { setError("Une prise dépasse 500 Mo : exportez-la plus légère."); return; }
    running.current = true;
    setError(null);
    setReceivedId(null);
    let received: string | null = null;
    try {
      const label = files.length > 1 ? "la prise 1" : "la prise";
      setStep(`Lecture de ${label}…`);
      const [durationMs, islands] = await Promise.all([videoDurationMs(file), measureSpeech(file)]);
      setStep("Préparation…");
      const created = await montage.create({ title: title?.trim() || titleFromFile(file), fileName: file.name, size: file.size, ...(reelId ? { reelId } : {}) });
      setStep(`Envoi de ${label}…`);
      const res = await fetch(created.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "video/mp4" }, body: file });
      if (!res.ok) throw new Error(`Envoi interrompu (${res.status}) : relancez.`);
      setStep("Enregistrement…");
      await montage.uploaded(created.id, { durationMs, islands });
      received = created.id;
      // Prises suivantes, une à une, dans l'ordre choisi : elles se posent bout à bout.
      for (const [k, f] of files.slice(1).entries()) await sendTake(created.id, f, setStep, `la prise ${k + 2}`);
      setReceivedId(created.id);
      await transcribeReceived(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Envoi impossible.";
      running.current = false;
      setStep(null);
      // Prise 1 reçue mais une suivante a échoué : le montage s'ouvre avec les prises reçues, la carte « Prises »
      // permet d'ajouter les autres.
      if (received) { window.alert(`${message}\nLe montage s'ouvre avec les prises déjà reçues : ajoutez les autres depuis « Prises ».`); onDone(received); }
      else setError(message);
    }
  }

  /** Transcription relancée sans renvoyer les fichiers. */
  async function retry() {
    if (running.current || !receivedId) return;
    running.current = true;
    await transcribeReceived(receivedId);
  }

  return { step, error, setError, receivedId, start, retry, busy: Boolean(step) };
}

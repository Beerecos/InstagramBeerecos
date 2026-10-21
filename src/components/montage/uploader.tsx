"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createMontageAction, markUploadedAction } from "@/app/(app)/_actions/montages";
import { Button } from "@/components/ui";
import { energyFrames, speechIslands } from "@/domain/video/pipeline";
import { MAX_UPLOAD_BYTES } from "@/domain/video/montage";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Durée de la vidéo lue par le navigateur (métadonnées seules, sans tout charger). */
function videoDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(v.duration)) resolve(Math.round(v.duration * 1000));
      else reject(new Error("Durée illisible."));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Ce navigateur ne sait pas lire cette vidéo : exportez-la en .mp4 (H.264)."));
    };
    v.src = url;
  });
}

/**
 * Îlots de parole mesurés dans le navigateur (énergie par fenêtres de 20 ms) : ils servent à recaler le transcript,
 * comme le fait ffmpeg en local. Facultatif : si le décodage échoue, le transcript de Scribe est gardé tel quel.
 */
async function measureSpeech(file: File): Promise<{ fromMs: number; toMs: number }[] | null> {
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

export function MontageUploader({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choisissez une vidéo.");
    if (file.size > MAX_UPLOAD_BYTES) return setError("La prise dépasse 500 Mo : exportez-la plus légère.");
    setError(null);
    try {
      setStep("Lecture de la prise…");
      const [durationMs, islands] = await Promise.all([videoDurationMs(file), measureSpeech(file)]);
      setStep("Préparation…");
      const created = await createMontageAction({ title: title.trim() || file.name.replace(/\.[^.]+$/, ""), fileName: file.name, size: file.size });
      if ("error" in created) throw new Error(created.error);
      setStep("Envoi de la prise…");
      const { error: upErr } = await createSupabaseBrowserClient().storage.from("montages").uploadToSignedUrl(created.path, created.token, file, { contentType: file.type || "video/mp4" });
      if (upErr) throw new Error(`Envoi interrompu : ${upErr.message}`);
      setStep("Enregistrement…");
      const done = await markUploadedAction(created.id, { durationMs, islands });
      if (done.error) throw new Error(done.error);
      router.push(`/montage/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
      setStep(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Nouveau montage">
      <label className="block text-sm font-medium">
        Titre
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex. Une recommandation, ça vaut combien ?" className="mt-1 block w-full rounded-xl bg-surface-1 px-3 py-2 text-sm ring-1 ring-line focus:outline-none focus:ring-brand" />
      </label>
      <label className="block text-sm font-medium">
        Prise filmée (vertical 9:16, .mp4 ou .mov, 500 Mo max)
        <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
      </label>
      <Button type="submit" icon={<Upload size={16} aria-hidden />} disabled={disabled || !file || Boolean(step)}>
        {step ?? "Envoyer et commencer"}
      </Button>
      {error ? <p role="alert" className="text-sm text-status-critical">{error}</p> : null}
    </form>
  );
}

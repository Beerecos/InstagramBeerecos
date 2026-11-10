"use client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Film, Upload } from "lucide-react";
import { BriefSchema, StoryboardSchema } from "@/domain/social/montage/ideation";
import { MOTION_STYLE_LABEL, motionPlan, PILLAR_LABEL, SEQUENCES, SEQUENCE_LABEL, type MotionSpec, type StorySpec } from "@/domain/social/reel-story";
import { useSearchParams } from "@/components/social/router";
import StudioCutPlan from "@/components/social/studio/StudioCutPlan";
import StudioTrim from "@/components/social/studio/StudioTrim";
import ReelPreview, { prefersReducedMotion, type ReelPreviewHandle } from "@/components/social/ReelPreview";
import StudioTimeline from "@/components/social/studio/StudioTimeline";
import StudioInspector from "@/components/social/studio/StudioInspector";
import StudioCanvas from "@/components/social/studio/StudioCanvas";
import StudioEffectLibrary from "@/components/social/studio/StudioEffectLibrary";
import type { StudioSourceRef, StudioSourceTransfer } from "@/domain/social/studio-sources";
import { placeStudioEffect } from "@/domain/social/studio-effect-placement";
import { withAnimationIds } from "@/domain/social/montage/placement";
import "./studio/studio-workspace.css";
import StudioTranscript, { type WordSelection } from "@/components/social/studio/StudioTranscript";
import StudioCaptions from "@/components/social/studio/StudioCaptions";
import StudioFeedback, { type Proposal } from "@/components/social/studio/StudioFeedback";
import StudioContactSheet from "@/components/social/studio/StudioContactSheet";
import StudioStoryboardCards from "@/components/social/studio/StudioStoryboardCards";
import StudioMedia from "@/components/social/studio/StudioMedia";
import StudioIdeation from "@/components/social/studio/StudioIdeation";
import StudioSettingsPanel from "@/components/social/studio/StudioSettingsPanel";
import ReelsCatalogue from "@/components/social/studio/ReelsCatalogue";
import Prompteur from "@/components/social/studio/Prompteur";
import type { Reel } from "@/domain/social/montage/reels";
import type { MediaItem } from "@/domain/social/montage/media";
import MontageAnimations, { type MontageAnimationsHandle } from "@/components/social/MontageAnimations";
import StudioLibraryDialog from "@/components/social/studio/StudioLibraryDialog";
import StudioFraming from "@/components/social/studio/StudioFraming";
import StudioSimpleCaptions from "@/components/social/studio/StudioSimpleCaptions";
import StudioDirector from "@/components/social/studio/StudioDirector";
import StudioBeeStyles from "@/components/social/studio/StudioBeeStyles";
import StudioAutoSave from "@/components/social/studio/StudioAutoSave";
import { END_VIDEO, STUDIO_LOGO_DEFAULT } from "@/domain/social/montage/brand";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { removeSequence } from "@/domain/social/montage/sequence-edit";
import { studioSequences } from "@/domain/social/montage/studio-sequences";
import type { Scene } from "@/domain/social/montage/scenes";
import ReelBrandCharter from "@/components/social/ReelBrandCharter";
import MontagePublish from "@/components/social/MontagePublish";
import AiEditor from "@/components/reels/ai-editor";
import { useWaveform } from "@/components/reels/use-waveform";
import { cutOutputZone, stepMs } from "@/domain/studio/timeline";
import { EditSync, History, type SyncState } from "@/domain/studio/edit-sync";
import PostPanel from "@/components/reels/post-panel";
import { keptWords, type CustomAnimation } from "@/domain/social/montage/suggest";
import { stampMotionVersions } from "@/domain/social/montage/beemotion";
import { isMontageConfigured, montage, reels, type MontageDetail, type MontageSummary } from "@/lib/social/montage-api";
import { buildEditComposition } from "@/domain/social/montage/edit-composition";
import { MAX_UPLOAD_BYTES, MONTAGE_STATUS_LABELS, takesOf } from "@/domain/social/montage/montage";
import { energyFrames, speechIslands } from "@/domain/social/montage/pipeline";
import { layout, MAX_STRIP_MS, MAX_TAKES, takeBreaks, takeStrip, toOutputMs, type Edit } from "@/domain/social/montage/edit";
import { checkStudioEdit, cutSource, outputToSourceMs, restoreSource, wordSpan } from "@/domain/social/montage/studio";
import { MATTE_COMMAND, MATTE_MAX_BYTES, matteAt } from "@/domain/social/montage/matte";
import { applyStandard } from "@/domain/social/montage/standard";
import { BEE_STYLE, swapWordAnimation, WORD_ANIMATIONS, WORD_LABEL, wordText, type BeeStyle, type WordAnimation } from "@/domain/social/montage/bee-styles";
import type { AnimationTemplate } from "@/domain/social/montage/template";

/**
 * RÉSEAUX SOCIAUX → MONTAGE (2026-10-21, porté de BeeMarketing / InstagramBeerecos) : une prise filmée → transcription
 * mot à mot → coupe → animations → rendu. STUDIO (2026-10-22, conforme au studio du Video Agent Kit, §7) : barre
 * d'outils (montages, annuler / refaire, coupe auto, rendu), lecteur au centre, transcript cliquable (glisser +
 * Suppr = couper), timeline (prise et coupes hachurées, sous-titres, animations, sons, zoom), panneau de droite
 * (Idéation, Coupe auto, Animations, Médias, Sous-titres, Retours, Planche, Rendu). Chaque modification est validée par le serveur
 * (save-edit) et annulable. Lot S2 : « Tout auto », panneau Retours (Bee propose, rien sans « Appliquer ») et
 * planche contact validée avant tout rendu. Animations : MontageAnimations. Rendu et « Reels IA » : MontagePublish.
 */

const sec = (ms: number | null | undefined) => `${((ms ?? 0) / 1000).toFixed(1).replace(".", ",")} s`;

/** Durée lue par le navigateur (métadonnées seules). */
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

/** Îlots de parole (énergie par fenêtres de 20 ms) pour recaler le transcript ; facultatif. */
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

/** Envoie une prise de plus sur un montage existant (lot S3 bis) : dépôt signé, puis enregistrement mesuré. */
async function sendTake(id: string, file: File, setStep: (s: string) => void, label: string) {
  setStep(`Lecture de ${label}…`);
  const [durationMs, islands] = await Promise.all([videoDurationMs(file), measureSpeech(file)]);
  const added = await montage.addTake(id, { fileName: file.name, size: file.size });
  setStep(`Envoi de ${label}…`);
  const res = await fetch(added.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "video/mp4" }, body: file });
  if (!res.ok) throw new Error(`Envoi de ${label} interrompu (${res.status}) : relancez.`);
  await montage.takeUploaded(id, { file: added.file, durationMs, islands });
}

/** `reelId` : prise d'un des 72 Reels (lot S7) — le montage lui est lié et prend son titre. */
export function Uploader({ onDone, reelId }: { onDone: (id: string) => void; reelId?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const running = useRef(false);
  const locked = Boolean(step) || Boolean(receivedId);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!step) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step]);
  const pick = (list: FileList | null) => {
    const videos = [...(list ?? [])].filter((f) => f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name));
    if (list?.length && !videos.length) { setError("Ce fichier n'est pas une vidéo .mp4 ou .mov."); return; }
    if (videos.length > MAX_TAKES) { setError(`${MAX_TAKES} prises au plus : sélectionne moins de vidéos.`); return; }
    if (videos.some((file) => file.size > MAX_UPLOAD_BYTES)) { setError("Une prise dépasse 500 Mo : exporte-la plus légère."); return; }
    setError(null);
    setFiles(videos.sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })));
  };

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

  const move = (i: number, by: number) => setFiles((f) => { const next = [...f]; [next[i], next[i + by]] = [next[i + by], next[i]]; return next; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (running.current) return;
    if (receivedId) {
      running.current = true;
      await transcribeReceived(receivedId);
      return;
    }
    const file = files[0];
    if (!file) return setError("Choisissez une vidéo.");
    if (files.length > MAX_TAKES) return setError(`${MAX_TAKES} prises au plus par montage.`);
    if (files.some((f) => f.size > MAX_UPLOAD_BYTES)) return setError("Une prise dépasse 500 Mo : exportez-la plus légère.");
    running.current = true;
    setError(null);
    let received: string | null = null;
    try {
      const label = files.length > 1 ? "la prise 1" : "la prise";
      setStep(`Lecture de ${label}…`);
      const [durationMs, islands] = await Promise.all([videoDurationMs(file), measureSpeech(file)]);
      setStep("Préparation…");
      const created = await montage.create({ title: title.trim() || file.name.replace(/\.[^.]+$/, ""), fileName: file.name, size: file.size, ...(reelId ? { reelId } : {}) });
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
      // Prise 1 reçue mais une suivante a échoué : le montage s'ouvre avec les prises reçues, la carte « Prises »
      // permet d'ajouter les autres.
      if (received) { window.alert(`${message}\nLe montage s'ouvre avec les prises déjà reçues : ajoutez les autres depuis « Prises ».`); onDone(received); }
      else setError(message);
    } finally {
      running.current = false;
      setStep(null);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5" aria-label={reelId ? `Prise de ${reelId}` : "Nouveau montage"}>
      <h2 className="font-display text-lg">{reelId ? `Prise filmée de ${reelId}` : "Nouveau montage"}</h2>
      {reelId ? <p className="text-xs text-mut">Le montage est lié à {reelId} et prend son titre. Gardez 2 s de prise après le dernier mot (carte de fin).</p> : (
      <label className="block text-sm font-medium">
        Titre
        <input disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex. Une recommandation, ça vaut combien ?" className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
      </label>)}
      {/* Zone d'import bien visible (le bouton natif « Sélect. fichiers » passait pour du texte) : clic ou glisser-déposer. */}
      <label
        onDragOver={(e) => { if (!locked) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!locked) pick(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-brand bg-brand-soft" : "border-line hover:border-brand hover:bg-brand-soft/40"} ${locked ? "pointer-events-none opacity-60" : ""}`}>
        <Upload aria-hidden size={32} className="text-brand" />
        <span className="btn-red pointer-events-none min-h-11 px-5">{files.length ? "Changer de vidéo" : "Choisir mes vidéos"}</span>
        <span className="text-sm text-mut">ou glisse-les ici</span>
        <span className="text-xs text-mut">Verticale ou paysage (recadrage 9:16 dans le studio) · .mp4 ou .mov · 500 Mo au plus chacune · {MAX_TAKES} prises au plus · {MAX_STRIP_MS / 60_000} min en tout</span>
        <input disabled={locked} type="file" multiple aria-label="Prises filmées" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} className="sr-only" />
      </label>
      {files.length === 1 ? <p className="flex items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2 text-sm"><Film aria-hidden size={16} className="text-brand" /><span className="min-w-0 flex-1 truncate">{files[0].name}</span><span className="text-xs text-mut">{Math.round(files[0].size / 1024 / 1024)} Mo</span><button type="button" disabled={locked} className="btn-ghost" onClick={() => setFiles([])}>Retirer</button></p> : null}
      {files.length > 1 ? (
        <ol aria-label="Ordre des prises" className="space-y-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-black/[0.03] px-2 py-1">
              <span className="w-16 shrink-0 font-medium">Prise {i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-mut">{f.name}</span><button type="button" disabled={locked} className="btn-ghost min-h-11 px-2 text-xs" aria-label={`Retirer ${f.name}`} onClick={() => setFiles((all) => all.filter((_, index) => index !== i))}>Retirer</button>
              <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={i === 0 || locked} onClick={() => move(i, -1)} aria-label={`Monter ${f.name}`}>↑</button>
              <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={i === files.length - 1 || locked} onClick={() => move(i, 1)} aria-label={`Descendre ${f.name}`}>↓</button>
            </li>
          ))}
        </ol>
      ) : null}
      {files.length > 1 ? <p className="text-xs text-mut">Les prises sont montées bout à bout dans cet ordre. La coupe auto propose de garder la dernière version d&apos;une phrase redite d&apos;une prise à l&apos;autre.</p> : null}
      <p className="text-xs text-mut">La transcription démarre automatiquement après l’envoi de toutes les prises sélectionnées. Gardez cette page ouverte : le studio s’ouvrira avec vos séquences dès la fin du traitement.</p>
      {step ? <p role="status" className="text-sm text-brand">{step}</p> : null}
      <button type="submit" className="btn-red min-h-[44px] w-full disabled:cursor-not-allowed disabled:opacity-40" disabled={!files.length || Boolean(step)} aria-busy={Boolean(step)}>
        {step ?? (receivedId ? "Relancer la transcription" : "Envoyer et commencer")}
      </button>
      {receivedId && !step ? <button type="button" className="btn-ghost min-h-[44px]" onClick={() => onDone(receivedId)}>Ouvrir le montage enregistré</button> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}

/** Prises du montage (lot S3 bis) : ajout et retrait possibles tant que le montage n'est pas transcrit. */
function TakesCard({ m, onChange }: { m: MontageDetail; onChange: () => void }) {
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!m.edit) return null;
  const takes = takesOf(m.edit, m.durationMs);
  const open = !m.captions.length && m.status !== "transcribing" && !m.sentToReels && m.renderStatus !== "rendering";
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setStep(null); onChange(); }
  };
  const add = (list: FileList | null) => {
    const picked = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
    if (!picked.length) return;
    void run(async () => { for (const [k, f] of picked.entries()) await sendTake(m.id, f, setStep, `la prise ${takes.length + k + 1}`); });
  };
  if (takes.length < 2 && !open) return null;
  return (
    <section aria-label="Prises" className="card space-y-2 p-4">
      <h3 className="font-display text-base">Prises</h3>
      <ol className="space-y-1 text-sm">
        {takes.map((t, i) => (
          <li key={t.file} className="flex items-center gap-2 rounded-lg bg-black/[0.03] px-2 py-1">
            <span className="w-16 shrink-0 font-medium">Prise {i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-mut">{t.file}</span>
            <span className="tabular-nums text-mut">{sec(t.durationMs)}</span>
            {open && i > 0 ? <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={Boolean(step)} onClick={() => run(() => montage.removeTake(m.id, t.file))} aria-label={`Retirer la prise ${i + 1}`}>Retirer</button> : null}
          </li>
        ))}
      </ol>
      {open ? (
        <>
          <label className="block text-sm font-medium">
            Ajouter une ou plusieurs prises (à la suite, avant la transcription)
            <input type="file" multiple accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" disabled={Boolean(step) || takes.length >= MAX_TAKES} onChange={(e) => { add(e.target.files); e.target.value = ""; }} className="mt-1 block w-full text-sm" />
          </label>
          <p className="text-xs text-mut">{MAX_TAKES} prises au plus, {MAX_STRIP_MS / 60_000} min en tout. Une fois transcrit, le montage garde ses prises.</p>
        </>
      ) : <p className="text-xs text-mut">Montage transcrit : ses prises ne changent plus (créez un nouveau montage pour en ajouter).</p>}
      {step ? <p role="status" className="text-sm text-mut">{step}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

/**
 * Détourage des prises (lot S5) : la personne détourée sur le poste (aucun service tiers), envoyée à côté de sa prise,
 * permet le « titre derrière le sujet ». Possible à tout moment avant le rendu.
 */
function MattesCard({ m, onChange }: { m: MontageDetail; onChange: () => void }) {
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!m.edit) return null;
  const edit = m.edit;
  const takes = takesOf(edit, m.durationMs);
  const frozen = m.sentToReels || m.renderStatus === "rendering";
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setStep(null); onChange(); }
  };
  const send = (take: string, label: string, file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      if (file.size > MATTE_MAX_BYTES) throw new Error(`Détourage trop lourd (${MATTE_MAX_BYTES / 1024 / 1024} Mo au plus).`);
      setStep(`Lecture du détourage de ${label}…`);
      const durationMs = await videoDurationMs(file);
      const added = await montage.addMatte(m.id, { take, fileName: file.name, size: file.size });
      setStep(`Envoi du détourage de ${label}…`);
      const res = await fetch(added.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/webm" }, body: file });
      if (!res.ok) throw new Error(`Envoi du détourage interrompu (${res.status}) : relancez.`);
      await montage.matteUploaded(m.id, { take, durationMs });
    });
  };
  return (
    <section id="studio-mattes" tabIndex={-1} aria-label="Détourage" className="card space-y-2 p-4">
      <h3 className="font-display text-base">Détourage (titre derrière le sujet)</h3>
      <p className="text-xs text-mut">Sur votre ordinateur, détourez le fichier envoyé (environ 7 à 8 min pour 30 s de vidéo), puis envoyez le .webm obtenu.</p>
      <ol className="space-y-2 text-sm">
        {takes.map((t, i) => {
          const label = takes.length > 1 ? `la prise ${i + 1}` : "la prise";
          const matte = edit.mattes?.[t.file];
          return (
            <li key={t.file} className="space-y-1 rounded-lg bg-black/[0.03] px-2 py-1.5" data-testid="matte-row">
              <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 font-medium">{takes.length > 1 ? `Prise ${i + 1}` : "Prise"}</span>
                {matte ? <span className="min-w-0 flex-1 truncate text-emerald-800">Détourée ✓ {matte}</span> : <span className="min-w-0 flex-1 text-mut">Pas de détourage</span>}
                {matte && !frozen ? <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={Boolean(step)} onClick={() => run(() => montage.removeMatte(m.id, t.file))} aria-label={`Retirer le détourage de ${label}`}>Retirer</button> : null}
              </div>
              {!matte && !frozen ? (
                <>
                  <code className="block overflow-x-auto whitespace-nowrap rounded bg-black/[0.05] px-2 py-1 text-xs">{MATTE_COMMAND(t.file)}</code>
                  <label className="block text-xs font-medium">
                    Envoyer le détourage de {label} (.webm)
                    <input type="file" accept="video/webm,.webm" disabled={Boolean(step)} onChange={(e) => { send(t.file, label, e.target.files?.[0]); e.target.value = ""; }} className="mt-1 block w-full text-sm" />
                  </label>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
      {step ? <p role="status" className="text-sm text-mut">{step}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}

type Panel = "ideation" | "coupe" | "animations" | "medias" | "sous-titres" | "retours" | "planche" | "rendu" | "post";
const PANELS: { key: Panel; label: string }[] = [
  { key: "animations", label: "Titre et animations" }, { key: "ideation", label: "Idéation" }, { key: "coupe", label: "Coupe auto" }, { key: "medias", label: "Médias" }, { key: "sous-titres", label: "Sous-titres" },
  { key: "retours", label: "Retours" }, { key: "planche", label: "Planche" }, { key: "rendu", label: "Rendu" }, { key: "post", label: "Post et export" },
];

/** Bibliothèque de médias (lot S3), partagée par l'accueil et le Studio. */
function useLibrary() {
  const [library, setLibrary] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => { montage.mediaList().then((r) => setLibrary(r.media)).catch((e) => { setLibrary([]); setError(e.message); }); }, []);
  useEffect(refresh, [refresh]);
  return { library, error, refresh };
}

type MontageData = Awaited<ReturnType<typeof montage.get>>;

/** Studio simple : les quatre étapes (et « Terminer »), en gros boutons. */
/**
 * Parcours du Studio (refonte 2026-11-09, « Tu parles. BeeMarketing monte. ») : cinq étapes au lieu des panneaux
 * techniques. Chaque étape réutilise les outils existants (cadrage, coupes, sous-titres, animations, retours, planche,
 * rendu, post) ; le mode avancé reste disponible pour le réglage fin.
 */
export type StudioStep = "importer" | "storyboard" | "style" | "apercu" | "publier";
export const STUDIO_STEPS: { key: StudioStep; label: string; hint: string }[] = [
  { key: "importer", label: "Importer", hint: "Ta vidéo, cadrage, détourage" },
  { key: "storyboard", label: "Storyboard", hint: "Garder ou retirer les passages" },
  { key: "style", label: "Style", hint: "Sous-titres et animations" },
  { key: "apercu", label: "Aperçu", hint: "Retouches et validation" },
  { key: "publier", label: "Publier", hint: "Vidéo finale et post" },
];
function SimpleSteps({ step, onStep, hasEdit, ready }: { step: StudioStep; onStep: (s: StudioStep) => void; hasEdit: boolean; ready: boolean }) {
  const current = STUDIO_STEPS.findIndex((s) => s.key === step);
  return (
    <nav aria-label="Étapes du montage" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-center gap-1">
        {STUDIO_STEPS.map((s, i) => {
          const off = !hasEdit || (!ready && (s.key === "style" || s.key === "apercu"));
          return (
            <li key={s.key} className="flex items-center gap-1">
              {i > 0 ? <span aria-hidden className="text-mut">→</span> : null}
              <button type="button" aria-current={step === s.key ? "step" : undefined} disabled={off} onClick={() => onStep(s.key)} title={s.hint}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition disabled:opacity-40 ${step === s.key ? "border-brand bg-brand font-semibold text-white" : i < current ? "border-brand/30 bg-brand/5 text-brand" : "border-line bg-white hover:border-brand"}`}>
                <span className="tabular-nums">{i + 1}</span> {s.label}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-xs text-mut">{STUDIO_STEPS[current]?.hint}</p>
    </nav>
  );
}

/** Choix du projet dans la barre du studio (Instagram BeeRecos) : passer d'un réel à l'autre sans quitter le studio. */
function ProjectPicker({ id, title, onSwitch }: { id: string; title: string; onSwitch: (target: string) => void }) {
  const [list, setList] = useState<MontageSummary[] | null>(null);
  useEffect(() => { montage.list().then((r) => setList(r.montages)).catch(() => setList([])); }, []);
  const projects = [...(list ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <label className="studio-project flex min-w-0 items-center gap-2">
      <span className="sr-only">Projet ouvert</span>
      <select value={id} onChange={(e) => onSwitch(e.target.value)} className="min-h-[40px] min-w-0 max-w-[340px] truncate rounded-xl border border-line bg-white px-3 text-sm font-semibold">
        {!projects.some((p) => p.id === id) ? <option value={id}>{title}</option> : null}
        {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        <option disabled>──────────</option>
        <option value="__video">＋ Nouveau réel filmé</option>
        <option value="__ia">＋ Nouveau réel IA</option>
        <option value="__tous">Tous mes réels…</option>
      </select>
    </label>
  );
}

function Editor({ id, onBack, onOpenSource, onSwitch }: { id: string; onBack: () => void; onOpenSource:(source:StudioSourceRef)=>void; onSwitch?: (target: string) => void }) {
  const [data, setData] = useState<MontageData | null>(null);
  /** Avertissements du dernier contrôle du storyboard (gardés quand le panneau Idéation se recharge). */
  const [ideationWarnings, setIdeationWarnings] = useState<string[]>([]);
  const lib = useLibrary();
  const [error, setError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  // Instagram BeeRecos : `?panel=post` ouvre directement « Post et export » (depuis la bibliothèque des réels).
  const [panelParams] = useSearchParams();
  const [panel, setPanel] = useState<Panel>(() => PANELS.some((p) => p.key === panelParams.get("panel")) ? panelParams.get("panel") as Panel : "animations");
  const [libraryOpen,setLibraryOpen]=useState(false);
  // Mode simple (par défaut) : 4 étapes (cadrage, coupes, sous-titres, animations) puis « Terminer ». Le mode avancé
  // garde tous les outils ; le choix est retenu sur cet appareil.
  const [simple,setSimpleMode]=useState(()=>{try{return typeof window==="undefined"||localStorage.getItem("ibr.studio.mode")!=="avance";}catch{return true;}});
  const [simpleStep,setSimpleStep]=useState<StudioStep>("storyboard");
  const switchMode=(next:boolean)=>{setSimpleMode(next);try{localStorage.setItem("ibr.studio.mode",next?"simple":"avance");}catch{/* stockage indisponible */}};
  const [libraryTab,setLibraryTab]=useState<"animations"|"effects"|"sounds">("animations");
  const [expanded,setExpanded]=useState(()=>typeof window==="undefined"||window.innerWidth>=768);
  const [monitorView, setMonitorView] = useState<"edit"|"render">("edit");
  const renderedVideo = useRef<HTMLVideoElement>(null);
  const [selection, setSelection] = useState<WordSelection>(null);
  const animations = useRef<MontageAnimationsHandle>(null);
  const [selectedSceneIndex,setSelectedSceneIndex]=useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const draftUndo = useRef<CustomAnimation[][]>([]);
  const draftRedo = useRef<CustomAnimation[][]>([]);
  const [playOut, setPlayOut] = useState<number | null>(null);
  /** Repères I / O en temps du montage (zone à couper avec X). */
  const [zone, setZone] = useState<{ in: number | null; out: number | null }>({ in: null, out: null });
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Résultat du Standard BeeRecos, affiché dans l’étape Animations (là où l’on relit). */
  const [standardNote, setStandardNote] = useState<string | null>(null);
  // « Mon modèle » (réglages du Studio) : utilisé à la place du Standard BeeRecos v1 quand il existe.
  const [template, setTemplate] = useState<AnimationTemplate | null | undefined>(undefined); // undefined : pas encore lu
  const useStandard = false;
  useEffect(() => { montage.getSettings().then((r) => setTemplate(r.settings.animationTemplate ?? null)).catch(() => setTemplate(null)); }, []);
  /** Prompteur du Reel lié (lot S7) : texte chargé à l'ouverture. */
  const [prompteur, setPrompteur] = useState<Reel | null>(null);
  const player = useRef<ReelPreviewHandle>(null);
  const pendingEdits = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const preview = useRef<HTMLElement>(null);
  // Brouillon des animations : affiché tout de suite dans l'aperçu, enregistré seulement sur demande.
  const [draft, setDraft] = useState<CustomAnimation[]>([]);
  const [animationChoices, setAnimationChoices] = useState<string[] | undefined>(undefined);
  const [animationBusy, setAnimationBusy] = useState(false);
  const savedChoices = useRef<string | undefined>(undefined);
  const saved = useRef<string>("[]");
  const [logo,setLogo]=useState<Edit["logo"]>();
  const savedLogo=useRef<string|undefined>(undefined);
  // Montage instantané : file d'enregistrement en arrière-plan et historique local (annuler / refaire immédiats).
  const sync = useRef<EditSync<Edit, { i: number; text: string }, MontageData> | null>(null);
  const editHistory = useRef(new History<Edit>());
  const undoOrder = useRef<("draft" | "edit")[]>([]);
  const redoOrder = useRef<("draft" | "edit")[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({ status: "enregistré", pending: 0 });
  const hydrateRef = useRef<(r: MontageData, resetDraft?: boolean) => void>(() => {});
  const shortcuts = useRef<{ undo: () => void; redo: () => void; key: (e: KeyboardEvent) => boolean }>({ undo: () => {}, redo: () => {}, key: () => false });
  useEffect(() => {
    // Ctrl/Cmd+Z, Ctrl/Cmd+Maj+Z ou Ctrl+Y, hors des champs de saisie (leur annulation native reste disponible).
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (!(e.ctrlKey || e.metaKey)) {
        // Raccourcis de monteur, hors du transcript (qui a ses propres touches) et des actions déjà traitées.
        if (e.defaultPrevented || e.altKey || t?.closest('[aria-label="Mots de la prise"], [role="dialog"]')) return;
        if (shortcuts.current.key(e)) e.preventDefault();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); shortcuts.current.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); shortcuts.current.redo(); }
    };
    const onLeave = (e: BeforeUnloadEvent) => { if (sync.current?.busy || pendingEdits.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeunload", onLeave); };
  }, []);
  if (!sync.current) sync.current = new EditSync<Edit, { i: number; text: string }, MontageData>({
    saveEdit: (edit, base) => montage.saveEdit(id, edit, base),
    fixWords: (fixes) => montage.fixWords(id, fixes),
    fetch: async () => { const r = await montage.get(id); return { data: r, updatedAt: r.montage.updatedAt }; },
    onFresh: (r) => hydrateRef.current(r),
    onState: setSyncState,
  }, "");
  const load = useCallback((resetDraft = false) => {
    return montage.get(id).then((r) => {
      if (!sync.current?.busy) sync.current?.reset(r.montage.updatedAt);
      else return; // des modifications locales partent encore : la version fraîche arrivera par la file
      hydrateRef.current(r, resetDraft);
    }).catch((e) => setError(e.message));
  }, [id]);
  hydrateRef.current = (r: MontageData, resetDraft = false) => {
      if (r.montage.edit) r.montage.edit.custom = withAnimationIds(r.montage.edit.custom);
      setData(r);
      const beforeLogo=savedLogo.current;
      setLogo(current=>resetDraft||JSON.stringify(current)===beforeLogo?r.montage.edit?.logo:current);
      savedLogo.current=JSON.stringify(r.montage.edit?.logo);
      if (resetDraft) { draftUndo.current = []; draftRedo.current = []; }
      const next = r.montage.edit?.custom ?? [];
      // Capture the previous server version before scheduling the updater: React may run it
      // after saved.current changes. Preserve genuine local edits, but hydrate a clean draft.
      const previouslySaved = saved.current;
      setDraft((d) => (resetDraft || JSON.stringify(d) === previouslySaved ? next : d));
      saved.current = JSON.stringify(next);
      const previouslySavedChoices = savedChoices.current;
      const nextChoices = r.montage.edit?.animationChoices;
      setAnimationChoices((c) => resetDraft || JSON.stringify(c) === previouslySavedChoices ? nextChoices : c);
      savedChoices.current = JSON.stringify(nextChoices);
  };
  useEffect(() => { void load(); }, [load]);
  const renderStatus = data?.montage.renderStatus;
  useEffect(() => {
    if (renderStatus !== "rendering") return;
    const timer = setInterval(() => { montage.renderStatus(id).then((r) => { if (r.renderStatus !== "rendering") void load(); }).catch((e) => setError(e.message)); }, 10_000);
    return () => clearInterval(timer);
  }, [id, renderStatus, load]);

  const html = useMemo(() => {
    if (!data?.montage.edit || !data.videoUrl) return null;
    const url = data.videoUrl;
    const video = data.montage.edit.video;
    // Prises : URL signées ; sons et images : URL signée renvoyée par le serveur, sinon celle de la bibliothèque.
    const mediaUrl = (file: string) => (file === video ? url : data.takeUrls?.[file] ?? data.matteUrls?.[file] ?? data.mediaUrls?.[file] ?? lib.library?.find((x) => x.fileName === file)?.url ?? "");
    // Une proposition de Bee en attente est montrée telle quelle ; sinon le montage enregistré + le brouillon d'animations.
    const shown = proposal ? proposal.edit : { ...data.montage.edit, custom: draft, logo };
    try { return buildEditComposition(shown, data.montage.captions, { assetBase: `${window.location.origin}/hyperframes`, preview: true, mediaUrl }); } catch { return null; }
  }, [data, draft, logo, proposal, lib.library]);
  const shownRanges = proposal?.edit.ranges ?? data?.montage.edit?.ranges;
  const segments = useMemo(() => (shownRanges ? layout(shownRanges) : []), [shownRanges]);
  const scenes = useMemo(() => studioSequences(data?.montage.captions ?? [], shownRanges ?? [], data?.montage.reel?.keyword), [data?.montage.captions, data?.montage.reel?.keyword, shownRanges]);
  // Après un déplacement manuel, la position choisie est gardée jusqu'à ce que le lecteur l'ait rejointe (ou reparte
  // en lecture) : ses mises à jour périodiques ne ramènent pas la tête de lecture à l'ancienne position.
  const manualSeek = useRef<{ ms: number; at: number; last: number | null } | null>(null);
  const onTime = useCallback((seconds: number) => {
    const ms = Math.round(seconds * 1000);
    const s = manualSeek.current;
    if (s) {
      const caughtUp = Math.abs(ms - s.ms) <= 150;
      const playing = s.last !== null && ms !== s.last && Date.now() - s.at > 1500;
      s.last = ms;
      if (!caughtUp && !playing) return;
      manualSeek.current = null;
    }
    setPlayOut(ms);
  }, []);
  const waveTakes = useMemo(() => {
    const e = data?.montage.edit;
    if (!e || !data?.videoUrl) return [];
    return takeStrip(e).map((t) => ({ key: t.file, url: t.file === e.video ? data.videoUrl! : data.takeUrls?.[t.file] ?? "", fromMs: t.fromMs, toMs: t.toMs })).filter((t) => t.url);
  }, [data]);
  const { wave, note: waveNote } = useWaveform(waveTakes, data?.montage.durationMs ?? 0);
  // Standard BeeRecos posé automatiquement (brouillon) à l'ouverture d'une vidéo transcrite sans animation, une fois par
  // montage, quel que soit le mode du Studio. La fonction est définie plus bas (après le chargement) : appelée par ref.
  const standardRef = useRef<((replace: boolean) => void) | null>(null);
  const standardDone = useRef<string | null>(null);
  useEffect(() => {
    const mm = data?.montage;
    // Attendre de savoir s'il existe « Mon modèle » pour ne pas poser le Standard à sa place.
    if (!mm?.edit || !mm.captions.length || mm.reel || standardDone.current === mm.id || template === undefined) return;
    standardDone.current = mm.id;
    if (!(mm.edit.custom ?? []).length) standardRef.current?.(false);
  }, [data, template]);

  if (error && !data) return <p role="alert" className="text-sm text-red-700">{error}</p>;
  if (!data) return <p role="status" className="text-sm text-mut">Chargement du montage…</p>;
  const m = data.montage;
  const selectedAnim = draft.findIndex((a) => a.id === selectedId);
  const selectedAnimation = draft[selectedAnim] ?? null;
  const changeDraft = (next: CustomAnimation[]) => {
    const normalized = withAnimationIds(next);
    if (JSON.stringify(normalized) === JSON.stringify(draft)) return;
    draftUndo.current = [...draftUndo.current, draft].slice(-30); draftRedo.current = [];
    undoOrder.current = [...undoOrder.current, "draft" as const].slice(-60); redoOrder.current = [];
    setMonitorView("edit");
    setDraft(normalized);
    if (!normalized.some((a) => a.id === selectedId)) setSelectedId(normalized[normalized.length - 1]?.id ?? null);
  };
  const changeAnimation = (a: CustomAnimation) => changeDraft(draft.map((c) => c.id === a.id ? a : c));
  const activeScene = scenes.find(scene=>scene.index===selectedSceneIndex) ?? scenes[0];
  const selectScene = (scene:Scene) => {
    setSelectedSceneIndex(scene.index);setPanel("animations");setMonitorView("edit");
    setSelectedId(draft.find(a=>a.fromMs>=scene.startMs&&a.fromMs<scene.endMs)?.id??null);
    seekSource(scene.startMs);
  };
  const breaks = m.edit ? takeBreaks(m.edit) : [];
  const frozen = m.sentToReels || m.renderStatus === "rendering";
  const playSource = playOut === null || !segments.length ? null : outputToSourceMs(segments, playOut);
  const seekSource = (sourceMs: number) => {
    if (!segments.length) return;
    const seconds = toOutputMs(segments, sourceMs) / 1000;
    setMonitorView("edit");
    // La tête de lecture suit le déplacement tout de suite, même sans lecture (couper au curseur, timecode).
    manualSeek.current = { ms: Math.round(seconds * 1000), at: Date.now(), last: null };
    setPlayOut(Math.round(seconds * 1000));
    if (player.current) player.current.seek(seconds); else pendingSeek.current = seconds;
  };
  /** Attend la fin de l'enregistrement en arrière-plan avant une action serveur (rendu, transcription…). */
  const settle = async () => {
    for (let i = 0; i < 600 && sync.current?.busy; i++) await new Promise((r) => setTimeout(r, 100));
    if (sync.current && ["conflit", "erreur"].includes(syncState.status)) throw new Error("Enregistrement en attente : réglez-le avant cette action.");
  };
  const act = async (fn: () => Promise<unknown>) => {
    setSaving(true); setError(null);
    try { await settle(); await fn(); await load(); return true; } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); return false; } finally { setSaving(false); }
  };
  // Coupe, rétablissement, recadrage, sous-titres… : appliqués tout de suite, enregistrés en arrière-plan.
  const applyLocal = (edit: Edit) => setData((d) => d ? { ...d, montage: { ...d.montage, edit, keptMs: edit.ranges.reduce((n, r) => n + r.toMs - r.fromMs, 0) } } : d);
  const save = async (edit: Edit) => {
    if (!m.edit || frozen) return false;
    setError(null);
    editHistory.current.record(m.edit);
    undoOrder.current = [...undoOrder.current, "edit" as const].slice(-60); redoOrder.current = [];
    applyLocal(edit);
    sync.current?.pushEdit(edit);
    return true;
  };
  const fixWord = (i: number, text: string) => {
    setData((d) => d ? { ...d, montage: { ...d.montage, captions: d.montage.captions.map((w, k) => (k === i ? { ...w, text } : w)) } } : d);
    sync.current?.pushFix([{ i, text }]);
  };
  const undo = () => {
    const kind = undoOrder.current.pop();
    if (kind === "draft") { const previous = draftUndo.current.pop(); if (previous) { draftRedo.current.push(draft); setDraft(previous); redoOrder.current.push("draft"); } return; }
    if (kind === "edit" && m.edit) { const previous = editHistory.current.undo(m.edit); if (previous) { applyLocal(previous); sync.current?.pushEdit(previous); redoOrder.current.push("edit"); } return; }
    if (!unsaved) void act(() => montage.undo(m.id));
  };
  const redo = () => {
    const kind = redoOrder.current.pop();
    if (kind === "draft") { const next = draftRedo.current.pop(); if (next) { draftUndo.current.push(draft); setDraft(next); undoOrder.current.push("draft"); } return; }
    if (kind === "edit" && m.edit) { const next = editHistory.current.redo(m.edit); if (next) { applyLocal(next); sync.current?.pushEdit(next); undoOrder.current.push("edit"); } return; }
    if (!unsaved) void act(() => montage.redo(m.id));
  };
  const totalOut = segments.reduce((n, sg) => n + sg.toMs - sg.fromMs, 0);
  const seekOutput = (ms: number) => {
    const v = Math.max(0, Math.min(totalOut, Math.round(ms)));
    setMonitorView("edit");
    manualSeek.current = { ms: v, at: Date.now(), last: null };
    setPlayOut(v);
    if (player.current) player.current.seek(v / 1000); else pendingSeek.current = v / 1000;
  };
  const cutZone = () => {
    if (!m.edit || zone.in === null || zone.out === null || frozen || proposal) return;
    const next = cutOutputZone(m.edit.ranges, zone.in, zone.out);
    if (!next) { setError("Zone trop courte, ou elle retirerait tout le montage."); return; }
    setZone({ in: null, out: null });
    void save({ ...m.edit, ranges: next });
    seekOutput(Math.min(zone.in, zone.out));
  };
  const editable = !saving && !animationBusy && !frozen;
  shortcuts.current = {
    undo: () => { if (editable) undo(); },
    redo: () => { if (editable) redo(); },
    key: (e) => {
      const pos = playOut ?? 0;
      switch (e.key) {
        case " ": if (player.current?.paused?.() ?? true) player.current?.play(); else player.current?.pause(); return true;
        case "k": case "K": player.current?.pause(); return true;
        case "l": case "L": player.current?.play(); return true;
        case "j": case "J": player.current?.pause(); seekOutput(pos - 1000); return true;
        case "ArrowLeft": player.current?.pause(); seekOutput(pos - stepMs(e.shiftKey)); return true;
        case "ArrowRight": player.current?.pause(); seekOutput(pos + stepMs(e.shiftKey)); return true;
        case "Home": seekOutput(0); return true;
        case "End": seekOutput(totalOut); return true;
        case "i": case "I": setZone((z) => ({ ...z, in: pos })); return true;
        case "o": case "O": setZone((z) => ({ ...z, out: pos })); return true;
        case "x": case "X": if (editable) cutZone(); return true;
        case "Escape": if (zone.in !== null || zone.out !== null) { setZone({ in: null, out: null }); return true; } return false;
        default: return false;
      }
    },
  };
  const transcribe = async () => {
    setTranscribing(true); setError(null);
    try { await settle(); await montage.transcribe(m.id); } catch (e) { setError(e instanceof Error ? e.message : "Transcription impossible."); } finally { setTranscribing(false); load(); }
  };
  const cutWords = (from: number, to: number) => {
    if (!m.edit) return;
    const span = wordSpan(m.captions, from, to);
    const ranges = cutSource(m.edit.ranges, span.fromMs, span.toMs);
    if (!ranges.length) return setError("Cette coupe ne garde rien : sélectionnez moins de mots.");
    setSelection(null);
    void save({ ...m.edit, ranges });
  };
  const restoreWords = (from: number, to: number) => {
    if (!m.edit) return;
    const span = wordSpan(m.captions, from, to);
    setSelection(null);
    void save({ ...m.edit, ranges: restoreSource(m.edit.ranges, span.fromMs, span.toMs, m.durationMs ?? undefined) });
  };
  const ready = Boolean(m.edit && m.captions.length);
  standardRef.current = (replace: boolean) => applyStandardDraft(replace);
  /** Dynamique « BeeRecos Standard v1 » : mêmes animations, mêmes réglages, posées depuis ce qui est dit (brouillon à relire). */
  const applyStandardDraft = (replace: boolean, standardOnly = useStandard, style?: BeeStyle) => {
    if (!m.edit || !ready || frozen || saving || animationBusy || proposal) return;
    if (!replace && draft.length) return;
    const chosen = standardOnly ? null : template ?? null;
    const look = style ? BEE_STYLE[style] : null;
    if (replace && draft.length && !window.confirm(look ? `Remplacer les animations actuelles par le style « ${look.label} » ?` : chosen ? `Remplacer les animations actuelles par ton modèle « ${chosen.name} » ?` : "Remplacer les animations actuelles par le standard BeeRecos ?")) return;
    const edit = m.edit;
    const end = edit.ranges[edit.ranges.length - 1]?.toMs ?? 0;
    const r = applyStandard(scenes, { endMs: end, keyword: m.reel?.keyword ?? null, matteAt: (ms) => matteAt(edit, ms), words: keptWords(m.captions, edit.ranges), ...(chosen ? { template: chosen } : {}), ...(look ? { look: look.look, styleName: look.label } : {}) });
    // À l'ouverture : enregistré tout de suite (sinon le brouillon bloquerait le cadrage et les sous-titres) ; modifiable
    // ensuite comme toute animation, et rien n'est rendu sans l'aperçu validé. Sur le bouton : brouillon à relire.
    // Film IA : il se termine déjà par la vidéo de fin officielle (reel-story) ; pas de seconde fin.
    const custom = m.aiSource ? r.custom.filter((a) => a.name !== "logo-fin") : r.custom;
    if (replace) changeDraft(custom);
    else { const placed = withAnimationIds(custom); setDraft(placed); void saveDraft(placed).catch(() => {}); }
    setStandardNote(`${look ? `Style « ${look.label} »` : chosen ? `Mon modèle « ${chosen.name} »` : "Standard BeeRecos"} appliqué : ${custom.length} animation(s). ${replace ? "Vérifie dans l’aperçu, ajuste si besoin, puis enregistre." : "Enregistré : vérifie dans l’aperçu et ajuste si besoin."}${r.warnings.length ? `\n${r.warnings.join("\n")}` : ""}`);
  };
  const unsaved = Boolean(proposal) || JSON.stringify(logo)!==JSON.stringify(m.edit?.logo) || JSON.stringify(draft) !== JSON.stringify(m.edit?.custom ?? []) || JSON.stringify(animationChoices) !== JSON.stringify(m.edit?.animationChoices);
  pendingEdits.current = unsaved;
  const canLeave = () => !(unsaved || sync.current?.busy) || window.confirm("Quitter le montage avec des modifications non enregistrées ?");
  const manualPreview = (edit: Edit, source: NonNullable<Proposal["source"]>) => {
    setError(null);setMonitorView("edit");setProposal({edit,baseUpdatedAt:m.updatedAt,source});
  };
  const appendOutro = () => {
    if (!m.edit || saving || frozen || animationBusy) return;
    if (unsaved) { setNotice("Enregistrez ou annulez la modification en cours avant d’ajouter le logo de fin."); return; }
    setLibraryOpen(false);
    manualPreview({...m.edit,outro:{durationMs:2000,baseline:true},custom:m.edit.custom.filter(a=>a.name!=="logo-fin")},"outro");
    player.current?.seek(segments.reduce((n,s)=>n+s.toMs-s.fromMs,0)/1000);
  };
  const deleteScene = () => {
    if (!m.edit || !activeScene || unsaved || saving || frozen || animationBusy) return;
    try {manualPreview(removeSequence(m.edit,activeScene),"sequence");setSelection(null);setSelectedId(null);player.current?.seek(0);}
    catch(e){setError(e instanceof Error?e.message:"Suppression impossible.");}
  };
  const showRendered = monitorView === "render" && !unsaved && m.renderStatus === "done" && Boolean(m.finalVideoUrl);
  const applyProposal = async (p: Proposal) => {
    setSaving(true);
    try { await settle(); await montage.saveEdit(m.id, p.edit, p.source ? sync.current!.baseVersion : p.baseUpdatedAt); setProposal(null); await load(true); }
    finally { setSaving(false); }
  };
  const saveDraft = async (custom: CustomAnimation[] = draft) => {
    setSaving(true); setError(null);
    try { await settle(); await montage.saveEdit(m.id, { ...m.edit!, custom: stampMotionVersions(withAnimationIds(custom)), animationChoices, logo }, sync.current!.baseVersion || m.updatedAt); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); throw e; }
    finally { setSaving(false); }
  };
  // « Tout auto » : sélection enregistrée obligatoire, puis proposition dans l’aperçu avant Appliquer.
  const autoAll = async () => {
    if (m.edit?.animationChoices === undefined) {
      setPanel("animations"); setNotice("Choisissez vos cartes dans la bibliothèque, puis enregistrez vos choix avant de demander une proposition automatique."); return;
    }
    setSaving(true); setError(null); setNotice(null); setProposal(null);
    try {
      await settle();
      let baseUpdatedAt = sync.current?.baseVersion || m.updatedAt;
      if (!m.captions.length) {
        setTranscribing(true); await montage.transcribe(m.id); setTranscribing(false);
        baseUpdatedAt = (await montage.get(m.id)).montage.updatedAt;
      }
      const r = await montage.auto(m.id, baseUpdatedAt);
      setProposal({ edit: r.proposal, baseUpdatedAt: r.baseUpdatedAt });
      setNotice(`Proposition : ${r.dropped} phrase(s) à retirer, ${r.animations} animation(s) à ajouter. Testez dans l’aperçu puis appliquez ou écartez.${r.note ? `\n${r.note}` : ""}`);
      setPanel("retours");
    } catch (e) { setError(e instanceof Error ? e.message : "Montage automatique impossible."); } finally { setTranscribing(false); setSaving(false); load(); }
  };

  // Un des 72 Reels (lot S7) : ses textes de scène, son mot-clé et la carte de fin posés sur la voix réelle.
  const seedReel = async () => {
    setSaving(true); setError(null); setNotice(null); setProposal(null);
    try {
      await settle();
      const r = await reels.seed(m.id);
      setNotice(`${r.placed} animation(s) du Reel posée(s) sur la voix (révision ${r.revision}). ↶ Annuler le défait.${r.warnings.length ? `\n${r.warnings.join("\n")}` : ""}`);
      setPanel("animations");
    } catch (e) { setError(e instanceof Error ? e.message : "Pose des animations impossible."); } finally { setSaving(false); load(); }
  };
  const openPrompteur = async () => {
    if (!m.reel) return;
    try { setPrompteur((await reels.get(m.reel.reelId)).reel.data); } catch (e) { setError(e instanceof Error ? e.message : "Prompteur indisponible."); }
  };

  const content = (
    <div className={expanded ? "social-studio studio-expanded space-y-3" : "space-y-4"}>
      {/* En-tête du studio (kit §7) : montages, annuler / refaire, coupe auto, rendu. */}
      <div className="card flex flex-wrap items-center gap-2 p-3" role="toolbar" aria-label="Outils du montage">
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={() => { if (canLeave()) onBack(); }} title="Quitter le studio : tous mes réels">←</button>
        {onSwitch ? <ProjectPicker id={m.id} title={m.title} onSwitch={(target) => { if (canLeave()) onSwitch(target); }} /> : null}
        <div className="studio-title min-w-0 basis-full lg:basis-auto lg:min-w-[160px] lg:flex-1">
          <p className="kicker text-brand">{MONTAGE_STATUS_LABELS[m.status]}{saving ? " · enregistrement…" : ""} · {sec(m.keptMs)} montées</p>
          <p role="status" aria-live="polite" className={`text-xs ${syncState.status === "conflit" || syncState.status === "erreur" ? "text-red-700" : "text-mut"}`}>
            {syncState.status === "enregistrement" ? "Enregistrement en arrière-plan…" : syncState.status === "erreur" ? <>Non enregistré : {syncState.error} <button type="button" className="underline" onClick={() => sync.current?.retry()}>Réessayer</button></> : syncState.status === "conflit" ? <>Modifié ailleurs : tes derniers changements ne sont pas enregistrés. <button type="button" className="underline" onClick={() => { editHistory.current.clear(); undoOrder.current = []; redoOrder.current = []; sync.current?.reset(""); void load(true); }}>Recharger la version du serveur</button></> : "Tout est enregistré"}
          </p>
          <h2 className={onSwitch ? "sr-only" : "truncate font-display text-xl"}>{m.title}</h2>
        </div>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={saving || animationBusy || frozen || (!m.canUndo && !undoOrder.current.length)} onClick={undo} title="Annuler la dernière modification (Ctrl+Z)">↶ Annuler</button>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={saving || animationBusy || frozen || (!m.canRedo && !redoOrder.current.length)} onClick={redo} title="Refaire la modification annulée (Ctrl+Maj+Z)">↷ Refaire</button>
        {!simple ? <>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={!ready} onClick={() => setPanel("coupe")}>✂ Coupe auto</button>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={!m.edit || saving || animationBusy || frozen || transcribing || m.status === "transcribing" || unsaved} onClick={autoAll} title="Préparer une proposition de coupe et d’animations à tester avant validation">⚡ Tout auto</button>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" disabled={!m.edit} onClick={() => setPanel("planche")}>Prévisualiser</button>
        </> : null}
        {!simple || unsaved ? <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" disabled={!m.edit || !unsaved || Boolean(proposal) || saving || animationBusy || frozen} onClick={() => { void saveDraft().catch(() => {}); }}>Enregistrer le montage</button> : null}
        {simple
          ? <button type="button" className="btn-red min-h-[44px] px-4 text-sm" disabled={!m.edit} onClick={() => setSimpleStep("publier")}>Publier →</button>
          : <button type="button" className="btn-red min-h-[40px] px-3 text-sm" disabled={!m.edit} onClick={() => {setPanel("rendu");setMonitorView("render");}}>Rendu</button>}
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" aria-pressed={!simple} onClick={()=>switchMode(!simple)} title={simple ? "Afficher tous les outils du studio" : "Revenir au studio simple"}>{simple ? "Mode avancé" : "Mode simple"}</button>
        <button type="button" className="btn-ghost min-h-[40px] px-3 text-sm" onClick={()=>setExpanded(!expanded)} title={expanded ? "Afficher le menu de l'application" : "Studio plein écran"}>{expanded ? "⤡" : "⤢"}</button>
      </div>
      {m.aiSource ? <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>Source IA conservée · version {m.aiSource.source.revision}{m.aiSource.verified ? " · narration Audrey vérifiée" : " · narration à vérifier"}</p><button type="button" className="btn-ghost min-h-[44px]" disabled={unsaved||saving||animationBusy} onClick={()=>onOpenSource(m.aiSource!.source)}>Rouvrir la source IA</button></div> : null}
      {m.reel ? (
        <section aria-label={`Reel ${m.reel.reelId}`} className="card flex flex-wrap items-center gap-2 p-3 text-sm">
          <p className="min-w-0 flex-1">
            <span className="font-semibold">{m.reel.reelId}</span> · appel à l&apos;action « commente {m.reel.keyword} » · texte {m.reel.approved ? "validé" : "à valider (onglet Les 72 Reels)"}
            {m.seededRevision == null ? " · animations du Reel pas encore posées" : m.seededRevision !== m.reel.revision ? ` · le texte a changé (révision ${m.reel.revision}) : replacez les animations` : ` · animations posées (révision ${m.seededRevision})`}
          </p>
          <button type="button" className="btn-ghost min-h-[36px] px-3 text-sm" onClick={openPrompteur}>Prompteur</button>
          <button type="button" className="btn-red min-h-[36px] px-3 text-sm" disabled={!ready || saving || animationBusy || frozen || unsaved} onClick={seedReel} title="Textes de scène, mot-clé et carte de fin, calés sur la voix réelle (annulable)">Placer les animations du Reel</button>
        </section>
      ) : null}
      {prompteur ? <Prompteur reel={prompteur} onClose={() => setPrompteur(null)} /> : null}
      {error ? <p role="alert" className="whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="whitespace-pre-line rounded-xl bg-brand/5 px-4 py-3 text-sm">{notice}</p> : null}
      {m.error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{m.error}</p> : null}
      {frozen ? (
        <p role="status" className="rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-mut">
          {m.sentToReels ? "Montage envoyé dans Reels IA : il ne se modifie plus (créez un nouveau montage pour changer la vidéo)." : "Rendu en cours : coupe et animations sont figées jusqu'à la fin."}
        </p>
      ) : null}
      <StudioLibraryDialog title={libraryTab==="sounds"?"Choisir un son":"Choisir une animation"} open={libraryOpen} onClose={()=>setLibraryOpen(false)}>
        <section aria-label="Bibliothèque du studio" className="studio-library card p-3">
          <h3 className="mb-2 font-semibold">Bibliothèque</h3>
          <div role="group" aria-label="Bibliothèque du studio : catégories" className="mb-3 flex gap-2">
            <button type="button" aria-pressed={libraryTab==="animations"} className="btn-ghost min-h-[44px] text-xs" onClick={()=>setLibraryTab("animations")}>Animations</button>
            <button type="button" aria-pressed={libraryTab==="effects"} className="btn-ghost min-h-[44px] text-xs" onClick={()=>setLibraryTab("effects")}>Mes effets</button>
            <button type="button" aria-pressed={libraryTab==="sounds"} className="btn-ghost min-h-[44px] text-xs" onClick={()=>setLibraryTab("sounds")}>Sons</button>
          </div>
          {m.edit && libraryTab==="sounds" ? <StudioMedia library={lib.library?.filter(item=>item.kind==="son") ?? null} onRefresh={lib.refresh} editor={{edit:m.edit,playheadMs:playSource,disabled:saving||frozen||unsaved,onSave:async(edit)=>{await montage.saveEdit(m.id,edit,m.updatedAt);await load(true);setLibraryOpen(false);}}}/> : null}
          {m.edit && libraryTab==="effects" ? <StudioEffectLibrary custom={draft} selected={selectedAnimation} ranges={m.edit.ranges} disabled={saving || animationBusy || frozen || Boolean(proposal)} onApply={effect=>{
            const next=[...draft,...placeStudioEffect(effect,m.edit!.ranges,playOut??0)];
            const checked=checkStudioEdit({...m.edit!,custom:next},m.edit!,m.durationMs,lib.library??[]);
            if(!checked.ok) throw new Error(checked.errors.join("\n"));
            changeDraft(next);setPanel("animations");setLibraryTab("animations");setLibraryOpen(false);
          }}/> : null}
            {m.edit ? <div hidden={libraryTab!=="animations"}><MontageAnimations ref={animations} studioMode activeScene={activeScene} onAppendOutro={appendOutro} onPlaced={a=>{setLibraryOpen(false);setSelectedId(a.id??null);setPanel("animations");seekSource(a.fromMs);}} key={m.updatedAt} m={m} draft={draft} onDraft={changeDraft} choices={animationChoices} onChoices={setAnimationChoices} onBusy={setAnimationBusy}
              disabled={saving || animationBusy || frozen || transcribing || m.status === "transcribing" || Boolean(proposal)} playheadMs={playSource}
              onTest={(sourceMs) => {
                seekSource(sourceMs); player.current?.play();
                preview.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "nearest" });
              }}
              onSave={async custom=>{await saveDraft(custom);setLibraryOpen(false);}} /></div> : <p className="text-sm text-mut">Envoyez d&apos;abord la prise.</p>}
        </section>
      </StudioLibraryDialog>
      <div className={`studio-workspace${simple ? " studio-simple" : ""}`} data-testid="studio-workspace">
        <aside aria-label="Outils du montage" className="studio-tools min-w-0 space-y-3">
          {simple ? <SimpleSteps step={simpleStep} onStep={setSimpleStep} hasEdit={Boolean(m.edit)} ready={ready} /> : null}
          {simple ? (m.edit ? <section hidden={simpleStep!=="importer"} className="card space-y-3 p-4"><StudioFraming edit={m.edit} disabled={saving||animationBusy||frozen||unsaved} videoUrl={data.videoUrl} onAutoOpen={()=>setSimpleStep("importer")} onApply={framing=>{void save({...m.edit!,framing});}}/></section> : simpleStep==="importer" ? <p className="card p-4 text-sm text-mut">Envoie d&apos;abord la vidéo.</p> : null) : null}
          {simple && simpleStep==="importer" ? <TakesCard m={m} onChange={load} /> : null}
          {simple && simpleStep==="importer" && m.edit ? <MattesCard m={m} onChange={load} /> : null}
          {simple && simpleStep==="style" ? <section className="card p-4">{ready && m.edit ? <StudioSimpleCaptions edit={m.edit} disabled={saving||animationBusy||frozen||Boolean(proposal)} onChange={patch=>{if(m.edit)void save({...m.edit,...patch});}} /> : <p className="text-sm text-mut">Les sous-titres arrivent avec la transcription (étape Storyboard).</p>}</section> : null}
          {simple && simpleStep==="style" && ready && m.edit ? <section className="card p-4"><StudioDirector edit={m.edit} disabled={saving||animationBusy||frozen||Boolean(proposal)} onChange={patch=>{if(m.edit)void save({...m.edit,...patch});}} /></section> : null}
          {simple && simpleStep==="style" ? <section className="card space-y-3 p-4">
            <StudioBeeStyles custom={draft} disabled={!ready||saving||animationBusy||frozen||Boolean(proposal)} onPick={(k)=>applyStandardDraft(true,true,k)} />
            {template ? <button type="button" className="btn-ghost min-h-11 w-full" disabled={!ready||saving||animationBusy||frozen||Boolean(proposal)} onClick={()=>applyStandardDraft(true,false)}>Appliquer mon modèle « {template.name} »</button> : null}
            {standardNote ? <p role="status" className="whitespace-pre-line rounded-xl bg-brand/5 px-3 py-2 text-xs">{standardNote}</p> : null}
            <button type="button" className="btn-ghost min-h-11 w-full" disabled={!m.edit||saving||animationBusy||frozen||Boolean(proposal)} onClick={()=>{setLibraryTab("animations");setLibraryOpen(true);}}>+ Ajouter une animation</button>
            <p className="text-xs text-mut">Elle se place à l&apos;endroit du curseur de lecture. Clique sur une animation pour changer son texte ou sa durée.</p>
            {draft.length ? <ul aria-label="Animations du réel" className="space-y-1">{draft.map((a)=><li key={a.id} className="flex items-center gap-2">
              <button type="button" aria-pressed={a.id===selectedId} className="btn-ghost min-h-11 min-w-0 flex-1 truncate text-left text-sm" onClick={()=>{setSelectedId(a.id??null);seekSource(a.fromMs);}}>{ANIMATIONS[a.name]?.label ?? a.name} · {sec(toOutputMs(segments,a.fromMs))}</button>
              {wordText(a)!==null && a.name!=="titre-derriere" ? <select aria-label={`Changer l'animation « ${wordText(a)} »`} value={a.name} disabled={saving||animationBusy||frozen} onChange={(e)=>changeDraft(draft.map(x=>x.id===a.id?swapWordAnimation(x,e.target.value as WordAnimation):x))} className="min-h-11 rounded-lg border border-line bg-white px-2 text-sm">
                {WORD_ANIMATIONS.map(n=><option key={n} value={n}>{WORD_LABEL[n]}</option>)}
              </select> : null}
              <button type="button" aria-label={`Retirer ${ANIMATIONS[a.name]?.label ?? a.name}`} className="btn-ghost min-h-11 min-w-11 text-red-700" disabled={saving||animationBusy||frozen} onClick={()=>{changeDraft(draft.filter(x=>x.id!==a.id));if(selectedId===a.id)setSelectedId(null);}}>✕</button>
            </li>)}</ul> : <p className="text-sm text-mut">Aucune animation pour l&apos;instant.</p>}
            {selectedAnimation ? <StudioInspector animation={selectedAnimation} ranges={m.edit?.ranges ?? []} words={m.captions} disabled={saving || animationBusy || frozen || Boolean(proposal)} onChange={changeAnimation} onRemove={() => { changeDraft(draft.filter(a => a.id !== selectedAnimation.id)); setSelectedId(null); }} onTest={() => { seekSource(selectedAnimation.fromMs);player.current?.play(); }} /> : null}
            <StudioAutoSave active={!proposal&&!saving&&!frozen&&!animationBusy} unsaved={unsaved} contentKey={JSON.stringify({draft,logo,animationChoices})} onSave={()=>saveDraft()} canDelete={Boolean(selectedId)&&!saving&&!frozen&&!animationBusy&&!proposal} onDelete={()=>{if(!selectedId)return;changeDraft(draft.filter(x=>x.id!==selectedId));setSelectedId(null);}} />
            <p role="status" className="text-xs text-mut">{saving ? "Enregistrement…" : unsaved && !proposal ? "Modifications en cours d'enregistrement…" : "✓ Enregistré automatiquement · Annuler pour revenir en arrière · Suppr retire l'animation choisie"}</p>
          </section> : null}
          {simple && simpleStep==="apercu" ? <section className="card space-y-4 p-4" aria-label="Aperçu et validation">
            <h3 className="font-semibold">✨ Améliorer avec l&apos;IA</h3>
            <p className="text-xs text-mut">Écris ce que tu veux changer (« zoom moins fort », « coupe le début », « mets BUSINESS derrière moi »). Bee propose, tu appliques.</p>
            {ready ? <StudioFeedback montageId={m.id} disabled={saving || animationBusy || frozen || (!proposal && unsaved)} proposal={proposal} onProposal={setProposal} onApply={applyProposal} /> : <p className="text-sm text-mut">Disponible après la transcription.</p>}
            <h3 className="font-semibold">Valider l&apos;aperçu</h3>
            {m.edit ? <StudioContactSheet edit={m.edit} words={m.captions} videoUrl={data.videoUrl} takeUrls={data.takeUrls} library={lib.library ?? []} storyboardApproved={m.storyboardStatus === "approved"} briefKeyword={m.brief?.motCle ?? null} approved={Boolean(m.previewApproved)} approvedAt={m.previewApprovedAt}
              unsaved={unsaved} disabled={saving || animationBusy || frozen} onApprove={async () => { await montage.approvePreview(m.id, m.updatedAt); load(); }} /> : null}
          </section> : null}
          {simple && simpleStep==="publier" ? <section className="card space-y-4 p-4">
            <h3 className="font-semibold">1. Créer la vidéo finale</h3>
            {m.edit ? <MontagePublish m={m} disabled={unsaved || saving} showTransfer={false} showVideo={false} onChange={load} onOpenPlanche={() => setSimpleStep("apercu")} /> : null}
            <h3 className="font-semibold">2. Préparer le post</h3>
            <PostPanel m={m} />
          </section> : null}
          {simple && simpleStep==="storyboard" && m.edit ? <StudioStoryboardCards m={m} disabled={saving||animationBusy||frozen||unsaved||Boolean(proposal)} onSave={async e=>{await save(e);}} onSeek={ms=>player.current?.seek(ms/1000)} onApplyProposal={applyProposal} /> : null}
          {simple && simpleStep==="storyboard" ? <p className="px-1 text-sm text-mut">Clique sur un mot ou sélectionne une phrase pour la retirer. Sur la timeline : ✂ coupe au curseur, et tu peux tirer les bords d&apos;un plan.</p> : null}
          <div hidden={simple} className="space-y-3">
          <div className="studio-tabs flex flex-wrap gap-1.5" role="group" aria-label="Outils de création">
            {PANELS.map((p) => (
              <button key={p.key} type="button" aria-pressed={panel === p.key} onClick={() => setPanel(p.key)}
                className={`min-h-[44px] shrink-0 rounded-xl px-3 py-2 text-xs ${panel === p.key ? "bg-brand text-white" : "bg-black/[0.04] text-mut hover:text-fg"}`}>{p.label}</button>
            ))}
          </div>
          {activeScene ? <p className="px-1 text-sm font-semibold">Séquence {activeScene.index+1} · {sec(toOutputMs(segments,activeScene.startMs))} → {sec(toOutputMs(segments,activeScene.endMs))}</p> : null}
          <section className="card space-y-3 p-4">
            {panel === "coupe" && (ready ? <StudioCutPlan key={m.updatedAt} m={m} disabled={saving || animationBusy || frozen || (!proposal && unsaved)} proposal={proposal}
              onClear={() => setProposal(null)} onPreview={(p) => { setProposal(p); player.current?.seek(0); preview.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}
              onApply={applyProposal} /> : <p className="text-sm text-mut">Transcrivez d&apos;abord la prise : le plan de coupe se construit phrase par phrase.</p>)}
            {panel === "animations" && <StudioInspector animation={selectedAnimation} ranges={m.edit?.ranges ?? []} words={m.captions} disabled={saving || animationBusy || frozen || Boolean(proposal)} onChange={changeAnimation} onRemove={() => { if(selectedAnimation) changeDraft(draft.filter(a => a.id !== selectedAnimation.id)); }} onTest={() => { if(selectedAnimation) {seekSource(selectedAnimation.fromMs);player.current?.play();} }} />}
            {panel === "ideation" && <StudioIdeation key={m.updatedAt} m={m} disabled={saving || animationBusy || frozen} onChange={load} warnings={ideationWarnings} onWarnings={setIdeationWarnings} />}
            {panel === "medias" && (m.edit ? (
              <StudioMedia library={lib.library} onRefresh={lib.refresh} editor={{ edit: m.edit, playheadMs: playSource, disabled: saving || frozen || unsaved, onSave: async (e) => { await montage.saveEdit(m.id, e, m.updatedAt); load(); } }} />
            ) : <p className="text-sm text-mut">Envoyez d&apos;abord la prise.</p>)}
            {panel === "sous-titres" && (ready && m.edit ? (
              <StudioCaptions key={m.updatedAt} edit={m.edit} words={m.captions} selectedWord={selection ? Math.min(selection.from, selection.to) : null} disabled={saving || animationBusy || frozen || (unsaved&&proposal?.source!=="captions")} onPreview={patch=>manualPreview({...m.edit!,...patch},"captions")}
                onSave={async (patch) => { if (m.edit) {if(await save({ ...m.edit, ...patch }))setProposal(null);} }}
                onFixWord={async (i, text) => { fixWord(i, text); }} />
            ) : <p className="text-sm text-mut">Transcrivez d&apos;abord la prise.</p>)}
            {panel === "retours" && (ready ? (
              <StudioFeedback montageId={m.id} disabled={saving || animationBusy || frozen || (!proposal && unsaved)} proposal={proposal} onProposal={setProposal}
                onApply={applyProposal} />
            ) : <p className="text-sm text-mut">Transcrivez d&apos;abord la prise : Bee s&apos;appuie sur le transcript.</p>)}
            {panel === "planche" && (m.edit ? (
              <StudioContactSheet edit={m.edit} words={m.captions} videoUrl={data.videoUrl} takeUrls={data.takeUrls} library={lib.library ?? []} storyboardApproved={m.storyboardStatus === "approved"} briefKeyword={m.brief?.motCle ?? null} approved={Boolean(m.previewApproved)} approvedAt={m.previewApprovedAt}
                unsaved={unsaved} disabled={saving || animationBusy || frozen} onApprove={async () => { await montage.approvePreview(m.id, m.updatedAt); load(); }} />
            ) : <p className="text-sm text-mut">Envoyez d&apos;abord la prise.</p>)}
            {panel === "post" && <PostPanel m={m} />}
            {panel === "rendu" && (m.edit ? <MontagePublish m={m} disabled={unsaved || saving} showTransfer={false} showVideo={false} onChange={load} onOpenPlanche={() => setPanel("planche")} /> : <p className="text-sm text-mut">Envoyez d&apos;abord la prise.</p>)}
          </section>
          </div>
          {!simple || simpleStep==="storyboard" ? <>
          {m.edit ? <StudioTrim key={m.updatedAt} edit={m.edit} durationMs={m.durationMs ?? 0} disabled={saving || animationBusy || frozen || unsaved} onSave={async e=>{await save(e);}} /> : null}
          {m.captions.length ? (
            <StudioTranscript words={m.captions} ranges={m.edit?.ranges ?? []} playheadMs={playSource} disabled={saving || animationBusy || frozen || unsaved} takeBreaks={breaks}
              onSeek={seekSource} onCut={cutWords} onRestore={restoreWords} selection={selection} onSelection={setSelection} />
          ) : (
            <section className="card space-y-3 p-5">
              <h3 className="font-display text-lg">Transcription</h3>
              <p className="text-sm text-mut">Texte mot à mot (ElevenLabs Scribe, français), recalé sur la voix réellement entendue : il sert à couper, sous-titrer et caler les animations.</p>
              {m.edit ? (
                <button type="button" className="btn-red min-h-[44px]" onClick={transcribe} disabled={transcribing || m.status === "transcribing"} aria-busy={transcribing}>
                  {transcribing ? "Transcription en cours (1 à 2 min)…" : breaks.length ? `Transcrire les ${breaks.length + 1} prises` : "Transcrire la prise"}
                </button>
              ) : <p className="text-sm text-mut">Envoyez d&apos;abord la prise.</p>}
            </section>
          )}
          </> : null}
          {!simple ? <>
          <TakesCard m={m} onChange={load} />
          <MattesCard m={m} onChange={load} />
          {m.captions.length && m.edit ? (
            <button type="button" className="btn-ghost min-h-[36px] text-xs" onClick={transcribe} disabled={transcribing || animationBusy || frozen || m.status === "transcribing"}>{transcribing ? "Transcription en cours…" : "Transcrire à nouveau"}</button>
          ) : null}
          </> : null}
        </aside>
        <section ref={preview} aria-label="Moniteur du studio" className="studio-monitor rounded-2xl border border-line bg-[#eef0f5] p-3">
          <div className="studio-monitor-frame">
            {showRendered ? <video ref={renderedVideo} src={m.finalVideoUrl!} controls playsInline className="h-full max-w-full rounded-xl bg-black" aria-label={`MP4 rendu de « ${m.title} »`}/> : <>
            <StudioCanvas animation={selectedAnimation} index={selectedAnim} disabled={saving || animationBusy || frozen || Boolean(proposal)} onChange={changeAnimation} player={player} time={playOut}>
            {html ? <ReelPreview ref={player} html={html} title={m.title} onTimeUpdate={onTime} onReady={()=>{if(pendingSeek.current!==null){player.current?.seek(pendingSeek.current);pendingSeek.current=null;}}} autoplay={false} preservePosition /> : <div className="grid aspect-[9/16] place-items-center rounded-2xl border border-dashed border-line p-4 text-center text-sm text-mut">La prise n&apos;est pas encore reçue.</div>}
            </StudioCanvas></>}
          </div>
          <section aria-label="Lecture de l’aperçu" className="studio-transport flex flex-wrap items-center justify-center gap-2">
          <div hidden={simple} className="flex gap-2" role="group" aria-label="Vue du moniteur">
            <button type="button" className="btn-ghost min-h-[44px]" aria-pressed={!showRendered} onClick={()=>setMonitorView("edit")}>Montage en direct</button>
            <button type="button" className="btn-ghost min-h-[44px]" aria-pressed={showRendered} disabled={unsaved||m.renderStatus!=="done"||!m.finalVideoUrl} onClick={()=>setMonitorView("render")}>Voir le rendu MP4</button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Lecture du montage">
            <button type="button" className="btn-ghost min-h-[44px]" onClick={() => {if(showRendered)void renderedVideo.current?.play().catch(()=>setError("Lecture impossible : réessayez dans le lecteur."));else player.current?.play();}}>Lire</button>
            <button type="button" className="btn-ghost min-h-[44px]" onClick={() => {if(showRendered)renderedVideo.current?.pause();else player.current?.pause();}}>Pause</button>
            {!simple ? <button type="button" className="btn-ghost min-h-[44px]" onClick={() => {if(showRendered&&renderedVideo.current){renderedVideo.current.currentTime=0;void renderedVideo.current.play().catch(()=>{});}else player.current?.restart();}}>Rejouer</button> : null}
            <button type="button" className="btn-ghost min-h-[44px]" onClick={() => {if(showRendered&&renderedVideo.current){renderedVideo.current.muted=false;void renderedVideo.current.play().catch(()=>{});}else player.current?.listen();}}>Écouter avec le son</button>
            {!simple ? <button type="button" className="btn-ghost min-h-[44px]" onClick={() => { const node=preview.current;if(document.fullscreenElement)void document.exitFullscreen();else void node?.requestFullscreen().catch(()=>setError("Le plein écran n’est pas disponible dans ce navigateur.")); }}>Plein écran</button> : null}
          </div>
          </section>
          <p hidden={simple} className="text-xs text-mut">{showRendered ? "MP4 rendu de la version enregistrée : regardez et écoutez avant le transfert." : proposal ? "Aperçu de la modification (non enregistrée)." : "Aperçu en direct 1080×1920 : coupes, sous-titres karaoké et animations (brouillon compris)."}</p>
        </section>
        <aside aria-label="Réglages de la sélection" hidden={simple} className="studio-inspector min-w-0 space-y-3">
          {m.edit && !simple ? <section aria-label="Cadrage de la vidéo" className="card p-3">
            <StudioFraming edit={m.edit} disabled={saving||animationBusy||frozen||unsaved} videoUrl={data.videoUrl} onApply={framing=>{void save({...m.edit!,framing});}}/>
          </section>:null}
          <section aria-label="Écran de fin" className="card space-y-2 p-3">
            <h3 className="font-semibold">Logo de fin · +2 secondes</h3>
            <p className="text-xs text-mut">Un écran ajouté après la dernière parole. La vidéo conserve toute sa durée.</p>
            {(proposal?.edit??m.edit)?.outro ? <>
              <button type="button" className="btn-ghost min-h-[44px]" onClick={()=>{setMonitorView("edit");player.current?.seek(segments.reduce((n,s)=>n+s.toMs-s.fromMs,0)/1000);player.current?.play();}}>Tester le logo de fin</button>
              <button type="button" className="btn-ghost min-h-[44px]" disabled={saving||frozen||unsaved} onClick={()=>{if(m.edit)manualPreview({...m.edit,outro:undefined},"outro");}}>Retirer le logo de fin</button>
            </>:<button type="button" className="btn-ghost min-h-[44px]" disabled={saving||animationBusy||frozen||unsaved} onClick={appendOutro}>Ajouter le logo de fin</button>}
          </section>
          <details className="card p-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Logo BeeRecos · bas à droite</summary>
            <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(logo)} disabled={saving||frozen||Boolean(proposal)} onChange={e=>{setMonitorView("edit");setLogo(e.target.checked?{...STUDIO_LOGO_DEFAULT}:undefined);}}/>Afficher mon logo sur la vidéo</label>
            {logo?<div className="space-y-2">{([["width","Largeur du logo",150,360],["right","Marge à droite",40,300],["bottom","Marge en bas",80,600]] as const).map(([key,label,min,max])=><label key={key} className="block text-xs">{label} (px)<input className="mt-1 min-h-[44px] w-full rounded-xl border border-line px-3" type="number" min={min} max={max} value={logo[key]} disabled={saving||frozen||Boolean(proposal)} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n)){setMonitorView("edit");setLogo({...logo,[key]:Math.max(min,Math.min(max,Math.round(n)))});}}}/></label>)}</div>:null}
            <p className="mt-2 text-xs text-mut">Logo officiel de votre charte, conservé à ses proportions. Testez sa position dans l’aperçu puis enregistrez le montage.</p>
          </details>
          {activeScene ? <section aria-label="Séquence sélectionnée" className="card space-y-2 p-3">
            <h3 className="font-semibold">Séquence {activeScene.index+1} · {sec(toOutputMs(segments,activeScene.startMs))} → {sec(toOutputMs(segments,activeScene.endMs))}</h3>
            <p className="text-xs text-mut">{activeScene.text || "Ajoutez vos textes et animations depuis la bibliothèque."}</p>
            <button type="button" className="btn-ghost min-h-[44px]" onClick={()=>{seekSource(activeScene.startMs);player.current?.play();}}>Tester cette séquence</button>
            <button type="button" className="btn-ghost min-h-[44px] text-red-700" disabled={saving||animationBusy||frozen||unsaved} onClick={deleteScene}>Supprimer cette séquence</button>
            <button type="button" className="btn-ghost min-h-[44px]" disabled={saving||animationBusy||frozen||Boolean(proposal)||!m.edit||!matteAt(m.edit,activeScene.startMs)} onClick={()=>{setLibraryTab("animations");setLibraryOpen(true);animations.current?.place("titre-derriere",activeScene);}}>Ajouter un titre ou mot derrière le personnage</button>
            {m.edit&&!matteAt(m.edit,activeScene.startMs)?<div className="space-y-1 text-xs text-mut"><p>Cette prise doit être détourée pour que le personnage passe devant les lettres. Importez sa vidéo transparente .webm ; le détourage automatique n’est pas encore disponible ici.</p><button type="button" className="btn-ghost min-h-[44px]" onClick={()=>{const card=document.getElementById("studio-mattes");card?.scrollIntoView({block:"center"});card?.focus({preventScroll:true});}}>Préparer le détourage</button></div>:null}
            {unsaved&&!proposal?<p className="text-xs text-mut">Enregistrez vos animations avant de supprimer une séquence ou d’ajouter l’écran de fin.</p>:null}
            <ul aria-label={`Animations de la séquence ${activeScene.index+1}`} className="space-y-1">{draft.map((a,i)=>({a,i})).filter(({a})=>a.fromMs>=activeScene.startMs&&a.fromMs<activeScene.endMs).map(({a,i})=><li key={a.id}>
              <button type="button" draggable={!saving&&!frozen} onDragStart={e=>{e.dataTransfer.setData("application/x-beegrowth-motion",a.name);e.dataTransfer.setData("application/x-beegrowth-animation-index",String(i));e.dataTransfer.effectAllowed="move";}} aria-pressed={a.id===selectedId} className="btn-ghost min-h-[44px] w-full truncate text-left text-xs" onClick={()=>{setSelectedId(a.id??null);setPanel("animations");seekSource(a.fromMs);}}>⠿ {a.name} · {Object.values(a.props).map(v=>Array.isArray(v)?v.join(" · "):String(v)).join(" ")}</button>
            </li>)}</ul>
          </section> : null}
          <ReelBrandCharter />
        </aside>
      </div>
      {proposal?.source ? <section aria-label="Modification à enregistrer" className="card space-y-2 border-brand p-3">
        <p role="status" className="text-sm">{proposal.source==="sequence"?"Séquence retirée de l’aperçu. Le fichier source reste intact.":"Modification visible dans l’aperçu, pas encore enregistrée."}</p>
        <button type="button" className="btn-red min-h-[44px]" disabled={saving||frozen} onClick={()=>{void applyProposal(proposal).catch(e=>setError(e instanceof Error?e.message:"Enregistrement impossible."));}}>Enregistrer la modification</button>
        <button type="button" className="btn-ghost min-h-[44px]" disabled={saving} onClick={()=>{setProposal(null);player.current?.seek(0);}}>Annuler la modification</button>
      </section>:null}
      {m.edit && m.durationMs ? (
        <StudioTimeline onDeleteScene={deleteScene} deleteDisabled={unsaved} onOpenSounds={()=>{setLibraryTab("sounds");setLibraryOpen(true);}} onOpenLibrary={()=>{setLibraryTab("animations");setLibraryOpen(true);}} scenes={scenes} selectedScene={activeScene?.index} onSelectScene={selectScene} onDropScene={(name,scene,fromIndex)=>animations.current?.place(name,scene,fromIndex)} durationMs={m.durationMs} ranges={proposal?.edit.ranges ?? m.edit.ranges} captions={m.captions} custom={proposal?.edit.custom ?? draft} sounds={proposal?.edit.sounds ?? m.edit.sounds} outroMs={(proposal?.edit??m.edit).outro ? END_VIDEO.durationMs : undefined} onSeekOutro={()=>{setMonitorView("edit");player.current?.seek(segments.reduce((n,s)=>n+s.toMs-s.fromMs,0)/1000);}} playheadMs={playSource}
          onSeek={seekSource} selected={selectedAnim} onSelectAnimation={(i) => { setSelectedId(draft[i]?.id ?? null); const scene=scenes.find(s=>draft[i].fromMs>=s.startMs&&draft[i].fromMs<s.endMs); if(scene)setSelectedSceneIndex(scene.index); setPanel("animations"); }} takeBreaks={breaks} disabled={saving || animationBusy || frozen || Boolean(proposal)} onChangeAnimation={(_i,a) => changeAnimation(a)} onChangeRanges={proposal ? undefined : (r) => { if (m.edit) void save({ ...m.edit, ranges: r }); }} waveform={wave} waveformNote={waveNote} broll={(proposal?.edit ?? m.edit).broll ?? []} zone={zone} onCutZone={cutZone} onClearZone={() => setZone({ in: null, out: null })} />
      ) : null}
      <p role="status" className="text-xs text-mut">{unsaved ? "Modifications locales non enregistrées : appliquez ou annulez la proposition et enregistrez les animations avant le transfert." : "Montage enregistré sur le serveur."}</p>
    </div>
  );
  return expanded ? createPortal(content,document.body) : content;
}

/** Page Bibliothèque de l'accueil du montage (gestion des médias, hors montage). */
export function LibraryHome() {
  const lib = useLibrary();
  return (
    <section aria-labelledby="bibliotheque" className="card max-w-2xl p-5">
      <h2 id="bibliotheque" className="mb-3 font-display text-lg">Bibliothèque de médias</h2>
      {lib.error ? <p role="alert" className="mb-2 text-sm text-red-700">{lib.error}</p> : null}
      <StudioMedia library={lib.library} onRefresh={lib.refresh} />
    </section>
  );
}

/** Vidéos finales (kit §7) : les MP4 rendus, prêts à vérifier ou déjà envoyés dans « Reels IA ». */
function FinalVideos({ list, onOpen }: { list: MontageSummary[] | null; onOpen: (id: string) => void }) {
  const done = (list ?? []).filter((m) => m.finalVideoUrl);
  return (
    <section aria-labelledby="videos-finales">
      <h2 id="videos-finales" className="mb-3 font-display text-lg">Vidéos finales</h2>
      {list === null ? <p role="status" className="text-sm text-mut">Chargement…</p> : null}
      {list && done.length === 0 ? <p className="text-sm text-mut">Aucun MP4 rendu pour l&apos;instant : validez la planche contact d&apos;un montage puis lancez le rendu.</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {done.map((m) => (
          <li key={m.id} className="card space-y-2 p-3">
            <video src={m.finalVideoUrl ?? undefined} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-xl bg-black" aria-label={`MP4 de « ${m.title} »`} />
            <p className="truncate font-medium">{m.title}</p>
            <p className="text-xs text-mut">{m.keptMs ? sec(m.keptMs) : ""} · {m.sentToReels ? "Envoyé dans Reels IA" : "Prêt à envoyer"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost min-h-[36px] px-3 text-xs" onClick={() => onOpen(m.id)}>Ouvrir le montage</button>
              <a className="btn-ghost inline-flex min-h-[36px] items-center px-3 text-xs" href={m.finalVideoUrl ?? undefined} target="_blank" rel="noreferrer" download>Télécharger</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Instagram BeeRecos : `montageId` ouvre directement l'éditeur (route /reels/[id]) ; `onOpenMontage` remplace la
 * navigation par paramètre `?montage=` ; `compact` masque les sections secondaires (pages de création).
 */
export default function MontageStudio({ source = "reel", montageId, onOpenMontage, onOpenSource, compact = false }: { source?: "reel" | "ai"; montageId?: string; onOpenMontage?: (id: string | null) => void; onOpenSource?: (ref: StudioSourceRef) => void; compact?: boolean }) {
  const [list, setList] = useState<MontageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const open = montageId ?? searchParams.get("montage");
  const assetKind=searchParams.get("studioKind"),assetId=searchParams.get("studioAsset"),assetRevision=Number(searchParams.get("studioRevision"));
  const sourceRef:StudioSourceRef|undefined=assetId&&Number.isInteger(assetRevision)&&assetRevision>0&&(assetKind==="motion"||assetKind==="story")?{assetId,revision:assetRevision,kind:assetKind}:undefined;
  const openSource=(ref:StudioSourceRef)=>onOpenSource ? onOpenSource(ref) : setSearchParams(previous=>{const next=new URLSearchParams(previous);next.delete("montage");next.set("studioAsset",ref.assetId);next.set("studioRevision",String(ref.revision));next.set("studioKind",ref.kind);return next;},{replace:true});
  const setOpen = (id: string | null) => onOpenMontage ? onOpenMontage(id) : setSearchParams((previous) => {
    const next = new URLSearchParams(previous);
    // The resume channel belongs to this source only, never to a new import or another montage.
    if (!id || id !== previous.get("montage")) next.delete("postChannel");
    if (id) next.set("montage", id); else next.delete("montage");
    return next;
  }, { replace: true });
  const refresh = useCallback(() => { montage.list().then((r) => setList(r.montages)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (isMontageConfigured) refresh(); }, [refresh]);

  // A generated MP4 becomes a private take; it then uses the same edit/render/version pipeline.
  const importAi = (file: File, title: string, spec: StorySpec, transfer:StudioSourceTransfer) => importSource(file, title,
    BriefSchema.parse({ sujet: title, angle: spec.hook.text, motCle: spec.cta.keyword }),
    StoryboardSchema.parse({ sequences: SEQUENCES.map((key) => ({ idee: SEQUENCE_LABEL[key], parole: spec.voice.lines[key], titre: "", traitement: "aucun", dureeS: spec.durations[key] })), cta: `${spec.cta.verb} ${spec.cta.keyword}`, baseline: true }), transfer);
  // The motion film is already fully animated: its scenes become the storyboard, texts are not posed a second time.
  const importMotion = (file: File, spec: MotionSpec, transfer:StudioSourceTransfer) => importSource(file, spec.title,
    BriefSchema.parse({ sujet: spec.title, angle: `${MOTION_STYLE_LABEL} · ${spec.objective || PILLAR_LABEL[spec.pillar]}`.slice(0, 300), motCle: spec.cta.keyword }),
    StoryboardSchema.parse({ sequences: motionPlan(spec).map((x, i) => ({ idee: `Scène ${i + 1}`, parole: x.voice, titre: "", traitement: "aucun", dureeS: Math.max(1, Math.round((x.end - x.start) * 10) / 10) })), cta: `Commente ${spec.cta.keyword}`, baseline: true }), transfer);
  const importSource = async (file: File, title: string, brief: ReturnType<typeof BriefSchema.parse>, storyboard: ReturnType<typeof StoryboardSchema.parse>, aiSource:StudioSourceTransfer) => {
    const durationMs = await videoDurationMs(file);
    const created = await montage.create({ title, fileName: file.name, size: file.size, aiSource });
    const response = await fetch(created.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file });
    if (!response.ok) throw new Error("Import interrompu. La source IA reste disponible pour réessayer.");
    await montage.uploaded(created.id, { durationMs, islands: null });
    try {
      await montage.saveBrief(created.id, brief);
      const current = await montage.get(created.id);
      await montage.saveStoryboard(created.id, storyboard, current.montage.updatedAt);
    } catch (e) {
      window.alert(`La source vidéo est enregistrée, mais le script reste à reprendre depuis le brouillon IA : ${e instanceof Error ? e.message : "enregistrement incomplet"}`);
    }
    setOpen(created.id);
  };
  return <div className={open ? "studio-page mx-auto max-w-none px-2 py-2" : "mx-auto max-w-6xl px-4 py-6"}>
    <h1 className={open ? "sr-only" : "font-display text-3xl"}>Montage vidéo</h1>
    <p className={open ? "sr-only" : "mt-1 text-sm text-mut"}>{source === "ai" ? "Source générée par IA" : "Import de vos vidéos personnelles"} · Montage → préparation du post → validation</p>
    <div className={open ? "space-y-4" : "mt-5 space-y-4"}>
      {open ? <Editor key={open} id={open} onBack={() => { setOpen(null); refresh(); }} onOpenSource={openSource} onSwitch={onOpenMontage ? (target) => onOpenMontage(target) : undefined} /> : <>
        {source === "ai" || sourceRef ? <>
          <AiEditor sourceRef={sourceRef} scriptId={searchParams.get("script")} onUseMotion={isMontageConfigured ? importMotion : undefined} onUseStory={isMontageConfigured ? importAi : undefined} />
        </> : isMontageConfigured ? <Uploader onDone={setOpen} /> : <p role="status">Le serveur de montage n’est pas configuré.</p>}
        {isMontageConfigured && !compact ? <>
          <details className="card p-4"><summary className="cursor-pointer font-medium">Reprendre un montage</summary>
            {error ? <p role="alert" className="text-red-700">{error}</p> : null}
            {list === null && !error ? <p role="status">Chargement…</p> : null}
            {list?.length === 0 ? <p className="text-sm text-mut">Aucun montage enregistré.</p> : null}
            <ul className="mt-3 space-y-2">{list?.map((m) => <li key={m.id}>
              <button type="button" className="btn-ghost min-h-[44px] w-full text-left" onClick={() => setOpen(m.id)}>{m.title} · {m.renderStatus === "done" && m.finalVideoUrl ? "MP4 rendu" : m.renderStatus === "rendering" ? "Rendu en cours" : MONTAGE_STATUS_LABELS[m.status]}</button>
            </li>)}</ul>
          </details>
          <details className="card p-4"><summary className="cursor-pointer font-medium">Scripts et prompteur · Les 72 Reels</summary><ReelsCatalogue onOpenMontage={setOpen} uploader={(reelId, done) => <Uploader key={reelId} reelId={reelId} onDone={done} />} /></details>
          <details className="card p-4"><summary className="cursor-pointer font-medium">Bibliothèque de médias</summary><LibraryHome /></details>
          <details className="card p-4"><summary className="cursor-pointer font-medium">Vidéos finales</summary><FinalVideos list={list} onOpen={setOpen} /></details>
          <details className="card p-4"><summary className="cursor-pointer font-medium">Styles et paramètres</summary><StudioSettingsPanel /></details>
        </> : null}
      </>}
    </div>
  </div>;
}

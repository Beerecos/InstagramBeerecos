"use client";
import StudioProjects from "@/components/social/studio/StudioProjects";
import { useStudioProject } from "@/components/social/studio/useStudioProject";
import { sourceFingerprint, sourceTransfer, type StudioSourceRef, type StudioSourceRender, type StudioSourceTransfer } from "@/domain/social/studio-sources";
import { normalizeAiNarration } from "@/domain/social/reel-story/audrey";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { chatStream, isBackendConfigured } from "@/lib/social/api";
import { haptic } from "@/lib/social/haptics";
import { getRender, specFingerprint, startRender, type RenderJob } from "@/lib/social/reel-render-client";
import {
  buildStoryComposition, DEMO_STORY, DURATION_RANGE, parseStorySpec, SEQUENCE_LABEL, SEQUENCES, sequenceStarts, totalDuration,
  type SequenceKey, type StorySpec,
} from "@/domain/social/reel-story";
import MontageStudio from "@/components/social/MontageStudio";
import { MAX_UPLOAD_BYTES } from "@/domain/social/montage/montage";
import PictogramGuide from "@/components/social/PictogramGuide";
import ReelPreview, { type ReelPreviewHandle } from "@/components/social/ReelPreview";

/**
 * REELS (Réseaux sociaux) — template « Recommandation » BeeRecos : on écrit l'histoire, BeeMarketing produit la vidéo.
 * Une seule page : modifier → générer → lire → télécharger. L'aperçu animé et le MP4 utilisent la même composition
 * (src/lib/reel-story) ; le MP4 est rendu par le serveur de BeeMarketing (server/reel-render.ts), voix et son compris.
 * Rien n'est publié d'ici : la publication passe par « À valider » et le calendrier.
 */

const DRAFT_KEY = "bee.reels.story.v1";
const LAST_KEY = "bee.reels.story.last";
const PREVIEW_DELAY_MS = 600;
const FIELD = "mt-1 block min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-fg outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";
const AREA = `${FIELD} resize-y leading-snug`;

type Video = { sourceRender?: StudioSourceRender; fingerprint: string; url: string; downloadUrl: string; file: string; demo?: boolean; probe?: RenderJob["probe"]; size?: number; warnings?: string[] };

/** Première vidéo générée par BeeMarketing avec le contenu de démonstration (fichier versionné dans public/). */
const DEMO_VIDEO: Video = {
  fingerprint: specFingerprint(DEMO_STORY), demo: true,
  url: "/reels/demo/ta-mise-en-relation-a-de-la-valeur.mp4", downloadUrl: "/reels/demo/ta-mise-en-relation-a-de-la-valeur.mp4",
  file: "ta-mise-en-relation-a-de-la-valeur.mp4",
  probe: { width: 1080, height: 1920, fps: "30/1", duration: 20, video: "h264", audio: "aac" },
};

const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* facultatif */ } };

function loadDraft(): StorySpec {
  const parsed = parseStorySpec(read<unknown>(DRAFT_KEY, null));
  return parsed.ok ? parsed.spec : DEMO_STORY;
}

/** Extrait le premier objet JSON d'une réponse du modèle (bloc ```json``` ou accolades). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(body);
}

const AI_PROMPT = (brief: string, current: StorySpec) => `Adapte ce Reel Instagram BeeRecos (template « Recommandation », 9:16, ~20 s) au sujet : ${brief}
Garde EXACTEMENT la structure JSON ci-dessous (mêmes clés, trois étapes) et réponds UNIQUEMENT avec l'objet JSON :
${JSON.stringify({ ...current, assets: undefined })}
Règles : tutoiement, phrases courtes, textes à l'écran en MAJUSCULES sauf compléments, \\n = retour à la ligne, *mot* = mot mis en valeur ;
écrire BeeRecos ainsi ; un seul appel à l'action (Commente + mot-clé) ; aucun chiffre, montant, témoignage ni résultat inventé ;
toute rémunération évoquée est suivie de « selon les accords prévus » ; durées dans les mêmes bornes.`;

const fmt = (s: number) => s.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ReelsStudio() {
  return <MontageStudio source="ai" />;
}

export function AiVideoSource({ onUseVideo, sourceRef }: { sourceRef?: StudioSourceRef; onUseVideo?: (file: File, title: string, spec: StorySpec, transfer: StudioSourceTransfer) => Promise<void> }) {
  const [importing, setImporting] = useState(false);
  const importLock = useRef(false);
  const renderLock = useRef(false);
  const [starting, setStarting] = useState(false);
  const [spec, setSpec] = useState<StorySpec>(loadDraft);
  const [previewSpec, setPreviewSpec] = useState<StorySpec>(spec);
  const [last, setLast] = useState<Video | null>(() => read<Video | null>(LAST_KEY, null));
  const [job, setJob] = useState<RenderJob | null>(() => read<RenderJob | null>("bee.reels.story.job.v1", null));
  const [jobError, setJobError] = useState<string | null>(null);
  const [view, setView] = useState<"video" | "apercu">("video");
  const [unplayable, setUnplayable] = useState(false);
  const [brief, setBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const preview = useRef<ReelPreviewHandle>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  /** Empreinte du texte envoyé au rendu : le MP4 reçu correspond à CETTE version, même si l'on modifie entre-temps. */
  const renderedFp = useRef<string>(read<string>("bee.reels.story.job.fingerprint.v1", ""));

  useEffect(() => { write("bee.reels.story.job.v1", job); }, [job]);

  useEffect(() => { const t = setTimeout(() => setPreviewSpec(spec), PREVIEW_DELAY_MS); return () => clearTimeout(t); }, [spec]);

  const check = useMemo(() => parseStorySpec(spec), [spec]);
  const fingerprint = useMemo(() => specFingerprint(spec), [spec]);
  const video = [last, DEMO_VIDEO].find((v) => v && v.fingerprint === fingerprint) ?? null;
  const running = job?.state === "queued" || job?.state === "running";
  const starts = sequenceStarts(spec);
  const total = totalDuration(spec);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewHtml = useMemo(() => {
    try { return buildStoryComposition(previewSpec, { assetBase: `${origin}/hyperframes`, preview: true }); } catch { return null; }
  }, [previewSpec, origin]);
  const showVideo = video && view === "video";

  const renderedSource = useRef<StudioSourceRender | null>(null);
  const project = useStudioProject("story", spec, next => {
    update(next); setLast(null); setJob(null); setJobError(null); renderedSource.current = null;
  }, sourceRef);
  let transfer: StudioSourceTransfer | null = null;
  try { transfer = sourceTransfer(video?.sourceRender, sourceFingerprint("story", spec)); } catch { /* incomplete draft */ }

  const update = (next: StorySpec) => { setSpec(next); write(DRAFT_KEY, next); };
  const patch = <K extends keyof StorySpec>(key: K, value: Partial<StorySpec[K]>) => update({ ...spec, [key]: { ...(spec[key] as object), ...value } });
  const setVoice = (k: SequenceKey, line: string) => update({ ...spec, voice: { ...spec.voice, lines: { ...spec.voice.lines, [k]: line } } });
  const setDuration = (k: SequenceKey, d: number) => {
    const [min, max] = DURATION_RANGE[k];
    update({ ...spec, durations: { ...spec.durations, [k]: Math.min(max, Math.max(min, Math.round(d * 10) / 10)) } });
  };
  const control = (action: "play" | "pause" | "restart") => {
    const v = showVideo ? videoEl.current : null;
    if (v) {
      if (action === "pause") v.pause();
      else { if (action === "restart") v.currentTime = 0; void v.play().catch(() => {}); }
    } else preview.current?.[action]();
  };
  const seek = (k: SequenceKey) => {
    if (showVideo && videoEl.current) { videoEl.current.currentTime = starts[k]; void videoEl.current.play().catch(() => {}); }
    else preview.current?.seek(starts[k]);
  };

  // Suivi de la génération : l'état affiché est celui que renvoie le serveur de rendu.
  useEffect(() => {
    if (!job || !running) return;
    const t = setTimeout(async () => {
      try {
        const next = await getRender(job.id, undefined, job);
        setJob(next);
        if (next.state === "done" && next.url) {
          const v: Video = { sourceRender: renderedSource.current ? { ...renderedSource.current, jobId: next.serverJobId, renderId: next.renderId } : undefined, fingerprint: renderedFp.current, url: next.url, downloadUrl: next.downloadUrl ?? next.url, file: next.file ?? "reel.mp4", probe: next.probe, size: next.size, warnings: next.warnings };
          setLast(v); write(LAST_KEY, v); setView("video");
          if (specFingerprint(spec) === renderedFp.current) update({ ...spec, assets: { voice: next.voice } });
          haptic("success");
        }
        if (next.state === "error") setJobError(next.error ?? "Le rendu a échoué.");
      } catch (e) { setJobError((e as Error).message); setJob({ ...job }); }
    }, 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- on relance le suivi à chaque nouvel état reçu
  }, [job]);

  async function generate() {
    if (!check.ok || running || renderLock.current) return;
    renderLock.current = true; setStarting(true);
    setJobError(null); haptic();
    try {
      renderedFp.current = specFingerprint(spec);
      write("bee.reels.story.job.fingerprint.v1", renderedFp.current);
      const normalized = normalizeAiNarration(check.spec);
      update(normalized);
      renderedFp.current = specFingerprint(normalized); write("bee.reels.story.job.fingerprint.v1", renderedFp.current);
      const savedSource = await project.save(normalized);
      renderedSource.current = { source: savedSource, fingerprint: sourceFingerprint("story", normalized) };
      const { id } = await startRender(normalized);
      setJob({ id, state: "queued", step: "En attente", progress: 0, voice: {}, warnings: [] });
    } catch (e) { setJobError((e as Error).message); }
    finally { renderLock.current = false; setStarting(false); }
  }

  async function propose() {
    if (!brief.trim()) { setNotice({ tone: "warn", text: "Décris le sujet du Reel en une phrase." }); return; }
    setAiBusy(true); setNotice(null); haptic();
    try {
      const text = await chatStream("content", [{ role: "user", content: AI_PROMPT(brief.trim(), spec) }], "Contenu", () => {});
      const parsed = parseStorySpec(extractJson(text));
      if (!parsed.ok) { setNotice({ tone: "warn", text: `Proposition du Contenu incomplète : ${parsed.errors.join(" ")}` }); return; }
      update({ ...parsed.spec, assets: undefined });
      setNotice({ tone: "ok", text: "Proposition du Contenu chargée. Relis chaque séquence avant de générer la vidéo." });
    } catch {
      setNotice({ tone: "warn", text: "La proposition n'a pas pu être lue. Réessaie ou modifie les textes à la main." });
    } finally { setAiBusy(false); }
  }

  return (
    <div className="space-y-4">
      <StudioProjects kind="story" revision={project.asset?.revision} dirty={project.dirty} busy={project.busy} disabled={running || starting || importing} error={project.error} onSave={() => project.save()} onSaveCopy={project.saveCopy} onOpen={project.open} />
      <p className="text-sm text-mut">Source IA · textes et animations enregistrables dans tes projets privés. Générez le MP4, puis retrouvez les coupes, sous-titres et animations dans le montage commun.</p>
      {video && !transfer ? <p className="text-sm text-amber-800">Ce MP4 ne possède pas de source et de preuve Audrey vérifiables pour le transfert. Il reste une vidéo aplatie ; génère cette source en ligne pour l’envoyer au montage.</p> : null}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Vidéo : en tête sur mobile, colonne fixe sur grand écran. */}
        <aside aria-label="Vidéo" className="order-first space-y-3 lg:order-last lg:sticky lg:top-4 lg:self-start lg:pb-20">
          <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
            {showVideo ? (
              <video ref={videoEl} key={video.url} src={video.url} controls playsInline preload="metadata" data-testid="reel-video"
                onError={() => setUnplayable(true)} onLoadedMetadata={() => setUnplayable(false)}
                className="aspect-[9/16] w-full rounded-2xl bg-black shadow-[0_8px_30px_rgba(40,81,255,0.18)]" aria-label={`Vidéo « ${spec.title} »`} />
            ) : previewHtml ? <ReelPreview ref={preview} html={previewHtml} title={spec.title} /> : (
              <div className="grid aspect-[9/16] place-items-center rounded-2xl border border-dashed border-line p-4 text-center text-sm text-mut">
                Corrige les points signalés pour voir l'aperçu.
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Lecture">
            {([["play", "Lire"], ["pause", "Pause"], ["restart", "Rejouer"]] as const).map(([a, l]) => (
              <button key={a} type="button" className="btn-ghost min-h-[40px] text-xs" onClick={() => control(a)}>{l}</button>
            ))}
          </div>
          {video ? (
            <div className="flex rounded-full bg-black/[0.05] p-1 text-xs font-medium" role="group" aria-label="Affichage">
              {(["video", "apercu"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                  className={`min-h-[36px] flex-1 rounded-full transition ${view === v ? "bg-white text-fg shadow-sm" : "text-mut hover:text-fg"}`}>
                  {v === "video" ? "Vidéo MP4" : "Aperçu animé"}
                </button>
              ))}
            </div>
          ) : null}

          <button type="button" className="btn-red min-h-[48px] w-full" onClick={generate} disabled={!check.ok || running || starting} aria-busy={running || starting}>
            {running || starting ? "Génération en cours…" : video ? "Générer à nouveau" : "Générer la vidéo"}
          </button>
          {video ? (
            <a className="btn-ghost flex min-h-[44px] w-full items-center justify-center" href={video.downloadUrl} download={video.file}>Télécharger le MP4</a>
          ) : null}

          <div role="status" aria-live="polite" className="space-y-2 text-xs leading-relaxed text-mut">
            {running && job ? (
              <div>
                <p className="font-medium text-fg">{job.step} · {job.progress} %</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${job.progress}%` }} /></div>
              </div>
            ) : null}
            {showVideo && unplayable ? <p className="text-amber-800">Ce navigateur ne lit pas cette vidéo (H.264 + AAC). Télécharge le MP4 ou ouvre BeeMarketing dans Chrome, Safari ou Edge.</p> : null}
            {jobError ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{jobError}</p> : null}
            {video ? (
              <p>
                {video.demo ? "Vidéo de démonstration générée par BeeMarketing. " : "Vidéo générée pour cette version du texte. "}
                {video.probe ? `${video.probe.width}×${video.probe.height} · ${video.probe.fps.replace("/1", "")} i/s · ${fmt(video.probe.duration)} s · ${video.probe.video.toUpperCase()}${video.probe.audio ? ` + ${video.probe.audio.toUpperCase()}` : " · sans son"}` : null}
              </p>
            ) : !running ? <p>Aperçu animé (muet) du texte actuel. Génère la vidéo pour obtenir le MP4 avec voix off et musique.</p> : null}
            {(video?.warnings ?? []).map((w) => <p key={w} className="text-amber-800">{w}</p>)}
            <p>1080×1920 · {fmt(total)} s · validation de Cédric avant toute publication.</p>
          </div>
        </aside>

        <section aria-label="Histoire du Reel" className="min-w-0 space-y-4">
          <Text label="Titre du contenu" value={spec.title} onChange={(title) => update({ ...spec, title })} />
          <PictogramGuide mode={spec.motion} onModeChange={(m) => update({ ...spec, motion: m })} />
          <div className="card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="text-xs font-medium text-mut">Sujet à proposer au Contenu (facultatif)
              <input className={FIELD} placeholder="Ex. : pourquoi visiter un club avant d'adhérer" value={brief} disabled={!isBackendConfigured || aiBusy}
                onChange={(e) => setBrief(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void propose(); }} />
            </label>
            <button type="button" className="btn-ghost min-h-[44px] self-end" onClick={propose} disabled={!isBackendConfigured || aiBusy} aria-busy={aiBusy}>
              {aiBusy ? "Le Contenu rédige…" : "Proposer les textes"}
            </button>
            {!isBackendConfigured ? <p className="text-xs text-mut sm:col-span-2">Mode démo : proposition IA indisponible, les textes restent modifiables à la main.</p> : null}
          </div>
          {notice ? <p role="status" className={`rounded-xl px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{notice.text}</p> : null}

          {/* Frise : largeur = durée ; un clic place la lecture au début de la séquence. */}
          <ol className="flex h-11 gap-1 overflow-hidden rounded-xl" aria-label="Déroulé">
            {SEQUENCES.map((k, i) => (
              <li key={k} style={{ flexGrow: spec.durations[k] }} className="min-w-[24px] flex-shrink">
                <button type="button" onClick={() => seek(k)} aria-label={`Lire depuis ${SEQUENCE_LABEL[k]} (${fmt(starts[k])} s)`}
                  className={`h-full w-full truncate px-1 text-[11px] font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${k === "rupture" ? "bg-black" : i % 2 ? "bg-brand" : "bg-brand/70"}`}>
                  {SEQUENCE_LABEL[k]}
                </button>
              </li>
            ))}
          </ol>
          <p className="text-xs text-mut">Retour à la ligne = nouvelle ligne à l'écran · <code>*mot*</code> = mot mis en valeur · le nom s'écrit toujours BeeRecos.</p>

          {!check.ok ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">À corriger avant de générer</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          ) : null}

          <ol className="space-y-3">
            {SEQUENCES.map((k, i) => (
              <li key={k} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${k === "rupture" ? "bg-black" : "bg-brand"}`}>{i + 1}</span>
                  <h2 className="text-sm font-semibold">{SEQUENCE_LABEL[k]}</h2>
                  <button type="button" className="text-xs text-brand underline-offset-2 hover:underline" onClick={() => seek(k)}>
                    {fmt(starts[k])} – {fmt(starts[k] + spec.durations[k])} s
                  </button>
                  <Stepper label={SEQUENCE_LABEL[k]} value={spec.durations[k]} range={DURATION_RANGE[k]} onChange={(d) => setDuration(k, d)} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {k === "hook" ? <>
                    <Text label="Accroche (à l'écran)" value={spec.hook.text} onChange={(v) => patch("hook", { text: v })} multiline />
                    <Text label="Complément" value={spec.hook.complement} onChange={(v) => patch("hook", { complement: v })} />
                  </> : null}
                  {k === "consequence" ? <>
                    <Text label="Message" value={spec.consequence.text} onChange={(v) => patch("consequence", { text: v })} multiline />
                    <Text label="Nouveau statut de la carte" value={spec.consequence.status} onChange={(v) => patch("consequence", { status: v })} />
                  </> : null}
                  {k === "rupture" ? <Text label="Question" value={spec.rupture.text} onChange={(v) => patch("rupture", { text: v })} multiline /> : null}
                  {k === "value" ? <Text label="Message" value={spec.value.text} onChange={(v) => patch("value", { text: v })} multiline /> : null}
                  {k === "steps" ? <>
                    {spec.steps.items.map((s, j) => (
                      <div key={j} className="grid gap-2 sm:col-span-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                        <Text label={`Étape ${j + 1}`} value={s.title} onChange={(v) => patch("steps", { items: spec.steps.items.map((x, n) => (n === j ? { ...x, title: v } : x)) as StorySpec["steps"]["items"] })} />
                        <Text label="Complément" value={s.complement} onChange={(v) => patch("steps", { items: spec.steps.items.map((x, n) => (n === j ? { ...x, complement: v } : x)) as StorySpec["steps"]["items"] })} />
                      </div>
                    ))}
                    <Text label="Mention (renvoi *)" value={spec.steps.footnote} onChange={(v) => patch("steps", { footnote: v })} />
                  </> : null}
                  {k === "signature" ? <Text label="Signature sous le logo" value={spec.signature.tagline} onChange={(v) => patch("signature", { tagline: v })} /> : null}
                  {k === "cta" ? <>
                    <Text label="Verbe" value={spec.cta.verb} onChange={(v) => patch("cta", { verb: v })} />
                    <Text label="Mot-clé à commenter" value={spec.cta.keyword} onChange={(v) => patch("cta", { keyword: v.toUpperCase().replace(/\s/g, "") })} />
                    <Text label="Complément" value={spec.cta.complement} onChange={(v) => patch("cta", { complement: v })} />
                  </> : null}
                  <Text label="Voix off" value={spec.voice.lines[k]} onChange={(v) => setVoice(k, v)} hint="Audrey obligatoire dans le Reel ; une séquence peut garder une respiration sans parole." />
                </div>
                {k === "hook" ? (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-brand">La carte et les repères</summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <Text label="Carte" value={spec.card.label} onChange={(v) => patch("card", { label: v })} />
                      <Text label="Statut de départ" value={spec.card.status} onChange={(v) => patch("card", { status: v })} />
                      <Text label="Apporteur" value={spec.card.from} onChange={(v) => patch("card", { from: v })} />
                      <Text label="Contact" value={spec.card.contact} onChange={(v) => patch("card", { contact: v })} />
                      <Text label="Professionnel" value={spec.card.to} onChange={(v) => patch("card", { to: v })} />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
          <button type="button" className="btn-ghost min-h-[44px]" onClick={() => { update(DEMO_STORY); setNotice({ tone: "ok", text: "Contenu de démonstration rétabli." }); }}>
            Revenir au contenu de démonstration
          </button>
        </section>
      </div>
      <footer className="card space-y-2 p-4">
        <button type="button" className="btn-red min-h-[44px] w-full" disabled={!onUseVideo || !video || !transfer || video.demo || running || starting || importing} aria-busy={importing}
          onClick={async () => {
            if (!onUseVideo || !video || !transfer || video.demo || importLock.current) return;
            importLock.current = true; setImporting(true); setJobError(null);
            try {
              const response = await fetch(video.downloadUrl);
              if (!response.ok) throw new Error("Le MP4 est indisponible. Relancez le rendu.");
              const blob = await response.blob();
              if (!blob.size || blob.size > MAX_UPLOAD_BYTES || !blob.type.startsWith("video/")) throw new Error("Le rendu reçu n’est pas un fichier vidéo valide de moins de 500 Mo.");
              await onUseVideo(new File([blob], "source-ia.mp4", { type: "video/mp4" }), spec.title, spec, transfer);
            } catch (e) { setJobError(e instanceof Error ? e.message : "Import du rendu impossible."); }
            finally { importLock.current = false; setImporting(false); }
          }}>{importing ? "Enregistrement de la source…" : "Utiliser cette source dans le montage"}</button>
        <p className="text-xs text-mut">{!onUseVideo ? "Le serveur de montage doit être configuré pour enregistrer la source." : "Seul un MP4 généré pour le texte actuel peut être enregistré. La démonstration n’est pas un rendu de votre contenu."}</p>
      </footer>
    </div>
  );
}

function Text({ label, value, onChange, multiline, hint }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string }) {
  return (
    <label className="text-xs font-medium text-mut">{label}
      {multiline
        ? <textarea rows={2} className={AREA} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className={FIELD} value={value} onChange={(e) => onChange(e.target.value)} />}
      {hint ? <span className="mt-1 block font-normal">{hint}</span> : null}
    </label>
  );
}

function Stepper({ label, value, range, onChange }: { label: string; value: number; range: [number, number]; onChange: (v: number) => void }): ReactNode {
  const btn = "inline-grid h-10 w-10 place-items-center rounded-full text-lg text-mut transition hover:bg-black/[0.05] hover:text-fg disabled:opacity-30";
  return (
    <div className="ml-auto flex items-center rounded-full border border-line" role="group" aria-label={`Durée de ${label}`}>
      <button type="button" className={btn} onClick={() => onChange(value - 0.5)} disabled={value <= range[0]} aria-label={`Raccourcir ${label}`}>−</button>
      <span className="w-12 text-center text-sm tabular-nums text-fg">{fmt(value)} s</span>
      <button type="button" className={btn} onClick={() => onChange(value + 0.5)} disabled={value >= range[1]} aria-label={`Allonger ${label}`}>+</button>
    </div>
  );
}

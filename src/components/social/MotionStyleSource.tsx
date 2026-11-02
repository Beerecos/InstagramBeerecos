"use client";
import StudioProjects from "@/components/social/studio/StudioProjects";
import { useStudioProject } from "@/components/social/studio/useStudioProject";
import { sourceFingerprint, sourceTransfer, type StudioSourceRef, type StudioSourceRender, type StudioSourceTransfer } from "@/domain/social/studio-sources";
import { useEffect, useMemo, useRef, useState } from "react";
import { chatStream, isBackendConfigured } from "@/lib/social/api";
import { haptic } from "@/lib/social/haptics";
import { getRender, startRender, type RenderJob } from "@/lib/social/reel-render-client";
import { MAX_UPLOAD_BYTES } from "@/domain/social/montage/montage";
import {
  buildMotionComposition, DEFAULT_VOICE_SPEED, DEMO_MOTION, estimateMotionSeconds, MOTION_STYLE_LABEL, MOTION_VISUALS, normalizeAiNarration, motionFingerprint,
  parseMotionSpec, PILLAR_LABEL, PRESENCE_LABEL, RHYTHM_LABEL, sceneDurations, sceneStarts, TEXT_LABEL, VISUAL_LABEL,
  type MotionScene, type MotionSettings, type MotionSpec, type StoryPillar,
} from "@/domain/social/reel-story";
import ReelBrandCharter from "@/components/social/ReelBrandCharter";
import MotionAnimationLibrary, { MOTION_CARD_TYPE } from "@/components/social/MotionAnimationLibrary";
import { parseMotionProposal } from "@/domain/social/reel-story/motion-proposal";
import type { MotionVisual } from "@/domain/social/reel-story/motion-spec";
import ReelPreview, { type ReelPreviewHandle } from "@/components/social/ReelPreview";
import { reelNarrativeEngine } from "@/lib/social/feature-flags";
import { MOTION_NARRATIVE_ROLES, MOTION_ROLE_LABEL, type MotionNarrativeRole } from "@/domain/social/reel-story";

/**
 * Vidéo IA · style « Motion BeeRecos - Dynamique » (film de présentation du 2026-10-23 rendu réutilisable).
 * Une seule page, comme le prompt du Studio IA le demande : sujet, objectif, pilier, durée, voix, scènes (voix + texte
 * à l'écran + mot pivot + visuel), appel à l'action, puis trois réglages — rythme, quantité de texte, présence humaine —
 * avec l'aperçu animé à côté. Le MP4 (voix, musique originale, -14 LUFS), la version sans musique et les sous-titres SRT
 * sont produits par le serveur de rendu ; la vidéo entre ensuite dans le montage commun puis « Préparer le post ».
 * Rien n'est publié d'ici.
 */

const DRAFT_KEY = "bee.motion.spec.v1";
const LAST_KEY = "bee.motion.last.v1";
const JOB_KEY = "bee.motion.job.v1";
const FIELD = "mt-1 block min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-fg outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";
const fmt = (s: number) => s.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Video = { sourceRender?: StudioSourceRender; fingerprint: string; url: string; downloadUrl: string; file: string; probe?: RenderJob["probe"]; warnings?: string[]; noMusicUrl?: string; srtUrl?: string };

const read = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* facultatif */ } };

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

const AI_PROMPT = (brief: string, current: MotionSpec) => `Tu es le Scénariste vidéo de BeeRecos. Écris une vidéo Instagram 9:16 au style « ${MOTION_STYLE_LABEL} » sur le sujet : ${brief}
Réponds UNIQUEMENT avec un objet JSON de même structure que celui-ci (mêmes clés) :
${JSON.stringify({ ...current, assets: undefined })}
Règles : tutoiement, phrases courtes (≈ 155 mots/min), une idée par scène ; "title" = 3 à 7 mots à l'écran, jamais la phrase de la voix recopiée ;
"pivot" = le mot que la voix appuie (présent dans le titre ou la voix) ; GARDE exactement le nombre, l'ordre et les "id" des scènes, et le "visual" choisi sur chacune : ${JSON.stringify(current.scenes.map(({ id, visual }) => ({ id, visual })))}. N'ajoute ni ne remplace aucune carte ; 2 ou 3 "items" pour liste, chapitre, piliers, relation ;
avant-dernière scène "cta" dont la voix dit « Commente ${current.cta.keyword} » ; dernière scène "signature" avec la voix « BeeRecos. Mon réseau, c'est ton réseau. » ;
écrire BeeRecos ainsi ; aucun chiffre, montant, pourcentage, rémunération, témoignage, ville ou résultat inventé ; durée totale entre 30 et 55 s ; garde "settings" et "voice".${reelNarrativeEngine ? `
Adapte les rôles narratifs à ces scènes existantes sans en changer le nombre ni les animations (signature sans rôle) : HOOK (problème, curiosité ou provocation, 12 mots au plus) →
LEAD (pourquoi regarder la suite, sans donner la réponse) → BODY_1 (une idée simple et concrète) → OPEN_LOOP_1 (nouvelle attente, ex. « Mais ce n'est pas encore le plus important. ») →
BODY_2 (plus de valeur) → OPEN_LOOP_2 (dernière relance) → BODY_3 (payoff : la meilleure information) → CTA (visual "cta", un seul appel à l'action) → signature.
Piliers officiels : Réseau d'apporteurs d'affaires ; École de formation ; Digitalisation IA. Baseline #MonReseauCestTonReseau. Durée totale entre 35 et 60 s.` : ""}`;

function loadDraft(): MotionSpec {
  const raw = read<unknown>(DRAFT_KEY, null);
  return raw ? parseMotionSpec(raw).spec : DEMO_MOTION;
}

export default function MotionStyleSource({ onUseVideo, sourceRef }: { sourceRef?: StudioSourceRef; onUseVideo?: (file: File, spec: MotionSpec, transfer: StudioSourceTransfer) => Promise<void> }) {
  const [spec, setSpec] = useState<MotionSpec>(loadDraft);
  const [previewSpec, setPreviewSpec] = useState(spec);
  const [last, setLast] = useState<Video | null>(() => read<Video | null>(LAST_KEY, null));
  const [job, setJob] = useState<RenderJob | null>(() => read<RenderJob | null>(JOB_KEY, null));
  const [jobError, setJobError] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [proposal, setProposal] = useState<MotionSpec | null>(null);
  const [selectedCard, setSelectedCard] = useState<MotionVisual | null>(null);
  const currentSpec = useRef(spec);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [starting, setStarting] = useState(false);
  const lock = useRef(false);
  const preview = useRef<ReelPreviewHandle>(null);
  const renderedFp = useRef<string>(read<string>(`${JOB_KEY}.fp`, ""));

  useEffect(() => { write(JOB_KEY, job); }, [job]);
  useEffect(() => { const t = setTimeout(() => setPreviewSpec(spec), 500); return () => clearTimeout(t); }, [spec]);

  const check = useMemo(() => parseMotionSpec(spec), [spec]);
  const fingerprint = useMemo(() => motionFingerprint(spec), [spec]);
  const video = last && last.fingerprint === fingerprint ? last : null;
  const running = job?.state === "queued" || job?.state === "running";
  const durs = sceneDurations(spec), starts = sceneStarts(spec), total = estimateMotionSeconds(spec);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewHtml = useMemo(() => {
    try { return buildMotionComposition(previewSpec, { assetBase: `${origin}/hyperframes`, preview: true }); } catch { return null; }
  }, [previewSpec, origin]);

  const renderedSource = useRef<StudioSourceRender | null>(null);
  const project = useStudioProject("motion", spec, next => {
    update(next); setLast(null); setJob(null); setJobError(null); renderedSource.current = null;
  }, sourceRef);
  let transfer: StudioSourceTransfer | null = null;
  try { transfer = sourceTransfer(video?.sourceRender, sourceFingerprint("motion", spec)); } catch { /* incomplete draft */ }

  const update = (next: MotionSpec) => { currentSpec.current = next; setSpec(next); setProposal(null); write(DRAFT_KEY, next); };
  const setVoiceSpeed = (speed: number) => update({ ...spec, voice: { ...spec.voice, speed }, assets: undefined });
  const setSetting = <K extends keyof MotionSettings>(k: K, v: MotionSettings[K]) => update({ ...spec, settings: { ...spec.settings, [k]: v } });
  const setScene = (i: number, patch: Partial<MotionScene>) => update({ ...spec, scenes: spec.scenes.map((s, n) => (n === i ? { ...s, ...patch } : s)) });
  const assignCard = (i: number, value: string) => {
    if (!(MOTION_VISUALS as readonly string[]).includes(value)) return;
    const visual = value as MotionVisual;
    const required = i === spec.scenes.length - 1 ? "signature" : i === spec.scenes.length - 2 ? "cta" : null;
    if ((required && visual !== required) || (!required && (visual === "cta" || visual === "signature"))) {
      setNotice({ tone: "warn", text: "Garde l’appel à l’action sur l’avant-dernière scène et la signature à la fin." }); return;
    }
    setScene(i, { visual });
    setNotice({ tone: "ok", text: `${VISUAL_LABEL[visual]} choisi pour la scène ${i + 1}. Ajuste ses textes, puis teste l’aperçu.` });
  };
  const moveScene = (i: number, d: -1 | 1) => { const a = [...spec.scenes]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; update({ ...spec, scenes: a }); };
  const removeScene = (i: number) => update({ ...spec, scenes: spec.scenes.filter((_, n) => n !== i) });
  const addScene = () => {
    const id = `s${Date.now().toString(36).slice(-5)}`;
    const at = Math.max(0, spec.scenes.length - 2);
    const a = [...spec.scenes];
    a.splice(at, 0, { id, visual: "titre", voice: "", title: "" });
    update({ ...spec, scenes: a });
  };

  // Suivi du rendu : l'état affiché est celui du serveur.
  useEffect(() => {
    if (!job || !running) return;
    const t = setTimeout(async () => {
      try {
        const next = await getRender(job.id);
        setJob(next);
        if (next.state === "done" && next.url) {
          const v: Video = { sourceRender: renderedSource.current ? { ...renderedSource.current, jobId: next.serverJobId, renderId: next.renderId } : undefined, fingerprint: renderedFp.current, url: next.url, downloadUrl: next.downloadUrl ?? next.url, file: next.file ?? "video.mp4", probe: next.probe, warnings: next.warnings, noMusicUrl: next.extras?.noMusicUrl, srtUrl: next.extras?.srtUrl };
          setLast(v); write(LAST_KEY, v);
          if (motionFingerprint(spec) === renderedFp.current && next.motionVoice) update({ ...spec, assets: { voice: next.motionVoice } });
          haptic("success");
        }
        if (next.state === "error") setJobError(next.error ?? "Le rendu a échoué.");
      } catch (e) { setJobError((e as Error).message); setJob({ ...job }); }
    }, 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- suivi relancé à chaque nouvel état reçu
  }, [job]);

  async function generate() {
    if (!check.ok || running || lock.current) return;
    lock.current = true; setStarting(true); setJobError(null); haptic();
    try {
      renderedFp.current = fingerprint; write(`${JOB_KEY}.fp`, fingerprint);
      const normalized = normalizeAiNarration(check.spec);
      update(normalized);
      renderedFp.current = motionFingerprint(normalized); write(`${JOB_KEY}.fp`, renderedFp.current);
      const savedSource = await project.save(normalized);
      renderedSource.current = { source: savedSource, fingerprint: sourceFingerprint("motion", normalized) };
      const { id } = await startRender(normalized);
      setJob({ id, state: "queued", step: "En attente", progress: 0, voice: {}, warnings: [] });
    } catch (e) { setJobError((e as Error).message); }
    finally { lock.current = false; setStarting(false); }
  }

  async function propose() {
    if (!brief.trim()) { setNotice({ tone: "warn", text: "Décris le sujet de la vidéo en une phrase." }); return; }
    if (aiBusy) return;
    const basis = motionFingerprint(spec);
    setAiBusy(true); setNotice(null); setProposal(null); haptic();
    try {
      const text = await chatStream("content", [{ role: "user", content: AI_PROMPT(brief.trim(), spec) }], "Contenu", () => {});
      if (motionFingerprint(currentSpec.current) !== basis) throw new Error("Tes scènes ont changé pendant la proposition. Relance l’IA sur cette nouvelle version.");
      const next = parseMotionProposal(extractJson(text), spec);
      setProposal(next);
      setNotice({ tone: "ok", text: "Proposition prête : relis les textes avant de l’appliquer à tes cartes." });
    } catch (error) { setNotice({ tone: "warn", text: error instanceof Error ? error.message : "La proposition n’a pas pu être lue. Réessaie ou écris les scènes à la main." }); }
    finally { setAiBusy(false); }
  }

  async function useInMontage() {
    if (!onUseVideo || !video || !transfer || lock.current) return;
    lock.current = true; setImporting(true); setJobError(null);
    try {
      const response = await fetch(video.downloadUrl);
      if (!response.ok) throw new Error("Le MP4 est indisponible. Relancez le rendu.");
      const blob = await response.blob();
      if (!blob.size || blob.size > MAX_UPLOAD_BYTES || !blob.type.startsWith("video/")) throw new Error("Le rendu reçu n'est pas un fichier vidéo valide de moins de 500 Mo.");
      await onUseVideo(new File([blob], "source-ia-motion.mp4", { type: "video/mp4" }), spec, transfer);
    } catch (e) { setJobError(e instanceof Error ? e.message : "Import du rendu impossible."); }
    finally { lock.current = false; setImporting(false); }
  }

  return (
    <div className="space-y-4">
      <StudioProjects kind="motion" revision={project.asset?.revision} dirty={project.dirty} busy={project.busy} disabled={running || starting || importing} error={project.error} onSave={() => project.save()} onSaveCopy={project.saveCopy} onOpen={project.open} />
      <p className="text-sm text-mut">Style « {MOTION_STYLE_LABEL} » · vidéo graphique en scènes, mascotte BeeRecos, sous-titres en bas au centre. Textes et animations enregistrables dans tes projets privés.</p>
      {video && !transfer ? <p className="text-sm text-amber-800">Ce MP4 ne possède pas de source et de preuve Audrey vérifiables pour le transfert. Il reste une vidéo aplatie ; génère cette source en ligne pour l’envoyer au montage.</p> : null}
      <ReelBrandCharter />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside aria-label="Aperçu" className="order-first space-y-3 lg:order-last lg:sticky lg:top-4 lg:self-start lg:pb-20">
          <div className="mx-auto w-full max-w-[280px] lg:max-w-none">
            {video ? <video key={video.url} src={video.url} controls playsInline preload="metadata" className="aspect-[9/16] w-full rounded-2xl bg-black" aria-label={`Vidéo « ${spec.title} »`} />
              : previewHtml ? <ReelPreview ref={preview} html={previewHtml} title={spec.title} />
              : <div className="grid aspect-[9/16] place-items-center rounded-2xl border border-dashed border-line p-4 text-center text-sm text-mut">Corrige les points signalés pour voir l'aperçu.</div>}
          </div>
          <fieldset className="card space-y-3 p-4">
            <legend className="px-1 text-sm font-semibold">Réglages du style</legend>
            <Segmented label="Rythme" value={spec.settings.rythme} options={RHYTHM_LABEL} onChange={(v) => setSetting("rythme", v)} />
            <Segmented label="Quantité de texte" value={spec.settings.texte} options={TEXT_LABEL} onChange={(v) => setSetting("texte", v)} />
            <Segmented label="Présence humaine" value={spec.settings.presence} options={PRESENCE_LABEL} onChange={(v) => setSetting("presence", v)} disabled={["intervenant"]}
              hint="Intervenant filmé : passe par « Vidéo Reel » (le style s'applique à ta vidéo tournée)." />
          </fieldset>
          <button type="button" className="btn-red min-h-[48px] w-full" onClick={generate} disabled={!check.ok || running || starting} aria-busy={running || starting}>
            {running || starting ? "Génération en cours…" : video ? "Générer à nouveau" : "Générer la vidéo"}
          </button>
          {video ? <div className="grid gap-2">
            <a className="btn-ghost flex min-h-[44px] items-center justify-center" href={video.downloadUrl} download={video.file}>Télécharger le MP4</a>
            {video.noMusicUrl ? <a className="btn-ghost flex min-h-[44px] items-center justify-center" href={video.noMusicUrl} download>Version sans musique</a> : null}
            {video.srtUrl ? <a className="btn-ghost flex min-h-[44px] items-center justify-center" href={video.srtUrl} download>Sous-titres (SRT)</a> : null}
          </div> : null}
          <div role="status" aria-live="polite" className="space-y-2 text-xs leading-relaxed text-mut">
            {running && job ? <div><p className="font-medium text-fg">{job.step} · {job.progress} %</p><div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.07]"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${job.progress}%` }} /></div></div> : null}
            {jobError ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{jobError}</p> : null}
            {video?.probe ? <p>Vidéo générée pour cette version : {video.probe.width}×{video.probe.height} · {fmt(video.probe.duration)} s · {video.probe.video.toUpperCase()}{video.probe.audio ? ` + ${video.probe.audio.toUpperCase()}` : " · sans son"}</p> : !running ? <p>Aperçu animé muet, durées estimées. Génère la vidéo pour la voix, la musique et les temps réels.</p> : null}
            {(video?.warnings ?? []).map((w) => <p key={w} className="text-amber-800">{w}</p>)}
            <p>1080×1920 · {fmt(total)} s · validation de Cédric avant toute publication.</p>
          </div>
        </aside>

        <section aria-label="Contenu de la vidéo" className="min-w-0 space-y-4">
          <div className="card grid gap-3 p-4 sm:grid-cols-2">
            <Input label="Sujet (titre interne)" value={spec.title} onChange={(title) => update({ ...spec, title })} />
            <label className="text-xs font-medium text-mut">Pilier principal
              <select className={FIELD} value={spec.pillar} onChange={(e) => update({ ...spec, pillar: e.target.value as StoryPillar })}>
                {Object.entries(PILLAR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <Input label="Objectif" value={spec.objective} onChange={(objective) => update({ ...spec, objective })} />
            <Input label="Durée visée (s)" value={String(spec.targetSeconds)} onChange={(v) => update({ ...spec, targetSeconds: Number(v.replace(/\D/g, "")) || spec.targetSeconds })} hint={`Estimée : ${fmt(total)} s (suit la voix).`} />
            <label className="text-xs font-medium text-mut">Voix
              <div className={FIELD}>Audrey · voix obligatoire des Reels IA</div>
              <span className="mt-1 block font-normal">Prononciation préparée pour BeeRecos, CLUB et « peut-être ». Écoute le résultat avant validation ; l’écran garde l’orthographe.</span>
            </label>
            <div className="space-y-2 text-xs text-mut">
              <label className="block font-medium">Débit de la voix · {Math.round(spec.voice.speed * 100)} %
                <input type="range" min={0.8} max={1.25} step={0.01} value={spec.voice.speed} disabled={running || starting}
                  onChange={(e) => setVoiceSpeed(Number(e.target.value))} aria-label="Débit de la voix" className="mt-2 block min-h-[44px] w-full accent-brand" />
              </label>
              <button type="button" className="btn-ghost min-h-[40px] text-xs" disabled={running || starting || spec.voice.speed === DEFAULT_VOICE_SPEED}
                onClick={() => setVoiceSpeed(DEFAULT_VOICE_SPEED)}>Appliquer le débit conseillé (92 %)</button>
              <p>100 % = débit normal. Réglage conseillé : 92 %, plus posé. Un changement de débit demande de générer la vidéo à nouveau.</p>
            </div>
            <label className="text-xs font-medium text-mut">Source des médias
              <input className={FIELD} value="Graphique (aucun tournage)" readOnly aria-readonly />
            </label>
          </div>

          <p className="text-sm text-mut">Place tes cartes sur les scènes ci-dessous, puis demande à l’IA de proposer les textes pour ce storyboard.</p>
          <div className="card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="text-xs font-medium text-mut">Sujet à confier au Scénariste (facultatif)
              <input className={FIELD} placeholder="Ex. : pourquoi venir visiter un club avant d'adhérer" value={brief} disabled={!isBackendConfigured || aiBusy}
                onChange={(e) => setBrief(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void propose(); }} />
            </label>
            <button type="button" className="btn-ghost min-h-[44px] self-end" onClick={propose} disabled={!isBackendConfigured || aiBusy} aria-busy={aiBusy}>{aiBusy ? "Écriture du script…" : reelNarrativeEngine ? "Structurer avec l'IA (Hook → CTA)" : "Proposer le script"}</button>
            {!isBackendConfigured ? <p className="text-xs text-mut sm:col-span-2">Mode démo : proposition IA indisponible, les scènes restent modifiables à la main.</p> : null}
          </div>
          {notice ? <p role="status" className={`rounded-xl px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{notice.text}</p> : null}

          {proposal ? <section aria-label="Proposition IA à valider" className="card space-y-3 border-brand/30 p-4">
            <h3 className="font-semibold">Proposition IA à valider</h3>
            <ol className="space-y-2 text-sm">{proposal.scenes.map((scene, i) => <li key={scene.id} className="rounded-xl bg-brand/5 p-3">
              <p className="font-semibold">{i + 1}. {VISUAL_LABEL[scene.visual]} · {scene.title || "Signature"}</p>
              <p>{scene.voice}</p>
              {scene.subtitle ? <p className="text-xs text-mut">À l’écran : {scene.subtitle}</p> : null}
              {scene.items?.length ? <p className="text-xs text-mut">Cartes : {scene.items.join(" · ")}</p> : null}
            </li>)}</ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-red" onClick={() => { update(proposal); setNotice({ tone: "ok", text: "Proposition appliquée au brouillon. Teste l’aperçu avant de générer." }); }}>Appliquer cette proposition</button>
              <button type="button" className="btn-ghost" onClick={() => { setProposal(null); setNotice(null); }}>Ignorer</button>
            </div>
          </section> : null}

          {!check.ok ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">À corriger avant de générer</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{check.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div> : null}

          <ol className="flex h-11 gap-1 overflow-hidden rounded-xl" aria-label="Déroulé">
            {spec.scenes.map((s, i) => <li key={s.id} style={{ flexGrow: durs[i] }} className="min-w-[18px] flex-shrink">
              <button type="button" onClick={() => preview.current?.seek(starts[i])} aria-label={`Lire depuis la scène ${i + 1} (${fmt(starts[i])} s)`}
                className={`h-full w-full truncate px-1 text-[11px] font-semibold text-white ${s.visual === "chapitre" || s.visual === "cta" ? "bg-brand" : i % 2 ? "bg-brand/80" : "bg-brand/60"}`}>{reelNarrativeEngine && s.role ? MOTION_ROLE_LABEL[s.role] : i + 1}</button>
            </li>)}
          </ol>

          <div className="grid gap-3 xl:grid-cols-[210px_minmax(0,1fr)]">
          <div className="min-w-0 xl:sticky xl:top-4 xl:max-h-[42rem] xl:self-start xl:overflow-y-auto">
            <MotionAnimationLibrary selected={selectedCard} onSelect={setSelectedCard} />
          </div>
          <ol className="min-w-0 space-y-3 xl:max-h-[42rem] xl:overflow-y-auto">
            {spec.scenes.map((s, i) => {
              const fixed = s.visual === "signature";
              return <li key={s.id} className="card p-4" aria-label={`Scène ${i + 1}`}
                onDragOver={event => { if (event.dataTransfer.types.includes(MOTION_CARD_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
                onDrop={event => { event.preventDefault(); assignCard(i, event.dataTransfer.getData(MOTION_CARD_TYPE)); }}>
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3">
                  <span className="text-sm font-semibold">Animation : {VISUAL_LABEL[s.visual]}</span>
                  <button type="button" className="btn-ghost ml-auto min-h-[44px] text-xs" disabled={!selectedCard}
                    onClick={() => { if (selectedCard) assignCard(i, selectedCard); }} aria-label={`Utiliser cette carte sur la scène ${i + 1}`}>Utiliser cette carte</button>
                  <button type="button" className="btn-ghost min-h-[44px] text-xs" onClick={() => preview.current?.seek(starts[i])} aria-label={`Tester la scène ${i + 1}`}>Tester</button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                  <label className="text-xs font-medium text-mut"><span className="sr-only">Visuel de la scène {i + 1}</span>
                    <select aria-label={`Visuel de la scène ${i + 1}`} className="max-w-full min-h-[40px] rounded-xl border border-line bg-white px-2 text-sm" value={s.visual} onChange={(e) => assignCard(i, e.target.value)}>
                      {MOTION_VISUALS.map((v) => <option key={v} value={v}>{VISUAL_LABEL[v]}</option>)}
                    </select>
                  </label>
                  <button type="button" className="text-xs text-brand underline-offset-2 hover:underline" onClick={() => preview.current?.seek(starts[i])}>{fmt(starts[i])} – {fmt(starts[i] + durs[i])} s</button>
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="btn-ghost min-h-[36px] px-2 text-xs" onClick={() => moveScene(i, -1)} disabled={i === 0} aria-label={`Monter la scène ${i + 1}`}>↑</button>
                    <button type="button" className="btn-ghost min-h-[36px] px-2 text-xs" onClick={() => moveScene(i, 1)} disabled={i === spec.scenes.length - 1} aria-label={`Descendre la scène ${i + 1}`}>↓</button>
                    <button type="button" className="btn-ghost min-h-[36px] px-2 text-xs" onClick={() => removeScene(i)} disabled={spec.scenes.length <= 3} aria-label={`Retirer la scène ${i + 1}`}>Retirer</button>
                  </span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Input label="Voix (phrase exacte)" value={s.voice} onChange={(voice) => setScene(i, { voice })} multiline />
                  {fixed ? <p className="text-xs text-mut">Logo officiel et baseline manuscrite, posés seuls (jamais animés ni déformés).</p> : <>
                    <Input label={s.visual === "cta" ? "Verbe à l'écran" : "Texte à l'écran (3 à 7 mots)"} value={s.title} onChange={(title) => setScene(i, { title })} multiline={s.visual !== "cta"} />
                    <Input label="Mot pivot" value={s.pivot ?? ""} onChange={(pivot) => setScene(i, { pivot })} hint="Le mot que la voix appuie : punch, réaction de la mascotte." />
                    {reelNarrativeEngine ? <label className="text-xs font-medium text-mut">Rôle narratif
                      <select className={FIELD} value={s.role ?? ""} onChange={(e) => { const role = e.target.value as MotionNarrativeRole | ""; const { role: _r, ...rest } = s; void _r; update({ ...spec, scenes: spec.scenes.map((x, n) => (n === i ? (role ? { ...rest, role } : rest) : x)) }); }}>
                        <option value="">—</option>{MOTION_NARRATIVE_ROLES.map((r) => <option key={r} value={r}>{MOTION_ROLE_LABEL[r]}</option>)}
                      </select>
                    </label> : null}
                    {["liste", "chapitre", "piliers", "relation", "titre", "marque"].includes(s.visual) ? <Input label="Cartes (séparées par une virgule, 3 au plus)" value={(s.items ?? []).join(", ")} onChange={(v) => setScene(i, { items: v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3) })} /> : null}
                    {spec.settings.texte === "riche" && s.visual !== "cta" ? <Input label="Précision (quantité riche)" value={s.subtitle ?? ""} onChange={(subtitle) => setScene(i, { subtitle })} /> : null}
                  </>}
                </div>
              </li>;
            })}
          </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost min-h-[44px]" onClick={addScene} disabled={spec.scenes.length >= 12}>Ajouter une scène</button>
            <button type="button" className="btn-ghost min-h-[44px]" onClick={() => { update(DEMO_MOTION); setNotice({ tone: "ok", text: "Film de présentation BeeRecos rétabli." }); }}>Revenir au film de présentation</button>
          </div>

          <div className="card grid gap-3 p-4 sm:grid-cols-2">
            <Input label="Mot-clé à commenter" value={spec.cta.keyword} onChange={(v) => update({ ...spec, cta: { ...spec.cta, keyword: v.toUpperCase().replace(/\s/g, "") } })} hint="Il doit exister dans le moteur de DM avant publication." />
            <Input label="Complément du CTA" value={spec.cta.complement} onChange={(complement) => update({ ...spec, cta: { ...spec.cta, complement } })} />
          </div>
        </section>
      </div>
      <footer className="card space-y-2 p-4">
        <button type="button" className="btn-red min-h-[44px] w-full" disabled={!onUseVideo || !video || !transfer || running || importing} aria-busy={importing} onClick={useInMontage}>
          {importing ? "Enregistrement de la source…" : "Utiliser cette vidéo dans le montage"}
        </button>
        <p className="text-xs text-mut">{!onUseVideo ? "Le serveur de montage doit être configuré pour enregistrer la source." : "Seul un MP4 généré pour la version actuelle des scènes peut être enregistré. Le montage ouvre ensuite « Préparer le post »."}</p>
      </footer>
    </div>
  );
}

function Input({ label, value, onChange, multiline, hint }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string }) {
  return <label className="text-xs font-medium text-mut">{label}
    {multiline ? <textarea rows={2} className={`${FIELD} resize-y leading-snug`} value={value} onChange={(e) => onChange(e.target.value)} />
      : <input className={FIELD} value={value} onChange={(e) => onChange(e.target.value)} />}
    {hint ? <span className="mt-1 block font-normal">{hint}</span> : null}
  </label>;
}

function Segmented<T extends string>({ label, value, options, onChange, disabled = [], hint }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void; disabled?: string[]; hint?: string }) {
  return <div role="radiogroup" aria-label={label}>
    <p className="text-xs font-medium text-mut">{label}</p>
    <div className="mt-1 grid gap-1">
      {(Object.keys(options) as T[]).map((k) => <button key={k} type="button" role="radio" aria-checked={value === k} disabled={disabled.includes(k)} onClick={() => onChange(k)}
        className={`min-h-[40px] rounded-xl border px-3 text-left text-sm transition disabled:opacity-50 ${value === k ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-fg hover:border-brand"}`}>{options[k]}</button>)}
    </div>
    {hint ? <p className="mt-1 text-xs text-mut">{hint}</p> : null}
  </div>;
}

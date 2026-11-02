"use client";
import { useState } from "react";
import { montage } from "@/lib/social/montage-api";
import type { Edit } from "@/domain/social/montage/edit";
import { MEDIA_KIND_LABELS, MEDIA_MAX_BYTES, type MediaItem, type MediaKind } from "@/domain/social/montage/media";
import { checkTimeline } from "@/domain/social/montage/suggest";

/**
 * BIBLIOTHÈQUE DE MÉDIAS DU STUDIO (lot S3, Video Agent Kit §7 : « Bibliothèque », « Sons ») : sons et images, chacun
 * avec sa licence (contrôle avant publication). Dans un montage, un son se place au curseur de lecture (volume
 * réglable) et une image s'affiche par l'animation « image ». Polices : la charte n'autorise que Poppins et Caveat,
 * déjà fournies au rendu ; aucune autre police ne s'importe.
 */

const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const ACCEPT: Record<MediaKind, string> = { son: "audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg", image: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" };

/** Durée d'un son lue par le navigateur (facultative). */
function audioDurationMs(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(a.duration) ? Math.max(1, Math.round(a.duration * 1000)) : null); };
    a.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    a.src = url;
  });
}

function MediaUpload({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<MediaKind>("son");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [licence, setLicence] = useState("");
  const [source, setSource] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Choisissez un fichier.");
    if (file.size > MEDIA_MAX_BYTES[kind]) return setError(`Fichier trop lourd : ${MEDIA_MAX_BYTES[kind] / 1024 / 1024} Mo au plus.`);
    setError(null);
    try {
      setStep("Préparation…");
      const durationMs = kind === "son" ? await audioDurationMs(file) : null;
      const created = await montage.mediaCreate({ kind, title: title.trim() || file.name.replace(/\.[^.]+$/, ""), fileName: file.name, size: file.size, licence, sourceUrl: source.trim() || undefined });
      setStep("Envoi…");
      const res = await fetch(created.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!res.ok) throw new Error(`Envoi interrompu (${res.status}) : relancez.`);
      await montage.mediaUploaded(created.mediaId, durationMs);
      setFile(null); setTitle(""); setLicence(""); setSource("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setStep(null);
    }
  };

  const field = "mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} aria-label="Ajouter un média" className="space-y-2 rounded-xl border border-line p-3">
      <div role="radiogroup" aria-label="Type de média" className="flex gap-2">
        {(["son", "image"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setFile(null); }}
            className={`rounded-lg px-3 py-1.5 text-sm ${kind === k ? "bg-brand text-white" : "bg-black/[0.04] text-mut"}`}>{MEDIA_KIND_LABELS[k]}</button>
        ))}
      </div>
      <label className="block text-sm font-medium">Fichier ({kind === "son" ? ".mp3, .wav, .m4a, 20 Mo au plus" : ".png, .jpg, .webp, 10 Mo au plus"})
        <input key={kind} type="file" accept={ACCEPT[kind]} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
      </label>
      <label className="block text-sm font-medium">Titre<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} /></label>
      <label className="block text-sm font-medium">Licence (obligatoire)
        <input value={licence} onChange={(e) => setLicence(e.target.value)} maxLength={200} placeholder="Ex. Pixabay Content License, Photo BeeRecos" className={field} />
      </label>
      <label className="block text-sm font-medium">Source (facultatif)<input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://…" className={field} /></label>
      <button type="submit" className="btn-red min-h-[40px] px-3 text-sm" disabled={!file || licence.trim().length < 2 || Boolean(step)} aria-busy={Boolean(step)}>{step ?? "Ajouter à la bibliothèque"}</button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}

type Editor = { edit: Edit; playheadMs: number | null; disabled?: boolean; onSave: (edit: Edit) => Promise<void> };
type Props = { library: MediaItem[] | null; onRefresh: () => void; editor?: Editor };

export default function StudioMedia({ library, onRefresh, editor }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };
  const at = Math.max(0, Math.round(editor?.playheadMs ?? editor?.edit.ranges[0]?.fromMs ?? 0));
  const placeSound = (m: MediaItem) => editor && run(m.id, () => editor.onSave({ ...editor.edit, sounds: [...editor.edit.sounds, { file: m.fileName, atMs: at, volume: 1 }].sort((a, b) => a.atMs - b.atMs) }));
  const placeImage = (m: MediaItem) => {
    if (!editor) return;
    const custom = [...editor.edit.custom, { name: "image", fromMs: at, toMs: at + 3000, props: { fichier: m.fileName, mode: "encart" } }].sort((a, b) => a.fromMs - b.fromMs);
    const clash = checkTimeline(custom);
    if (clash.length) return setError(clash.join("\n"));
    void run(m.id, () => editor.onSave({ ...editor.edit, custom }));
  };
  const setSound = (i: number, patch: { volume?: number } | null) => {
    if (!editor) return;
    const sounds = patch === null ? editor.edit.sounds.filter((_, j) => j !== i) : editor.edit.sounds.map((s, j) => (j === i ? { ...s, ...patch } : s));
    void run(`s${i}`, () => editor.onSave({ ...editor.edit, sounds }));
  };
  const title = (file: string) => library?.find((m) => m.fileName === file)?.title ?? file;
  // Rythme (lot S6) : zoom alterné à chaque coupe et son d'entrée des animations.
  const rythme = { zoomCoupes: false, zoom: 1.1, volumeSon: 0.35, ...editor?.edit.rythme };
  const setRythme = (patch: Partial<typeof rythme>) => {
    if (!editor) return;
    const next = { ...rythme, ...patch };
    if (!next.sonAnimations) delete next.sonAnimations;
    void run("rythme", () => editor.onSave({ ...editor.edit, rythme: next }));
  };
  const sons = library?.filter((m) => m.kind === "son") ?? [];
  const disabled = editor?.disabled || Boolean(busy);

  return (
    <div className="space-y-3">
      {editor ? (
        <section aria-label="Rythme" className="space-y-2 rounded-xl border border-line p-3">
          <h4 className="text-sm font-medium">Rythme</h4>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rythme.zoomCoupes} disabled={disabled} onChange={(e) => setRythme({ zoomCoupes: e.target.checked })} />
            Zoom alterné à chaque coupe (plan large, plan serré)
          </label>
          <label className="flex items-center gap-2 text-xs text-mut">Plan serré
            <select value={String(rythme.zoom)} disabled={disabled || !rythme.zoomCoupes} onChange={(e) => setRythme({ zoom: Number(e.target.value) })} className="rounded-lg border border-line bg-white px-2 py-1 text-sm">
              {[1.05, 1.1, 1.15, 1.2].map((z) => <option key={z} value={String(z)}>{Math.round(z * 100)} %</option>)}
            </select>
          </label>
          <label className="block text-sm">Son à l&apos;entrée de chaque animation
            <select value={rythme.sonAnimations ?? ""} disabled={disabled} onChange={(e) => setRythme({ sonAnimations: e.target.value || undefined })} className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-1 text-sm">
              <option value="">Aucun</option>
              {sons.map((m) => <option key={m.id} value={m.fileName}>{m.title}</option>)}
            </select>
          </label>
          {rythme.sonAnimations ? (
            <label className="flex items-center gap-1 text-xs text-mut">Volume du son
              <input type="range" min={0} max={1} step={0.05} defaultValue={rythme.volumeSon} disabled={disabled} aria-label="Volume du son des animations"
                onMouseUp={(e) => setRythme({ volumeSon: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => setRythme({ volumeSon: Number((e.target as HTMLInputElement).value) })} />
            </label>
          ) : null}
          {!sons.length ? <p className="text-xs text-mut">Ajoutez d&apos;abord un son court (whoosh, pop) à la bibliothèque, avec sa licence.</p> : null}
        </section>
      ) : null}
      {editor ? (
        <section aria-label="Sons du montage" className="space-y-1">
          <h4 className="text-sm font-medium">Sons du montage</h4>
          {editor.edit.sounds.length === 0 ? <p className="text-xs text-mut">Aucun son : placez-en un au curseur depuis la bibliothèque ci-dessous.</p> : null}
          <ul className="space-y-1">
            {editor.edit.sounds.map((s, i) => (
              <li key={`${s.file}-${s.atMs}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-14 tabular-nums text-mut">{sec(s.atMs)}</span>
                <span className="min-w-0 flex-1 truncate">{title(s.file)}</span>
                <label className="flex items-center gap-1 text-xs text-mut">Volume
                  <input type="range" min={0} max={1} step={0.05} defaultValue={s.volume} disabled={disabled} aria-label={`Volume de ${title(s.file)}`}
                    onMouseUp={(e) => setSound(i, { volume: Number((e.target as HTMLInputElement).value) })} onKeyUp={(e) => setSound(i, { volume: Number((e.target as HTMLInputElement).value) })} />
                </label>
                <button type="button" className="btn-ghost min-h-[32px] px-2 text-xs" disabled={disabled} onClick={() => setSound(i, null)}>Retirer</button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-mut">Curseur de lecture : {sec(at)} (temps de la prise). Lisez la vidéo jusqu&apos;à l&apos;instant voulu puis placez le média.</p>
        </section>
      ) : null}
      <section aria-label="Bibliothèque de médias" className="space-y-2">
        <h4 className="text-sm font-medium">Bibliothèque</h4>
        {library === null ? <p role="status" className="text-xs text-mut">Chargement…</p> : null}
        {library?.length === 0 ? <p className="text-xs text-mut">Bibliothèque vide : ajoutez un son ou une image (avec sa licence).</p> : null}
        <ul className="space-y-2">
          {library?.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-sm">
              {m.kind === "image" && m.url ? <img src={m.url} alt="" className="h-12 w-12 rounded object-cover" /> : <span aria-hidden className="grid h-12 w-12 place-items-center rounded bg-black/[0.04] text-lg">{m.kind === "son" ? "♪" : "▣"}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.title}</p>
                <p className="truncate text-xs text-mut">{MEDIA_KIND_LABELS[m.kind]}{m.durationMs ? ` · ${sec(m.durationMs)}` : ""} · {m.licence}</p>
                {m.kind === "son" && m.url ? <audio src={m.url} controls preload="none" className="mt-1 h-8 w-full max-w-[260px]" aria-label={`Écouter ${m.title}`} /> : null}
              </div>
              {editor ? (
                <button type="button" className="btn-red min-h-[36px] px-3 text-xs" disabled={disabled} onClick={() => (m.kind === "son" ? placeSound(m) : placeImage(m))}>
                  {m.kind === "son" ? "Placer au curseur" : "Afficher au curseur"}
                </button>
              ) : (
                <button type="button" className="btn-ghost min-h-[36px] px-3 text-xs" disabled={Boolean(busy)} onClick={() => run(m.id, async () => { await montage.mediaDelete(m.id); onRefresh(); })}>Supprimer</button>
              )}
            </li>
          ))}
        </ul>
        <MediaUpload onDone={onRefresh} />
        <p className="text-xs text-mut">Polices : la charte BeeRecos n&apos;autorise que Poppins (textes) et Caveat (baseline), déjà incluses au rendu.</p>
      </section>
      {error ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

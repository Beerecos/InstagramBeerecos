"use client";
/**
 * Post et export d'un réel, dans le même projet que le montage : couverture, légende, CTA, mot-clé, destination,
 * hashtags, puis fichiers livrés (MP4 rendu, couverture PNG, légende TXT, sous-titres SRT).
 * Indépendant de Meta, des mots-clés DM actifs et du calendrier : le transfert vers la file Reels reste une action
 * distincte (panneau Rendu).
 */
import { useMemo, useRef, useState } from "react";
import { reels, type MontageDetail } from "@/lib/social/montage-api";
import { composeCaption, durationWarning, emptyPost, fileSlug, montageSrt, parseHashtags, postWarnings, type ReelPost } from "@/domain/reels/post";

const KEY = (id: string) => `ibr.post.${id}`;
function readPost(id: string): ReelPost | null {
  try { const raw = localStorage.getItem(KEY(id)); return raw ? (JSON.parse(raw) as ReelPost) : null; } catch { return null; }
}
function writePost(id: string, post: ReelPost): boolean {
  try { localStorage.setItem(KEY(id), JSON.stringify(post)); return true; } catch { return false; }
}

async function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function PostPanel({ m }: { m: MontageDetail }) {
  const version = m.updatedAt;
  const keyword = m.reel?.keyword ?? m.brief?.motCle ?? "";
  // Panneau ouvert sur clic, toujours côté navigateur : lecture directe de la légende enregistrée sur cet appareil.
  const [post, setPost] = useState<ReelPost>(() => readPost(m.id) ?? emptyPost(version, keyword));
  const [tags, setTags] = useState(() => post.hashtags.join(" "));
  const [saved, setSaved] = useState<"local" | "serveur" | null>(() => (readPost(m.id) ? "local" : null));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  const update = (patch: Partial<ReelPost>) => { setPost((p) => ({ ...p, ...patch })); setSaved(null); };
  const final = useMemo(() => composeCaption(post), [post]);
  const warnings = postWarnings(post, version);
  const dur = durationWarning(m.keptMs);
  const srt = useMemo(() => (m.edit && m.captions?.length ? montageSrt(m.captions, m.edit.ranges) : ""), [m.edit, m.captions]);
  const name = fileSlug(m.reel ? `${m.reel.reelId} ${m.title}` : m.title);
  const ready = m.renderStatus === "done" && Boolean(m.finalVideoUrl);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };
  const save = () => {
    const next = { ...post, version };
    setPost(next);
    if (writePost(m.id, next)) setSaved("local"); else setError("Enregistrement impossible dans ce navigateur.");
  };
  const saveOnReel = () => run("reel", async () => {
    if (!m.reel) return;
    await reels.saveCaption(m.reel.reelId, m.reel.revision, final);
    save(); setSaved("serveur");
  });
  const cover = () => run("cover", async () => {
    const v = video.current;
    if (!v) throw new Error("Vidéo indisponible.");
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Capture impossible dans ce navigateur.");
    ctx.drawImage(v, 0, 0, 1080, 1920);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("Capture impossible : le serveur vidéo n'autorise pas la lecture de l'image.");
    await saveBlob(blob, `${name}-couverture.png`);
  });
  const mp4 = () => run("mp4", async () => {
    const res = await fetch(m.finalVideoUrl!);
    if (!res.ok) throw new Error(`Téléchargement du MP4 impossible (HTTP ${res.status}) : relance la lecture du projet pour renouveler le lien.`);
    await saveBlob(await res.blob(), `${name}.mp4`);
  });

  return (
    <div className="space-y-4 text-sm">
      <section aria-labelledby="couverture" className="space-y-2">
        <h3 id="couverture" className="font-semibold">Couverture</h3>
        {ready ? <>
          <video ref={video} src={m.finalVideoUrl!} crossOrigin="anonymous" playsInline muted preload="auto" className="aspect-[9/16] w-full max-w-[200px] rounded-xl bg-black"
            onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); e.currentTarget.currentTime = post.coverMs / 1000; }} aria-label="Aperçu de la couverture (cadrage du MP4 rendu)" />
          <label className="block">Instant de la couverture : {(post.coverMs / 1000).toFixed(1)} s
            <input type="range" min={0} max={Math.max(0, Math.floor(duration * 10))} value={Math.round(post.coverMs / 100)} className="block w-full"
              onChange={(e) => { const ms = Number(e.target.value) * 100; update({ coverMs: ms }); if (video.current) video.current.currentTime = ms / 1000; }} />
          </label>
        </> : <p className="text-mut">La couverture est prise dans le MP4 rendu, avec son cadrage exact : lance d&apos;abord le rendu (panneau Rendu).</p>}
      </section>

      <section aria-labelledby="legende" className="space-y-2">
        <h3 id="legende" className="font-semibold">Légende</h3>
        <label className="block">Texte
          <textarea rows={5} maxLength={2400} value={post.caption} onChange={(e) => update({ caption: e.target.value })} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">CTA<input value={post.cta} onChange={(e) => update({ cta: e.target.value })} placeholder="Commente CLUB" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
          <label className="block">Mot-clé éventuel<input value={post.keyword} onChange={(e) => update({ keyword: e.target.value.toUpperCase().replace(/\s/g, "") })} className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
          <label className="block sm:col-span-2">Destination prévue du CTA<input value={post.destination} onChange={(e) => update({ destination: e.target.value })} placeholder="Ex. page « Visiter un club »" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
          <label className="block sm:col-span-2">Hashtags<input value={tags} onChange={(e) => { setTags(e.target.value); update({ hashtags: parseHashtags(e.target.value) }); }} placeholder="#BeeRecos #reseau" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
        </div>
        <details><summary className="cursor-pointer font-medium">Texte final ({final.length} caractères)</summary><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/[0.04] p-3 font-sans">{final || "—"}</pre></details>
        {[dur, ...warnings].filter(Boolean).length ? <ul className="list-disc space-y-1 pl-5 text-amber-800">{[dur, ...warnings].filter(Boolean).map((w) => <li key={w!}>{w}</li>)}</ul> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost min-h-11" onClick={save}>Enregistrer sur cet appareil</button>
          {m.reel ? <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy) || !final} onClick={saveOnReel}>{busy === "reel" ? "Enregistrement…" : `Enregistrer sur ${m.reel.reelId} (serveur)`}</button> : null}
          <span role="status" className="text-xs text-mut">{saved === "serveur" ? `Enregistrée sur ${m.reel?.reelId} et sur cet appareil.` : saved === "local" ? "Enregistrée sur cet appareil." : "Modifications non enregistrées."}</span>
        </div>
      </section>

      <section aria-labelledby="fichiers" className="space-y-2">
        <h3 id="fichiers" className="font-semibold">Fichiers livrés</h3>
        <p className="text-mut">Exporter n&apos;est pas publier. Rien n&apos;est envoyé à Instagram depuis ce panneau.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-red min-h-11" disabled={!ready || Boolean(busy)} onClick={mp4}>{busy === "mp4" ? "Téléchargement…" : "MP4 (1080×1920)"}</button>
          <button type="button" className="btn-ghost min-h-11" disabled={!ready || Boolean(busy)} onClick={cover}>{busy === "cover" ? "Capture…" : "Couverture PNG"}</button>
          <button type="button" className="btn-ghost min-h-11" disabled={!final} onClick={() => saveBlob(new Blob([final], { type: "text/plain;charset=utf-8" }), `${name}-legende.txt`)}>Légende TXT</button>
          <button type="button" className="btn-ghost min-h-11" disabled={!srt} onClick={() => saveBlob(new Blob([srt], { type: "application/x-subrip;charset=utf-8" }), `${name}.srt`)}>Sous-titres SRT</button>
        </div>
        {!ready ? <p className="text-mut">Le MP4 et la couverture sont disponibles après un rendu terminé de cette version.</p> : null}
        {!srt ? <p className="text-mut">SRT disponible après la transcription.</p> : null}
      </section>
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    </div>
  );
}

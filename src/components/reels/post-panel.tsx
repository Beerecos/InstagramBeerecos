"use client";
/**
 * Post et export d'un réel, dans le même projet que le montage : couverture, légende, CTA, mot-clé, destination,
 * hashtags, puis fichiers livrés (MP4 rendu, couverture PNG, légende TXT, sous-titres SRT).
 * Publication : section « Publier sur Instagram » (confirmation explicite, suivi réel) ; le mot-clé devient une règle
 * de DM seulement après une publication confirmée par Instagram.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { montage, reels, type MontageDetail } from "@/lib/social/montage-api";
import { transferStudioMedia, updateDeliverable } from "@/lib/social/editorial-api";
import PublishButton from "@/components/post/publish-dialog";
import { instagram } from "@/lib/instagram/api";
import type { Publication } from "@/domain/instagram/publication";
import { composeCaption, durationWarning, emptyPost, fileSlug, montageSrt, parseHashtags, postWarnings, type ReelPost } from "@/domain/reels/post";

const RECOVERY = (id: string) => `ibr.post.recovery.${id}`;
const KEY = (id: string) => `ibr.post.${id}`;
function readPost(id: string): ReelPost | null {
  try { const raw = localStorage.getItem(KEY(id)); return raw ? (JSON.parse(raw) as ReelPost) : null; } catch { return null; }
}
function readRecovery(id: string): ReelPost | null {
  try {
    const post = JSON.parse(localStorage.getItem(RECOVERY(id)) ?? "null");
    if (!post || !["version", "caption", "cta", "keyword", "destination"].every((key) => typeof post[key] === "string") ||
      !Array.isArray(post.hashtags) || !post.hashtags.every((tag: unknown) => typeof tag === "string") ||
      !Number.isFinite(post.coverMs)) return null;
    return post;
  } catch { return null; }
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
  // Source de vérité : le post enregistré sur le serveur avec le montage ; à défaut, la copie de cet appareil.
  const [post, setPost] = useState<ReelPost>(() => (readRecovery(m.id) ?? (m.post ? { ...m.post } : readPost(m.id) ?? emptyPost(version, keyword))));
  const [tags, setTags] = useState(() => post.hashtags.join(" "));
  const [saved, setSaved] = useState<"local" | "serveur" | null>(() => (readRecovery(m.id) ? "local" : m.post ? "serveur" : readPost(m.id) ? "local" : null));
  const [notice, setNotice] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [planned, setPlanned] = useState<{ id: string; at: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [pub, setPub] = useState<Publication | null>(null);
  const [connected, setConnected] = useState(false);
  const [dmText, setDmText] = useState("");
  const [buttonTitle, setButtonTitle] = useState("");
  useEffect(() => {
    instagram.list().then((r) => { const p = r.items.find((x) => x.montageId === m.id) ?? null; setPub(p); if (p) { setDmText(p.dmText ?? ""); setButtonTitle(p.buttonTitle ?? ""); } }).catch(() => {});
    instagram.connection().then((c) => setConnected(c.connected)).catch(() => {});
  }, [m.id]);

  const update = (patch: Partial<ReelPost>) => {
    const next = { ...post, ...patch };
    setPost(next);
    try {
      localStorage.setItem(RECOVERY(m.id), JSON.stringify(next));
      setSaved("local");
    } catch {
      setSaved(null);
      setError("La copie automatique est indisponible. Enregistre la légende avant de quitter.");
    }
  };
  useEffect(() => {
    if (saved !== null) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
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
  const saveLocal = () => {
    const next = { ...post, version };
    setPost(next);
    if (writePost(m.id, next)) setSaved("local"); else setError("Enregistrement impossible dans ce navigateur.");
  };
  const save = () => run("save", async () => {
    const { caption, cta, keyword, destination, hashtags, coverMs } = post;
    try {
      const r = await montage.savePost(m.id, { caption, cta, keyword, destination, hashtags, coverMs: Math.round(coverMs) }, version);
      setPost((p) => ({ ...p, version: r.post.version }));
      writePost(m.id, { ...post, version: r.post.version });
      try { localStorage.removeItem(RECOVERY(m.id)); } catch { /* copie locale conservée */ }
      setSaved("serveur"); setNotice(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      // Serveur pas encore mis à jour (action inconnue) : la légende reste sur cet appareil, sans perte.
      if (/Action inconnue|inconnue|unknown/i.test(message)) { saveLocal(); setNotice("Serveur pas encore à jour : légende enregistrée sur cet appareil seulement."); return; }
      throw e;
    }
  });
  const saveOnReel = () => run("reel", async () => {
    if (!m.reel) return;
    await reels.saveCaption(m.reel.reelId, m.reel.revision, final);
    saveLocal(); setSaved("serveur");
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
  // Calendrier éditorial (base partagée) : brouillon de post lié au MP4 de cette version, daté. Le serveur réutilise
  // le brouillon déjà créé pour ce montage (pas de doublon). Aucune publication ni programmation sur Instagram.
  const addToCalendar = () => run("cal", async () => {
    if (!when) throw new Error("Choisis une date et une heure.");
    const at = new Date(when);
    if (Number.isNaN(at.getTime())) throw new Error("Date illisible.");
    const draft = await transferStudioMedia({ sourceType: "montage", sourceId: m.id, expectedSourceVersion: m.updatedAt, channel: "instagram" });
    const url = /^https:\/\//.test(post.destination.trim()) ? post.destination.trim() : undefined;
    const saved = await updateDeliverable(draft.id, { title: m.title, content: final, cta: post.cta || null, keyword: post.keyword || null, ...(url ? { destinationUrl: url } : {}), scheduledAt: at.toISOString(), expectedVersion: draft.contentVersion });
    setPlanned({ id: saved.id, at: saved.scheduledAt });
  });
  const mp4 = () => run("mp4", async () => {
    const res = await fetch(m.finalVideoUrl!);
    if (!res.ok) throw new Error(`Téléchargement du MP4 impossible (HTTP ${res.status}) : relance la lecture du projet pour renouveler le lien.`);
    await saveBlob(await res.blob(), `${name}.mp4`);
  });

  return (
    <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-4 text-sm">
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
          <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy)} onClick={save}>{busy === "save" ? "Enregistrement…" : "Enregistrer la légende"}</button>
          {m.reel ? <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy) || !final} onClick={saveOnReel}>{busy === "reel" ? "Enregistrement…" : `Reprendre sur le script ${m.reel.reelId}`}</button> : null}
          <span role="status" className="text-xs text-mut">{saved === "serveur" ? "Enregistrée sur le serveur avec ce montage." : saved === "local" ? "Copie automatique sur cet appareil. Enregistre pour la retrouver ailleurs." : "Modifications non enregistrées."}</span>
        </div>
      </section>

      <section aria-labelledby="publier" className="space-y-2">
        <h3 id="publier" className="font-semibold">Publier sur Instagram</h3>
        {post.keyword ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block sm:col-span-2">DM envoyé à qui commente {post.keyword}
              <textarea rows={3} maxLength={900} value={dmText} onChange={(e) => setDmText(e.target.value)} disabled={pub?.status === "published" || pub?.status === "publishing"} placeholder="Merci ! Voici le lien promis :" className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2" />
            </label>
            <label className="block">Bouton du DM (facultatif)<input maxLength={20} value={buttonTitle} onChange={(e) => setButtonTitle(e.target.value)} disabled={pub?.status === "published" || pub?.status === "publishing"} placeholder="Ouvrir" className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-white px-3" /></label>
            <p className="self-end text-xs text-mut">{/^https:\/\//.test(post.destination.trim()) ? `Lien du bouton : ${post.destination.trim()}` : "Pour un bouton, mets un lien https:// dans « Destination »."}</p>
          </div>
        ) : <p className="text-mut">Sans mot-clé, aucun DM automatique n&apos;est créé.</p>}
        {!ready ? <p className="text-mut">Disponible quand le MP4 de cette version est rendu.</p> : null}
        <PublishButton connected={connected} current={pub} videoUrl={ready ? m.finalVideoUrl : null} onChange={setPub} disabled={!ready || Boolean(busy)}
          prepare={async () => {
            const url = /^https:\/\//.test(post.destination.trim()) ? post.destination.trim() : "";
            const { item } = await instagram.save({ id: pub?.id, kind: "reel", montageId: m.id, title: m.title, caption: final, keyword: post.keyword, dmText: post.keyword ? dmText : "", buttonTitle: post.keyword && url ? buttonTitle : "", buttonUrl: post.keyword && buttonTitle ? url : "" });
            return item;
          }} />
        {!connected ? <p className="text-xs text-mut">Instagram n&apos;est pas connecté : <Link href="/settings#instagram" className="text-brand underline">Paramètres → Instagram</Link>.</p> : null}
      </section>

      <section aria-labelledby="fichiers" className="space-y-2">
        <h3 id="fichiers" className="font-semibold">Fichiers livrés</h3>
        <p className="text-mut">Exporter n&apos;est pas publier : pour publier, utilise « Publier sur Instagram » ci-dessus.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-red min-h-11" disabled={!ready || Boolean(busy)} onClick={mp4}>{busy === "mp4" ? "Téléchargement…" : "MP4 (1080×1920)"}</button>
          <button type="button" className="btn-ghost min-h-11" disabled={!ready || Boolean(busy)} onClick={cover}>{busy === "cover" ? "Capture…" : "Couverture PNG"}</button>
          <button type="button" className="btn-ghost min-h-11" disabled={!final} onClick={() => saveBlob(new Blob([final], { type: "text/plain;charset=utf-8" }), `${name}-legende.txt`)}>Légende TXT</button>
          <button type="button" className="btn-ghost min-h-11" disabled={!srt} onClick={() => saveBlob(new Blob([srt], { type: "application/x-subrip;charset=utf-8" }), `${name}.srt`)}>Sous-titres SRT</button>
        </div>
        {!ready ? <p className="text-mut">Le MP4 et la couverture sont disponibles après un rendu terminé de cette version.</p> : null}
        {!srt ? <p className="text-mut">SRT disponible après la transcription.</p> : null}
      </section>
      <section aria-labelledby="calendrier" className="space-y-2">
        <h3 id="calendrier" className="font-semibold">Calendrier éditorial</h3>
        <p className="text-mut">Ajoute ce post en brouillon à la date voulue. Rien n&apos;est publié ni programmé sur Instagram : la validation et la publication restent des étapes distinctes.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">Date et heure prévues<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 block min-h-11 rounded-lg border border-line bg-white px-3" /></label>
          <button type="button" className="btn-red min-h-11" disabled={!ready || !final || !when || Boolean(busy)} onClick={addToCalendar}>{busy === "cal" ? "Ajout…" : "Ajouter au calendrier"}</button>
        </div>
        {!ready ? <p className="text-mut">Disponible quand le MP4 de cette version est rendu.</p> : null}
        {planned ? <p role="status" className="text-acid-dim">Brouillon ajouté au calendrier{planned.at ? ` pour le ${new Date(planned.at).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}` : ""}. <Link href="/calendar" className="text-brand underline">Voir le calendrier</Link></p> : null}
      </section>
      {notice ? <p role="status" className="text-amber-800">{notice}</p> : null}
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    </fieldset>
  );
}

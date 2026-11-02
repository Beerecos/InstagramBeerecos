"use client";
import { useEffect, useMemo, useState } from "react";
import { layout, remapCaptions, takeIndexAt, takeStrip, toOutputMs, totalMs, type CaptionWord, type Edit } from "@/domain/social/montage/edit";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { usedMedia, type MediaItem } from "@/domain/social/montage/media";
import { charteWarnings } from "@/domain/social/montage/charte";

/**
 * PLANCHE CONTACT DU STUDIO (porte du Video Agent Kit : « jamais de rendu final sans OK explicite sur la planche
 * contact ») : une vignette par morceau gardé et par animation, avec le temps dans la vidéo montée, la parole et le
 * texte affiché, plus les contrôles de la version. La direction valide CETTE version ; toute modification ensuite
 * invalide la planche et le serveur refuse le rendu tant qu'elle n'est pas revalidée.
 */

const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const MAX_REEL_MS = 180_000;

type Plan = { key: string; kind: "morceau" | "animation"; label: string; outMs: number; sourceMs: number; text: string };

export function contactPlans(edit: Edit, words: CaptionWord[]): Plan[] {
  const segments = layout(edit.ranges);
  const placed = remapCaptions(words, segments);
  const plans: Plan[] = segments.map((s, i) => {
    const len = s.toMs - s.fromMs;
    const said = placed.filter((w) => w.segment === i).map((w) => w.text.trim()).join(" ");
    return { key: `m${i}`, kind: "morceau", label: `Plan ${i + 1}`, outMs: s.atMs, sourceMs: s.fromMs + Math.min(400, len / 2), text: said.length > 90 ? `${said.slice(0, 87)}…` : said };
  });
  edit.custom.forEach((c, i) => {
    const shown = Object.values(c.props).flatMap((v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "number" ? [String(v)] : [])).join(" · ");
    plans.push({ key: `a${i}`, kind: "animation", label: ANIMATIONS[c.name]?.label ?? c.name, outMs: toOutputMs(segments, c.fromMs), sourceMs: Math.min(c.fromMs + 600, c.toMs), text: shown });
  });
  return plans.sort((a, b) => a.outMs - b.outMs || (a.kind === "morceau" ? -1 : 1));
}

/** Image à tirer : instant (ms de la bande) → adresse de sa prise et temps dans cette prise. */
type Shot = { sourceMs: number; url: string; ms: number };

/** Vignettes tirées des prises (navigateur) ; null si une prise ne peut pas être lue ici. */
function useThumbnails(shots: Shot[]) {
  const [thumbs, setThumbs] = useState<Record<number, string | null>>({});
  const key = shots.map((x) => `${x.sourceMs}@${x.url}`).join(",");
  useEffect(() => {
    if (!shots.length) return;
    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    const canvas = document.createElement("canvas");
    canvas.width = 135; canvas.height = 240;
    const grab = (t: number) => new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 6000);
      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } catch { resolve(null); }
      };
      video.onerror = () => { clearTimeout(timer); resolve(null); };
      video.currentTime = t / 1000;
    });
    (async () => {
      // Une prise après l'autre : le lecteur ne change d'adresse qu'à un changement de prise.
      for (const shot of [...shots].sort((a, b) => a.url.localeCompare(b.url) || a.ms - b.ms)) {
        if (cancelled) return;
        if (video.src !== shot.url) video.src = shot.url;
        const url = await grab(shot.ms);
        if (!cancelled) setThumbs((m) => ({ ...m, [shot.sourceMs]: url }));
      }
    })();
    return () => { cancelled = true; video.removeAttribute("src"); video.load(); };
    // `key` résume `shots` : on ne relance la capture que si les instants ou les prises changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return thumbs;
}

type Props = {
  edit: Edit;
  words: CaptionWord[];
  videoUrl: string | null;
  /** Plusieurs prises : adresse de chaque prise (la première est videoUrl). */
  takeUrls?: Record<string, string>;
  /** Bibliothèque de médias : licence de chaque son et image utilisés (contrôle avant publication). */
  library?: MediaItem[];
  /** Idéation (lot S4) : rien n'est construit sans storyboard validé ; mot-clé du brief = mot-clé à l'écran. */
  storyboardApproved?: boolean;
  briefKeyword?: string | null;
  approved: boolean;
  approvedAt?: string | null;
  /** Modifications non enregistrées (brouillon d'animations, proposition de Bee) : la planche ne les montre pas. */
  unsaved: boolean;
  disabled?: boolean;
  onApprove: () => Promise<void>;
};

export default function StudioContactSheet({ edit, words, videoUrl, takeUrls, library = [], storyboardApproved = false, briefKeyword = null, approved, approvedAt, unsaved, disabled, onApprove }: Props) {
  const plans = useMemo(() => contactPlans(edit, words), [edit, words]);
  const shots = useMemo(() => {
    const strip = takeStrip(edit);
    return plans.flatMap((p) => {
      const sourceMs = Math.round(p.sourceMs);
      const take = strip[takeIndexAt(strip, sourceMs)];
      const url = take.file === edit.video ? videoUrl : takeUrls?.[take.file];
      return url ? [{ sourceMs, url, ms: sourceMs - take.fromMs }] : [];
    });
  }, [plans, edit, videoUrl, takeUrls]);
  const thumbs = useThumbnails(shots);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duration = totalMs(layout(edit.ranges));
  const keyword = edit.custom.find((c) => c.name === "mot-cle")?.props.mot;
  const checks: { ok: boolean; text: string }[] = [
    { ok: storyboardApproved, text: storyboardApproved ? "Storyboard validé" : "Storyboard non validé (onglet Idéation) : la planche ne peut pas être validée" },
    ...(briefKeyword ? [{ ok: keyword === briefKeyword, text: keyword === briefKeyword ? `Mot-clé à l'écran conforme au brief (${briefKeyword})` : `Le brief prévoit le mot-clé ${briefKeyword}, ${typeof keyword === "string" ? `l'écran affiche ${keyword}` : "absent de l'écran"}` }] : []),
    { ok: duration <= MAX_REEL_MS, text: `Durée montée ${sec(duration)} (3 min au plus pour un Reel)` },
    { ok: edit.subtitles, text: edit.subtitles ? "Sous-titres affichés" : "Sous-titres masqués" },
    { ok: typeof keyword === "string", text: typeof keyword === "string" ? `Mot-clé du CTA : ${keyword} (à créer dans le moteur de DM avant publication)` : "Aucun mot-clé à commenter (CTA) dans la vidéo" },
    ...usedMedia(edit).map((file) => {
      const item = library.find((x) => x.fileName === file);
      return { ok: Boolean(item?.licence), text: item ? `${item.kind === "son" ? "Son" : "Image"} « ${item.title} » — licence : ${item.licence}` : `Média « ${file} » absent de la bibliothèque` };
    }),
    ...(() => { const w = charteWarnings(edit); return w.length ? w.map((text) => ({ ok: false, text: `Charte : ${text}` })) : [{ ok: true, text: "Charte BeeRecos : palette bleu, noir, blanc ; logo de fin et baseline" }]; })(),
  ];

  const approve = async () => {
    setBusy(true); setError(null);
    try { await onApprove(); } catch (e) { setError(e instanceof Error ? e.message : "Validation impossible."); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-mut">Planche contact de la version enregistrée : une vignette par plan et par animation. Validez-la avant le rendu ; toute modification ensuite demandera une nouvelle validation.</p>
      <ul aria-label="Contrôles de la version" className="space-y-1 text-sm">
        {checks.map((c, i) => <li key={i} className={c.ok ? "" : "text-amber-800"}>{c.ok ? "✓" : "⚠"} {c.text}</li>)}
      </ul>
      <ol aria-label="Planche contact" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {plans.map((p) => {
          const thumb = thumbs[Math.round(p.sourceMs)];
          return (
            <li key={p.key} className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="relative aspect-[9/16] bg-black/80">
                {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center p-2 text-center text-[11px] text-white/70">{thumb === null ? "Image indisponible" : "Chargement…"}</span>}
                <span className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${p.kind === "animation" ? "bg-brand text-white" : "bg-white/90 text-black"}`}>{sec(p.outMs)}</span>
              </div>
              <div className="space-y-0.5 p-2">
                <p className="text-xs font-medium">{p.label}</p>
                <p className="line-clamp-3 text-[11px] text-mut">{p.text || "—"}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {unsaved ? <p role="status" className="text-sm text-amber-800">Des modifications ne sont pas enregistrées (animations ou proposition de Bee) : enregistrez-les ou écartez-les avant de valider la planche.</p> : null}
      {approved ? (
        <p role="status" className="text-sm">✅ Planche validée{approvedAt ? ` le ${new Date(approvedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}` : ""} : le rendu est possible (onglet Rendu).</p>
      ) : (
        <button type="button" className="btn-red min-h-[44px]" disabled={disabled || unsaved || busy || !storyboardApproved} aria-busy={busy} onClick={approve}>{busy ? "Validation…" : "Je valide cette planche"}</button>
      )}
      {error ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

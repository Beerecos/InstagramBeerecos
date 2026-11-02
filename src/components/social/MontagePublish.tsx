"use client";
import { useEffect, useState } from "react";
import StudioTransfer from "@/components/social/studio/StudioTransfer";
import { montage, type MontageDetail } from "@/lib/social/montage-api";

/**
 * RÉSEAUX SOCIAUX → MONTAGE → Rendu et publication (lot 3) : MP4 rendu par HeyGen (facturé à la minute, lancé
 * seulement sur clic), vérifié à l'écran, puis envoyé dans « Reels IA » au prochain créneau libre. La publication
 * suit ensuite le mode du Pilotage Instagram : en brouillon, rien n'est publié ; en auto, seulement avec
 * l'autorisation de la direction.
 */

const paris = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function MontagePublish({ m, onChange, onOpenPlanche, disabled = false, showTransfer = true, showVideo = true }: { disabled?: boolean; showTransfer?: boolean; showVideo?: boolean; m: MontageDetail; onChange: () => void; onOpenPlanche?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sentAt, setSentAt] = useState<string | null>(null);

  // Rendu en cours : l'état HeyGen est relu toutes les 10 s, et le MP4 archivé dès qu'il est prêt.
  useEffect(() => {
    if (m.renderStatus !== "rendering") return;
    const t = setInterval(() => {
      montage.renderStatus(m.id).then((r) => { if (r.renderStatus !== "rendering") onChange(); }).catch((e) => setError(e.message));
    }, 10_000);
    return () => clearInterval(t);
  }, [m.id, m.renderStatus, onChange]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); } finally { setBusy(null); }
  };

  if (m.sentToReels) {
    return (
      <div className="space-y-2 text-sm">
        <p>✅ Montage envoyé dans <strong>Reels IA</strong>{sentAt ? <> pour le créneau du <strong>{paris(sentAt)}</strong></> : null}.</p>
        <p className="text-mut">La publication suit le mode du Pilotage Instagram : en brouillon, rien n&apos;est publié ; en automatique, seulement avec l&apos;autorisation de la direction. Suivi dans Réseaux sociaux → Pilotage Instagram.</p>
        {m.finalVideoUrl ? <a className="btn-ghost inline-flex min-h-[40px] items-center" href={m.finalVideoUrl} target="_blank" rel="noreferrer">Voir le MP4 envoyé</a> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {m.renderStatus === "done" && m.finalVideoUrl ? (
        <div className="space-y-3">
          {showVideo ? <video src={m.finalVideoUrl} controls playsInline className="aspect-[9/16] w-full max-w-[240px] rounded-2xl bg-black" aria-label={`MP4 rendu de « ${m.title} »`} /> : null}
          <p className="text-sm text-mut">Regardez le MP4 en entier avant de l&apos;envoyer : c&apos;est le fichier rendu de cette version. Le transfert ne publie rien.</p>
          <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium">Avancé : envoyer dans la file Reels IA</summary>
          <p className="text-xs text-amber-800">Cette action utilise le prochain créneau et le mode du pilote Instagram. Elle est distincte du brouillon de post.</p>
          <label className="block text-sm font-medium">
            Légende du Reel
            <textarea rows={4} maxLength={2200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={m.reel ? `Vide = légende enregistrée sur ${m.reel.reelId} (elle reprend « ${m.reel.keyword} »).` : "Ce que dit la vidéo, en une ou deux phrases, puis le CTA (ex. « Commente CLUB… »)."} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-red min-h-[44px]" disabled={disabled || (!caption.trim() && !m.reel) || Boolean(busy)} aria-busy={busy === "send"}
              onClick={() => run("send", async () => { const r = await montage.toReel(m.id, caption); setSentAt(r.slotAt); onChange(); })}>
              {busy === "send" ? "Envoi…" : "Envoyer dans Reels IA"}
            </button>
            <button type="button" className="btn-ghost min-h-[44px]" disabled={disabled || !m.previewApproved || Boolean(busy)} onClick={() => run("render", async () => { await montage.render(m.id); onChange(); })}>Rendre à nouveau</button>
          </div>
          </details>
        </div>
      ) : m.renderStatus === "rendering" ? (
        <p role="status" className="text-sm">Rendu en cours chez HeyGen (quelques minutes). Vous pouvez quitter la page : le MP4 sera archivé au retour.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-mut">Le rendu HeyGen produit le MP4 1080×1920 identique à l&apos;aperçu. Il est facturé à la minute de vidéo (environ 0,10 $). Vérifiez l&apos;aperçu avant de lancer.</p>
          {m.renderStatus === "failed" && m.renderError ? <p role="alert" className="text-sm text-red-700">{m.renderError}</p> : null}
          {!m.previewApproved ? (
            <p role="status" className="text-sm text-amber-800">
              Validez d&apos;abord la planche contact de cette version : jamais de rendu sans accord sur l&apos;aperçu.{" "}
              {onOpenPlanche ? <button type="button" className="underline" onClick={onOpenPlanche}>Ouvrir la planche</button> : null}
            </p>
          ) : null}
          <button type="button" className="btn-red min-h-[44px]" disabled={disabled || !m.edit || !m.previewApproved || Boolean(busy)} aria-busy={busy === "render"}
            onClick={() => run("render", async () => { await montage.render(m.id); onChange(); })}>
            {busy === "render" ? "Préparation du rendu…" : m.renderStatus === "failed" ? "Relancer le rendu" : "Rendre le MP4"}
          </button>
        </div>
      )}
      {showTransfer ? <StudioTransfer sourceType="montage" sourceId={m.id} expectedSourceVersion={m.updatedAt} disabled={disabled || Boolean(busy)} /> : null}
      {error ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

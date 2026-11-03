"use client";
/**
 * Fenêtre « Publier sur Instagram » : récapitulatif, ce qui bloque encore, confirmation explicite (publication publique
 * et irréversible), puis suivi réel jusqu'à la réponse d'Instagram (aucune progression simulée).
 */
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Send } from "lucide-react";
import { publishBlockers, STATUS_LABELS, type Publication } from "@/domain/instagram/publication";
import { instagram } from "@/lib/instagram/api";

type Props = {
  /** Enregistre la création telle qu'affichée et renvoie la fiche à publier. */
  prepare: () => Promise<Publication>;
  current: Publication | null;
  connected: boolean;
  videoUrl?: string | null;
  onChange: (p: Publication) => void;
  disabled?: boolean;
};

export default function PublishButton({ prepare, current, connected, videoUrl, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Publication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = target ?? current;

  // Suivi : Instagram traite le média (quelques secondes pour une photo, quelques minutes pour un réel).
  useEffect(() => {
    if (live?.status !== "publishing") return;
    timer.current = setTimeout(async () => {
      try { const { item } = await instagram.get(live.id); setTarget(item); onChange(item); } catch (e) { setError(e instanceof Error ? e.message : "Suivi impossible."); }
    }, 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [live, onChange]);

  const openDialog = async () => {
    setError(null); setBusy(true);
    try { const p = await prepare(); setTarget(p); onChange(p); setOpen(true); } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };
  const go = async () => {
    if (!target) return;
    setBusy(true); setError(null);
    try { const { item } = await instagram.publish(target.id, videoUrl ?? undefined); setTarget(item); onChange(item); } catch (e) { setError(e instanceof Error ? e.message : "Publication refusée."); } finally { setBusy(false); }
  };

  const blockers = target ? publishBlockers(target, { connected, hasVideo: Boolean(videoUrl) }) : [];
  if (live?.status === "published") {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-acid-dim">
        Publié sur Instagram{live.publishedAt ? ` le ${new Date(live.publishedAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}` : ""}.
        {live.permalink ? <a href={live.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline">Voir le post <ExternalLink aria-hidden size={14} /></a> : null}
        {live.keyword ? <span className="text-mut">DM automatique actif pour « {live.keyword} ».</span> : null}
        {live.error ? <span role="alert" className="text-amber-800">{live.error}</span> : null}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {live?.status === "publishing" ? <p role="status" className="text-sm text-brand">Instagram traite le média… (cette page se met à jour toute seule)</p> : (
        <button type="button" className="btn-red min-h-11" disabled={disabled || busy} onClick={openDialog}><Send aria-hidden size={16} /> {busy && !open ? "Préparation…" : live?.status === "error" ? "Relancer la publication" : "Publier sur Instagram"}</button>
      )}
      {live?.status === "error" && live.error ? <p role="alert" className="text-sm text-red-700">{STATUS_LABELS.error} : {live.error}</p> : null}
      {error && !open ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {open && target ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="publier-titre" className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-auto p-5 text-sm">
            <h2 id="publier-titre" className="text-base font-semibold">Publier maintenant sur Instagram ?</h2>
            {target.status === "publishing" || target.status === "published" ? (
              <p role="status">{target.status === "published" ? "C'est publié." : "C'est parti : Instagram traite le média. Tu peux fermer cette fenêtre."}</p>
            ) : <>
              <p className="text-mut">Le post sera <strong className="text-fg">public tout de suite</strong>. Une publication ne s&apos;annule pas depuis l&apos;app.</p>
              <dl className="space-y-1 rounded-lg bg-black/[0.04] p-3">
                <div><dt className="inline font-medium">Format : </dt><dd className="inline">{target.kind === "reel" ? "Réel" : target.media.length > 1 ? `Carrousel de ${target.media.length} photos` : "Photo"}</dd></div>
                <div><dt className="font-medium">Légende :</dt><dd className="line-clamp-4 whitespace-pre-wrap">{target.caption || "—"}</dd></div>
                <div><dt className="inline font-medium">DM automatique : </dt><dd className="inline">{target.keyword ? `qui commente « ${target.keyword} » reçoit ton message${target.buttonTitle ? ` avec le bouton « ${target.buttonTitle} »` : ""}` : "aucun"}</dd></div>
              </dl>
              {blockers.length ? <ul className="list-disc space-y-1 pl-5 text-red-700" aria-label="À corriger avant de publier">{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
            </>}
            {error ? <p role="alert" className="text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost min-h-11" onClick={() => setOpen(false)}>{target.status === "draft" || target.status === "error" ? "Annuler" : "Fermer"}</button>
              {target.status === "draft" || target.status === "error" ? (
                <button type="button" className="btn-red min-h-11" disabled={busy || blockers.length > 0} onClick={go}>{busy ? "Envoi…" : "Oui, publier"}</button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";
/**
 * Fenêtre « Publier » : Instagram et/ou LinkedIn (case « Aussi sur LinkedIn »), récapitulatif, ce qui bloque encore,
 * confirmation explicite (publication publique et irréversible), puis suivi réel des réponses d'Instagram et de LinkedIn
 * (aucune progression simulée). Le texte LinkedIn est pré-rempli avec la légende et reste modifiable.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Send } from "lucide-react";
import { LINKEDIN_MAX, publishBlockers, STATUS_LABELS, type Publication } from "@/domain/instagram/publication";
import { instagram, type LinkedInView } from "@/lib/instagram/api";

type Props = {
  /** Enregistre la création telle qu'affichée et renvoie la fiche à publier. */
  prepare: () => Promise<Publication>;
  current: Publication | null;
  connected: boolean;
  videoUrl?: string | null;
  onChange: (p: Publication) => void;
  disabled?: boolean;
  /** Conditions propres à l'écran (ex. format du post) ajoutées aux règles communes. */
  extraBlockers?: string[];
};

const when = (iso: string | null) => (iso ? ` le ${new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}` : "");

export default function PublishButton({ prepare, current, connected, videoUrl, onChange, disabled, extraBlockers = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Publication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [li, setLi] = useState<LinkedInView | null>(null);
  const [nets, setNets] = useState({ ig: true, li: false });
  const [liText, setLiText] = useState("");
  const [liTarget, setLiTarget] = useState<"profil" | "page">("profil");
  const [sent, setSent] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = target ?? current;
  const igDone = live?.status === "published";
  const liDone = live?.linkedinStatus === "published";

  // Suivi : Instagram traite le média (quelques secondes pour une photo, quelques minutes pour un réel).
  useEffect(() => {
    if (live?.status !== "publishing") return;
    timer.current = setTimeout(async () => {
      try { const { item } = await instagram.get(live.id); setTarget(item); onChange(item); } catch (e) { setError(e instanceof Error ? e.message : "Suivi impossible."); }
    }, 5000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [live, onChange]);

  const openDialog = async () => {
    setError(null); setBusy(true); setSent(false);
    try {
      const p = await prepare();
      setTarget(p); onChange(p);
      const view = await instagram.linkedinConnection().catch(() => null);
      setLi(view);
      setNets({ ig: p.status !== "published", li: p.status === "published" && Boolean(view?.connected) && p.linkedinStatus !== "published" });
      setLiText(p.linkedinText ?? p.caption);
      setLiTarget(p.linkedinTarget === "page" && view?.page.allowed ? "page" : "profil");
      setOpen(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };

  const go = async () => {
    if (!target) return;
    setBusy(true); setError(null);
    const errors: string[] = [];
    let item = target;
    if (nets.ig && !igDone) {
      try { item = (await instagram.publish(target.id, videoUrl ?? undefined)).item; } catch (e) { errors.push(`Instagram : ${e instanceof Error ? e.message : "publication refusée."}`); }
    }
    if (nets.li && !liDone) {
      try { item = { ...(await instagram.linkedin(target.id, { text: liText, target: liTarget, videoUrl: videoUrl ?? undefined })).item, ...(nets.ig && !igDone ? { status: item.status, permalink: item.permalink, publishedAt: item.publishedAt, error: item.error } : {}) }; }
      catch (e) { errors.push(`LinkedIn : ${e instanceof Error ? e.message : "publication refusée."}`); }
    }
    setTarget(item); onChange(item); setSent(true);
    if (errors.length) setError(errors.join("\n"));
    setBusy(false);
  };

  const igBlockers = target && nets.ig && !igDone ? [...extraBlockers, ...publishBlockers(target, { connected, hasVideo: Boolean(videoUrl) })] : [];
  const liBlockers: string[] = [];
  if (target && nets.li && !liDone) {
    if (!li?.connected) liBlockers.push("LinkedIn n'est pas connecté (Paramètres → LinkedIn).");
    if (!liText.trim()) liBlockers.push("Le texte LinkedIn est vide.");
    if (liText.length > LINKEDIN_MAX) liBlockers.push(`Texte LinkedIn trop long (${liText.length} / ${LINKEDIN_MAX}).`);
    if (target.kind === "post" && !target.media.length) liBlockers.push("Ajoute au moins une photo.");
    if (target.kind === "reel" && !videoUrl) liBlockers.push("Le MP4 du réel n'est pas encore rendu.");
  }
  const blockers = [...new Set([...igBlockers, ...liBlockers])];
  const nothing = target ? !(nets.ig && !igDone) && !(nets.li && !liDone) : true;

  const summary = live && (igDone || liDone) ? (
    <div role="status" className="space-y-1 text-sm text-acid-dim">
      {igDone ? <p className="flex flex-wrap items-center gap-2">Publié sur Instagram{when(live.publishedAt)}.
        {live.permalink ? <a href={live.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline">Voir le post <ExternalLink aria-hidden size={14} /></a> : null}
        {live.keyword ? <span className="text-mut">DM automatique actif pour « {live.keyword} ».</span> : null}
        {live.error ? <span role="alert" className="text-amber-800">{live.error}</span> : null}</p> : null}
      {liDone ? <p className="flex flex-wrap items-center gap-2">Publié sur LinkedIn{when(live.linkedinPublishedAt)}.
        {live.linkedinUrl ? <a href={live.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand underline">Voir sur LinkedIn <ExternalLink aria-hidden size={14} /></a> : null}</p> : null}
    </div>
  ) : null;

  return (
    <div className="space-y-2">
      {summary}
      {live?.status === "publishing" ? <p role="status" className="text-sm text-brand">Instagram traite le média… (cette page se met à jour toute seule)</p> : null}
      {!(igDone && liDone) && live?.status !== "publishing" ? (
        <button type="button" className="btn-red min-h-11" disabled={disabled || busy} onClick={openDialog}><Send aria-hidden size={16} /> {busy && !open ? "Préparation…" : igDone ? "Publier aussi sur LinkedIn" : live?.status === "error" ? "Relancer la publication" : "Publier"}</button>
      ) : null}
      {live?.status === "error" && live.error ? <p role="alert" className="text-sm text-red-700">{STATUS_LABELS.error} Instagram : {live.error}</p> : null}
      {live?.linkedinStatus === "error" && live.linkedinError ? <p role="alert" className="text-sm text-red-700">{STATUS_LABELS.error} LinkedIn : {live.linkedinError}</p> : null}
      {error && !open ? <p role="alert" className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
      {/* Fenêtre rendue au niveau de la page : jamais sous la barre d'actions ni sous le menu mobile. */}
      {open && target ? createPortal(
        <div role="alertdialog" aria-modal="true" aria-labelledby="publier-titre" className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
          <div className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto p-5 text-sm">
            <h2 id="publier-titre" className="text-base font-semibold">Publier maintenant ?</h2>
            {sent && !error ? (
              <p role="status">{target.status === "publishing" ? "C'est parti : Instagram traite le média. Tu peux fermer cette fenêtre." : "C'est publié."}</p>
            ) : <>
              <p className="text-mut">Le post sera <strong className="text-fg">public tout de suite</strong>. Une publication ne s&apos;annule pas depuis l&apos;app.</p>
              <fieldset className="space-y-2">
                <legend className="mb-1 font-medium">Où publier ?</legend>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3">
                  <input type="checkbox" checked={nets.ig && !igDone} disabled={igDone} onChange={(e) => setNets((n) => ({ ...n, ig: e.target.checked }))} className="size-5 accent-[#2851FF]" />
                  <span className="flex-1">Instagram</span>{igDone ? <span className="text-xs text-acid-dim">déjà publié</span> : null}
                </label>
                <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3">
                  <input type="checkbox" checked={nets.li && !liDone} disabled={liDone} onChange={(e) => setNets((n) => ({ ...n, li: e.target.checked }))} className="size-5 accent-[#2851FF]" />
                  <span className="flex-1">Aussi sur LinkedIn</span>
                  <span className="text-xs text-mut">{liDone ? "déjà publié" : li?.connected ? li.name ?? "" : "non connecté"}</span>
                </label>
              </fieldset>
              {nets.ig && !igDone ? (
                <dl className="space-y-1 rounded-lg bg-black/[0.04] p-3">
                  <div><dt className="inline font-medium">Format : </dt><dd className="inline">{target.kind === "reel" ? "Réel" : target.media.length > 1 ? `Carrousel de ${target.media.length} photos` : "Photo"}</dd></div>
                  <div><dt className="font-medium">Légende Instagram :</dt><dd className="line-clamp-4 whitespace-pre-wrap">{target.caption || "—"}</dd></div>
                  <div><dt className="inline font-medium">DM automatique : </dt><dd className="inline">{target.keyword ? `qui commente « ${target.keyword} » reçoit ton message${target.buttonTitle ? ` avec le bouton « ${target.buttonTitle} »` : ""}` : "aucun"}</dd></div>
                </dl>
              ) : null}
              {nets.li && !liDone ? (
                <div className="space-y-2 rounded-lg bg-black/[0.04] p-3">
                  <div role="radiogroup" aria-label="Publier sur LinkedIn en tant que" className="grid grid-cols-2 gap-2">
                    {(["profil", "page"] as const).map((t) => {
                      const off = t === "page" && !li?.page.allowed;
                      return (
                        <button key={t} type="button" role="radio" aria-checked={liTarget === t} disabled={off} onClick={() => setLiTarget(t)}
                          className={`min-h-11 rounded-lg border px-3 text-left disabled:opacity-40 ${liTarget === t ? "border-brand bg-white ring-2 ring-brand/30" : "border-line bg-white/70"}`}>
                          <span className="block font-medium">{t === "profil" ? "Mon profil" : "Page BeeRecos"}</span>
                          {off ? <span className="text-xs text-mut">{li?.page.configured ? "en attente de LinkedIn" : "non configurée"}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                  <label className="block font-medium">Texte LinkedIn
                    <textarea rows={6} maxLength={LINKEDIN_MAX} value={liText} onChange={(e) => setLiText(e.target.value)} className="mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 font-normal" />
                    <span className="mt-1 flex justify-between text-xs font-normal text-mut"><span>Pas de DM automatique sur LinkedIn : adapte l&apos;appel à l&apos;action si besoin.</span><span>{liText.length} / {LINKEDIN_MAX}</span></span>
                  </label>
                </div>
              ) : null}
              {blockers.length ? <ul className="list-disc space-y-1 pl-5 text-red-700" aria-label="À corriger avant de publier">{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
            </>}
            {error ? <p role="alert" className="whitespace-pre-line text-red-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost min-h-11" onClick={() => setOpen(false)}>{sent ? "Fermer" : "Annuler"}</button>
              {!sent || error ? (
                <button type="button" className="btn-red min-h-11" disabled={busy || nothing || blockers.length > 0} onClick={go}>{busy ? "Envoi…" : "Oui, publier"}</button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

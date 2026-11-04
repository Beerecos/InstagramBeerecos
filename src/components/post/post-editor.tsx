"use client";
/**
 * Éditeur de post (photo ou carrousel), en pleine page : à gauche photos, légende, mot-clé et DM ; à droite l'aperçu
 * tel qu'il apparaîtra sur Instagram. Le Studio n'est pas utilisé ici (il ne s'ouvre que pour un réel).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, MessageCircle, Trash2, X } from "lucide-react";
import { CAPTION_MAX, MEDIA_MAX, STATUS_LABELS, mentionsKeyword, normalizeKeyword, type Publication } from "@/domain/instagram/publication";
import { instagram, uploadPhoto } from "@/lib/instagram/api";
import PublishButton from "./publish-dialog";

type Photo = { path: string; url: string };

/** Aperçu façon Instagram : en-tête du compte, photo(s) au format 4:5 avec points du carrousel, légende. */
function Preview({ photos, caption, username, keyword }: { photos: Photo[]; caption: string; username: string; keyword: string }) {
  const [i, setI] = useState(0);
  const at = Math.min(i, Math.max(0, photos.length - 1));
  return (
    <figure aria-label="Aperçu Instagram" className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[28px] border border-line bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">B</span>
        <span className="text-sm font-semibold">{username}</span>
      </div>
      <div className="relative aspect-[4/5] bg-black/[0.06]">
        {photos[at]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo locale ou lien signé court
          <img src={photos[at].url} alt={`Aperçu de la photo ${at + 1}`} className="h-full w-full object-cover" />
        ) : <span className="absolute inset-0 grid place-items-center text-sm text-mut">{photos.length ? "Aperçu indisponible" : "Ajoute une photo"}</span>}
        {photos.length > 1 ? <>
          {at > 0 ? <button type="button" aria-label="Photo précédente" onClick={() => setI(at - 1)} className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90"><ChevronLeft aria-hidden size={16} /></button> : null}
          {at < photos.length - 1 ? <button type="button" aria-label="Photo suivante" onClick={() => setI(at + 1)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/90"><ChevronRight aria-hidden size={16} /></button> : null}
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{at + 1}/{photos.length}</span>
        </> : null}
      </div>
      {photos.length > 1 ? <div className="flex justify-center gap-1 pt-2" aria-hidden>{photos.map((p, k) => <span key={p.path} className={`size-1.5 rounded-full ${k === at ? "bg-brand" : "bg-black/20"}`} />)}</div> : null}
      <figcaption className="space-y-1 px-3 pb-4 pt-2 text-sm">
        <p className="whitespace-pre-wrap break-words"><span className="font-semibold">{username}</span> {caption || <span className="text-mut">Ta légende apparaîtra ici.</span>}</p>
        {keyword ? <p className="flex items-center gap-1 text-xs text-mut"><MessageCircle aria-hidden size={12} /> Qui commente « {keyword} » reçoit ton DM automatiquement.</p> : null}
      </figcaption>
    </figure>
  );
}

export default function PostEditor({ id }: { id: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(id));
  const [current, setCurrent] = useState<Publication | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState("");
  const [keyword, setKeyword] = useState("");
  const [dmText, setDmText] = useState("");
  const [buttonTitle, setButtonTitle] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState("beerecos");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    instagram.connection().then((c) => { setConnected(c.connected); if (c.username) setUsername(c.username); }).catch(() => {});
    if (!id) return;
    let alive = true;
    instagram.get(id).then(({ item, previews }) => {
      if (!alive) return;
      setCurrent(item);
      setPhotos(item.media.map((m) => ({ path: m.path, url: previews[m.path] ?? "" })));
      setCaption(item.caption); setKeyword(item.keyword ?? ""); setDmText(item.dmText ?? "");
      setButtonTitle(item.buttonTitle ?? ""); setButtonUrl(item.buttonUrl ?? "");
    }).catch((e: Error) => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const locked = current?.status === "publishing" || current?.status === "published";
  const kw = normalizeKeyword(keyword);
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); setNotice(null); };

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MEDIA_MAX - photos.length;
    if (room <= 0) { setError(`${MEDIA_MAX} photos au plus.`); return; }
    setBusy("photos"); setError(null); setNotice(null);
    try {
      let cropped = false;
      for (const file of Array.from(files).slice(0, room)) {
        const r = await uploadPhoto(file);
        cropped ||= r.cropped;
        setPhotos((p) => [...p, { path: r.path, url: URL.createObjectURL(file) }]);
      }
      setDirty(true);
      if (files.length > room) setNotice(`Seules ${room} photo(s) ajoutée(s) : ${MEDIA_MAX} au plus.`);
      else if (cropped) setNotice("Photo recadrée au centre pour le format Instagram (entre 4:5 et 1,91:1).");
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible."); } finally { setBusy(null); }
  };

  const save = async (): Promise<Publication> => {
    const { item } = await instagram.save({
      id: current?.id, kind: "post", title: caption.split("\n")[0].slice(0, 80), caption,
      media: photos.map((p) => ({ path: p.path, type: "image" as const })),
      keyword: kw, dmText: kw ? dmText : "", buttonTitle: kw ? buttonTitle : "", buttonUrl: kw ? buttonUrl : "",
    });
    setCurrent(item); setDirty(false);
    // Adresse du post créé, sans recharger l'éditeur (le message « enregistré » reste affiché).
    if (!id) window.history.replaceState(null, "", `/post/${item.id}`);
    return item;
  };
  const saveDraft = async () => {
    setBusy("save"); setError(null);
    try { await save(); setNotice("Brouillon enregistré."); } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (current) {
      setBusy("delete");
      try { await instagram.remove(current.id); } catch (e) { setError(e instanceof Error ? e.message : "Suppression impossible."); setBusy(null); return; }
    }
    router.push("/");
  };

  const field = "mt-1 block w-full rounded-lg border border-line bg-white px-3 font-normal";
  if (loading) return <p role="status" className="p-6 text-sm text-mut">Chargement du post…</p>;
  return (
    <div className="social-studio -mx-4 min-h-full px-4 py-2 sm:-mx-8 sm:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-mut hover:bg-black/[0.05]"><ArrowLeft aria-hidden size={16} /> Post</Link>
        <h1 className="font-display text-2xl font-semibold">{current ? "Éditeur de post" : "Nouveau post"}</h1>
        {current ? <span className="pill bg-black/[0.05] text-mut">{STATUS_LABELS[current.status]}</span> : null}
      </header>

      {error && !current && id ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <fieldset disabled={locked} className="space-y-5 text-sm">
            <section aria-labelledby="photos-titre">
              <h2 id="photos-titre" className="font-medium">Photos <span className="font-normal text-mut">({photos.length}/{MEDIA_MAX} · plusieurs = carrousel)</span></h2>
              <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {photos.map((p, i) => (
                  <li key={p.path} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- photo locale ou lien signé court */}
                    {p.url ? <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-mut">Photo {i + 1}</span>}
                    {!locked ? <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => { setPhotos((all) => all.filter((x) => x.path !== p.path)); setDirty(true); }} className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-white/90"><X aria-hidden size={14} /></button> : null}
                  </li>
                ))}
                {photos.length < MEDIA_MAX && !locked ? (
                  <li><label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line text-mut hover:border-brand hover:text-brand">
                    <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus aria-hidden size={20} />{busy === "photos" ? "Envoi…" : "Ajouter"}</span>
                    <input type="file" accept="image/*" multiple className="sr-only" aria-label="Ajouter des photos" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
                  </label></li>
                ) : null}
              </ul>
            </section>
            <label className="block font-medium">Légende
              <textarea rows={7} maxLength={CAPTION_MAX} value={caption} onChange={(e) => edit(setCaption)(e.target.value)} className={`${field} py-2`} placeholder="Ton texte, tes hashtags…" />
              <span className="mt-1 block text-right text-xs font-normal text-mut">{caption.length} / {CAPTION_MAX}</span>
            </label>
            <label className="block font-medium">Mot-clé pour recevoir un DM <span className="font-normal text-mut">(facultatif)</span>
              <input value={keyword} onChange={(e) => edit(setKeyword)(normalizeKeyword(e.target.value))} placeholder="CLUB" className={`${field} min-h-11 uppercase`} />
            </label>
            {kw ? (
              <div className="space-y-3 rounded-xl bg-brand-soft/50 p-3">
                {!mentionsKeyword(caption, kw) ? (
                  <p className="flex flex-wrap items-center gap-2 text-amber-800">La légende ne dit pas encore de commenter {kw}.
                    <button type="button" className="btn-ghost min-h-9" onClick={() => edit(setCaption)(`${caption.trimEnd()}${caption.trim() ? "\n\n" : ""}Commente ${kw} et je t'envoie le lien en DM.`)}>Ajouter « Commente {kw} »</button>
                  </p>
                ) : null}
                <label className="block font-medium">Message envoyé en DM
                  <textarea rows={3} maxLength={900} value={dmText} onChange={(e) => edit(setDmText)(e.target.value)} className={`${field} py-2`} placeholder="Merci ! Voici le lien promis :" />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block font-medium">Bouton <span className="font-normal text-mut">(facultatif)</span><input maxLength={20} value={buttonTitle} onChange={(e) => edit(setButtonTitle)(e.target.value)} placeholder="Ouvrir" className={`${field} min-h-11`} /></label>
                  <label className="block font-medium">Lien du bouton<input value={buttonUrl} onChange={(e) => edit(setButtonUrl)(e.target.value.trim())} placeholder="https://" className={`${field} min-h-11`} /></label>
                </div>
              </div>
            ) : null}
          </fieldset>
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Preview photos={photos} caption={caption} username={username} keyword={kw} />
          </aside>
        </div>
      )}

      <footer className="sticky bottom-0 z-10 -mx-4 mt-6 space-y-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        {notice ? <p role="status" className="text-sm text-mut">{notice}</p> : null}
        {error && (current || !id) ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!locked ? <button type="button" className="btn-ghost min-h-11 text-red-700" disabled={Boolean(busy)} onClick={remove}><Trash2 aria-hidden size={16} /> {current ? "Supprimer" : "Annuler"}</button> : <span />}
          <div className="flex flex-wrap items-center gap-2">
            {!locked ? <span className="text-xs text-mut">{dirty ? "Modifications non enregistrées" : current ? "Enregistré" : ""}</span> : null}
            {!locked ? <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy)} onClick={saveDraft}>{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button> : null}
            <PublishButton prepare={save} current={current} connected={connected} onChange={setCurrent} disabled={Boolean(busy)} />
          </div>
        </div>
      </footer>
    </div>
  );
}

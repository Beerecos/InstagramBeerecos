"use client";
/**
 * Post simple (photo ou carrousel) : photos, légende, mot-clé facultatif et DM envoyé à ceux qui le commentent.
 * Le moins de champs possible ; le DM n'apparaît que si un mot-clé est saisi.
 */
import { useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { CAPTION_MAX, MEDIA_MAX, mentionsKeyword, normalizeKeyword, type Publication } from "@/domain/instagram/publication";
import { instagram, uploadPhoto } from "@/lib/instagram/api";
import PublishButton from "./publish-dialog";

type Props = { initial: Publication | null; previews: Record<string, string>; connected: boolean; onClose: () => void; onSaved: (p: Publication) => void; onDeleted: (id: string) => void };
type Photo = { path: string; url: string };

export default function PostForm({ initial, previews, connected, onClose, onSaved, onDeleted }: Props) {
  const [current, setCurrent] = useState<Publication | null>(initial);
  const [photos, setPhotos] = useState<Photo[]>(() => (initial?.media ?? []).map((m) => ({ path: m.path, url: previews[m.path] ?? "" })));
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [keyword, setKeyword] = useState(initial?.keyword ?? "");
  const [dmText, setDmText] = useState(initial?.dmText ?? "");
  const [buttonTitle, setButtonTitle] = useState(initial?.buttonTitle ?? "");
  const [buttonUrl, setButtonUrl] = useState(initial?.buttonUrl ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = current?.status === "publishing" || current?.status === "published";
  const kw = normalizeKeyword(keyword);

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
      if (cropped) setNotice("Photo recadrée au centre pour le format Instagram (entre 4:5 et 1,91:1).");
      if (files.length > room) setNotice(`Seules ${room} photo(s) ajoutée(s) : ${MEDIA_MAX} au plus.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible."); } finally { setBusy(null); }
  };

  const save = async (): Promise<Publication> => {
    const { item } = await instagram.save({
      id: current?.id, kind: "post", title: caption.split("\n")[0].slice(0, 80), caption,
      media: photos.map((p) => ({ path: p.path, type: "image" as const })),
      keyword: kw, dmText: kw ? dmText : "", buttonTitle: kw ? buttonTitle : "", buttonUrl: kw ? buttonUrl : "",
    });
    setCurrent(item); onSaved(item);
    return item;
  };
  const saveDraft = async () => {
    setBusy("save"); setError(null);
    try { await save(); setNotice("Brouillon enregistré."); } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (!current) { onClose(); return; }
    setBusy("delete");
    try { await instagram.remove(current.id); onDeleted(current.id); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Suppression impossible."); setBusy(null); }
  };

  const field = "mt-1 block w-full rounded-lg border border-line bg-white px-3";
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="post-titre" className="fixed inset-0 z-50 grid place-items-center bg-black/40 sm:p-4">
      <div className="card flex h-full w-full max-w-lg flex-col overflow-hidden sm:h-auto sm:max-h-[92vh]">
        <header className="flex items-center justify-between border-b border-line p-4">
          <h2 id="post-titre" className="font-semibold">{current ? "Post" : "Nouveau post"}</h2>
          <button type="button" aria-label="Fermer" className="grid size-10 place-items-center rounded-lg hover:bg-black/[0.05]" onClick={onClose}><X aria-hidden size={18} /></button>
        </header>
        <fieldset disabled={locked} className="flex-1 space-y-4 overflow-auto p-4 text-sm">
          <div>
            <p className="font-medium">Photos <span className="font-normal text-mut">({photos.length}/{MEDIA_MAX} · plusieurs = carrousel)</span></p>
            <ul className="mt-2 grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <li key={p.path} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- photo locale ou lien signé court */}
                  {p.url ? <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-mut">Photo {i + 1}</span>}
                  {!locked ? <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => setPhotos((all) => all.filter((x) => x.path !== p.path))} className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-white/90"><X aria-hidden size={14} /></button> : null}
                </li>
              ))}
              {photos.length < MEDIA_MAX && !locked ? (
                <li><label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line text-mut hover:border-brand hover:text-brand">
                  <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus aria-hidden size={20} />{busy === "photos" ? "Envoi…" : "Ajouter"}</span>
                  <input type="file" accept="image/*" multiple className="sr-only" aria-label="Ajouter des photos" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
                </label></li>
              ) : null}
            </ul>
          </div>
          <label className="block font-medium">Légende
            <textarea rows={5} maxLength={CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} className={`${field} py-2 font-normal`} placeholder="Ton texte, tes hashtags…" />
            <span className="mt-1 block text-right text-xs font-normal text-mut">{caption.length} / {CAPTION_MAX}</span>
          </label>
          <label className="block font-medium">Mot-clé pour recevoir un DM <span className="font-normal text-mut">(facultatif)</span>
            <input value={keyword} onChange={(e) => setKeyword(normalizeKeyword(e.target.value))} placeholder="CLUB" className={`${field} min-h-11 font-normal uppercase`} />
          </label>
          {kw ? (
            <div className="space-y-3 rounded-xl bg-brand-soft/50 p-3">
              {!mentionsKeyword(caption, kw) ? (
                <p className="flex flex-wrap items-center gap-2 text-amber-800">La légende ne dit pas encore de commenter {kw}.
                  <button type="button" className="btn-ghost min-h-9" onClick={() => setCaption((c) => `${c.trimEnd()}${c.trim() ? "\n\n" : ""}Commente ${kw} et je t'envoie le lien en DM.`)}>Ajouter « Commente {kw} »</button>
                </p>
              ) : null}
              <label className="block font-medium">Message envoyé en DM
                <textarea rows={3} maxLength={900} value={dmText} onChange={(e) => setDmText(e.target.value)} className={`${field} py-2 font-normal`} placeholder="Merci ! Voici le lien promis :" />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block font-medium">Bouton <span className="font-normal text-mut">(facultatif)</span><input maxLength={20} value={buttonTitle} onChange={(e) => setButtonTitle(e.target.value)} placeholder="Ouvrir" className={`${field} min-h-11 font-normal`} /></label>
                <label className="block font-medium">Lien du bouton<input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value.trim())} placeholder="https://" className={`${field} min-h-11 font-normal`} /></label>
              </div>
            </div>
          ) : null}
        </fieldset>
        <footer className="space-y-2 border-t border-line p-4">
          {notice ? <p role="status" className="text-sm text-mut">{notice}</p> : null}
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {!locked ? <button type="button" className="btn-ghost min-h-11 text-red-700" disabled={Boolean(busy)} onClick={remove}><Trash2 aria-hidden size={16} /> {current ? "Supprimer" : "Annuler"}</button> : <span />}
            <div className="flex flex-wrap gap-2">
              {!locked ? <button type="button" className="btn-ghost min-h-11" disabled={Boolean(busy)} onClick={saveDraft}>{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button> : null}
              <PublishButton prepare={save} current={current} connected={connected} onChange={(p) => { setCurrent(p); onSaved(p); }} disabled={Boolean(busy)} />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

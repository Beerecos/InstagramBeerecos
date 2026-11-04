"use client";
/**
 * Éditeur de post, en pleine page : format (post simple = 1 photo, carrousel = 2 à 10, dans l'ordre choisi), légende
 * (écrite à la main ou proposée par l'IA, jamais remplacée sans clic), mot-clé et DM ; à droite l'aperçu Instagram.
 * Le Studio n'est pas utilisé ici (il ne s'ouvre que pour un réel).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, MessageCircle, Sparkles, Trash2, X } from "lucide-react";
import { CAPTION_MAX, STATUS_LABELS, formatBlockers, formatOf, mentionsKeyword, normalizeKeyword, photoLimit, type PostFormat, type Publication } from "@/domain/instagram/publication";
import { generateEditorialText } from "@/lib/social/editorial-api";
import { INSPI_KEYWORD, storyBrief, storyLength, withInspiEnding } from "@/domain/instagram/story-caption";
import { INSPIBEEZNESS_CAROUSEL_PROMPT, INSPIBEEZNESS_PROMPT_VERSION } from "@/domain/instagram/presets/inspibeezness";
import { instagram, uploadPhoto } from "@/lib/instagram/api";
import PublishButton from "./publish-dialog";
import CarouselBuilder from "./carousel-builder";

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
          <img src={photos[at].url} alt={`Aperçu de la photo ${at + 1}`} className="h-full w-full object-contain" />
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
        {keyword ? <p className="flex items-center gap-1 text-xs text-mut"><MessageCircle aria-hidden size={12} /> DM prévu pour « {keyword} » après publication et activation de la connexion.</p> : null}
      </figcaption>
    </figure>
  );
}

export default function PostEditor({ id, initialFormat = "simple" }: { id: string | null; initialFormat?: PostFormat }) {
  const router = useRouter();
  const previewUrls = useRef<string[]>([]);
  const uploadInFlight = useRef(false);
  const [uploadProgress, setUploadProgress] = useState("");
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
  const [format, setFormat] = useState<PostFormat>(initialFormat);
  const [brief, setBrief] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  // Carrousel : légende courte, ou InspiBEEz'ness « raconter toute l'histoire » à partir des faits fournis.
  const [captionMode, setCaptionMode] = useState<"courte" | "histoire">("courte");
  const [facts, setFacts] = useState("");
  const story = format === "carrousel" && captionMode === "histoire";
  const [promptCopied, setPromptCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [carouselBusy, setCarouselBusy] = useState(false);
  const working = Boolean(busy) || carouselBusy;
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    instagram.connection().then((c) => { setConnected(c.connected); if (c.username) setUsername(c.username); }).catch(() => {});
    if (!id) return;
    let alive = true;
    instagram.get(id).then(({ item, previews }) => {
      if (!alive) return;
      setCurrent(item);
      setFormat(formatOf(item.media.length));
      setPhotos(item.media.map((m) => ({ path: m.path, url: previews[m.path] ?? "" })));
      setCaption(item.caption); setKeyword(item.keyword ?? ""); setDmText(item.dmText ?? "");
      setButtonTitle(item.buttonTitle ?? ""); setButtonUrl(item.buttonUrl ?? "");
    }).catch((e: Error) => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => () => { previewUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);
  useEffect(() => {
    if (!dirty && !working) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, working]);

  const locked = current?.status === "publishing" || current?.status === "published";
  const kw = normalizeKeyword(keyword);
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); setNotice(null); };

  const add = async (files: FileList | null) => {
    if (!files?.length || uploadInFlight.current) return;
    const limit = photoLimit(format);
    const room = limit - photos.length;
    if (room <= 0) { setError(format === "simple" ? "Un post simple n'a qu'une photo : passe en carrousel pour en ajouter." : `${limit} photos au plus.`); return; }
    uploadInFlight.current = true;
    setBusy("photos"); setError(null); setNotice(null);
    try {
      let cropped = false;
      const selected = Array.from(files).slice(0, room);
      let done = 0;
      for (const file of selected) {
        setUploadProgress(`Photo ${done + 1} sur ${selected.length}…`);
        const r = await uploadPhoto(file);
        cropped ||= r.cropped;
        const url = URL.createObjectURL(r.preview);
        previewUrls.current.push(url);
        setPhotos((p) => [...p, { path: r.path, url }]);
        setDirty(true);
        done++;
      }
      setDirty(true);
      if (files.length > room) setNotice(`Seules ${room} photo(s) ajoutée(s) : ${limit} au plus pour ce format.`);
      else if (cropped) setNotice("Photo recadrée au centre pour le format Instagram (entre 4:5 et 1,91:1).");
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible."); } finally { uploadInFlight.current = false; setUploadProgress(""); setBusy(null); }
  };

  const move = (from: number, to: number) => {
    setPhotos((all) => { const next = [...all]; const [p] = next.splice(from, 1); next.splice(to, 0, p); return next; });
    setDirty(true);
  };
  // Légende proposée par l'IA (fonction BeeMarketing editorial-generate : mémoire de marque et affirmations interdites).
  // Une proposition ne remplace jamais la légende sans ton clic.
  const propose = async () => {
    setBusy("ia"); setError(null); setSuggestion(null);
    try {
      if (story) {
        const text = await generateEditorialText({ channel: "instagram", workspaceId: null, brief: storyBrief(brief, facts) });
        setSuggestion(withInspiEnding(text));
        return;
      }
      const text = await generateEditorialText({
        channel: "instagram", workspaceId: null,
        brief: `${format === "carrousel" ? `Carrousel de ${photos.length || "plusieurs"} photos` : "Post photo"} Instagram BeeRecos. Sujet : ${brief.trim()}`,
        ...(kw ? { cta: `Commente ${kw} pour recevoir le lien en DM` } : {}),
        ...(caption.trim() ? { currentText: caption } : {}),
      });
      setSuggestion(text.trim());
    } catch (e) { setError(e instanceof Error ? e.message : "La génération n'a pas abouti. Ta légende est conservée."); } finally { setBusy(null); }
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
    if ((current || dirty) && !window.confirm(current ? "Supprimer ce brouillon ? Cette action est définitive." : "Abandonner ce post et ses modifications ?")) return;
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
        <Link href="/" onClick={(event) => { if ((dirty || working) && !window.confirm("Quitter sans enregistrer les modifications du post ?")) event.preventDefault(); }} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm text-mut hover:bg-black/[0.05]"><ArrowLeft aria-hidden size={16} /> Post</Link>
        <h1 className="font-display text-2xl font-semibold">{current ? "Éditeur de post" : format === "carrousel" ? "Nouveau carrousel" : "Nouveau post"}</h1>
        {current ? <span className="pill bg-black/[0.05] text-mut">{STATUS_LABELS[current.status]}</span> : null}
      </header>

      {error && !current && id ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <fieldset disabled={locked || working} className="min-w-0 space-y-5 text-sm">
            <div role="radiogroup" aria-label="Format" className="inline-flex rounded-xl bg-black/[0.05] p-1">
              {(["simple", "carrousel"] as const).map((f) => {
                const blocked = f === "simple" && photos.length > 1;
                return (
                  <button key={f} type="button" role="radio" aria-checked={format === f} disabled={blocked} title={blocked ? "Retire des photos pour passer en post simple" : undefined}
                    onClick={() => { setFormat(f); setDirty(true); }}
                    className={`min-h-10 rounded-lg px-4 text-sm font-medium transition ${format === f ? "bg-white text-fg shadow-sm" : "text-mut hover:text-fg"} disabled:opacity-40`}>
                    {f === "simple" ? "Post simple" : "Carrousel"}
                  </button>
                );
              })}
            </div>
            {format === "carrousel" && !locked ? <CarouselBuilder onBusyChange={setCarouselBusy} subject={brief} facts={facts} onSubjectChange={setBrief} onFactsChange={setFacts} disabled={working} onDone={(slides) => { setPhotos(slides); setDirty(true); }} existingPhotos={photos.length} /> : null}
            <section aria-labelledby="photos-titre">
              <h2 id="photos-titre" className="font-medium">{format === "simple" ? "Photo" : "Photos"} <span className="font-normal text-mut">{format === "simple" ? "(une seule)" : `(${photos.length}/${photoLimit("carrousel")} · 2 au moins)`}</span></h2>
              <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {photos.map((p, i) => (
                  <li key={p.path} className="relative aspect-[4/5] overflow-hidden rounded-lg bg-black/[0.06]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- photo locale ou lien signé court */}
                    {p.url ? <img src={p.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs text-mut">Photo {i + 1}</span>}
                    {!locked ? <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => { setPhotos((all) => all.filter((x) => x.path !== p.path)); setDirty(true); }} className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-white/90"><X aria-hidden size={14} /></button> : null}
                    {!locked && photos.length > 1 ? (
                      <span className="absolute inset-x-1 bottom-1 flex justify-between">
                        <button type="button" aria-label={`Avancer la photo ${i + 1}`} disabled={i === 0} onClick={() => move(i, i - 1)} className="grid size-7 place-items-center rounded-md bg-white/90 disabled:invisible"><ChevronLeft aria-hidden size={14} /></button>
                        <button type="button" aria-label={`Reculer la photo ${i + 1}`} disabled={i === photos.length - 1} onClick={() => move(i, i + 1)} className="grid size-7 place-items-center rounded-md bg-white/90 disabled:invisible"><ChevronRight aria-hidden size={14} /></button>
                      </span>
                    ) : null}
                  </li>
                ))}
                {photos.length < photoLimit(format) && !locked ? (
                  <li><label className="grid aspect-[4/5] cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line text-mut hover:border-brand hover:text-brand">
                    <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus aria-hidden size={20} />{busy === "photos" ? uploadProgress : "Ajouter"}</span>
                    <input type="file" accept="image/*" multiple className="sr-only" aria-label="Ajouter des photos" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
                  </label></li>
                ) : null}
              </ul>
            </section>
            <section aria-labelledby="ia-titre" className="space-y-2 rounded-xl border border-brand/20 bg-brand-soft/40 p-3">
              <h2 id="ia-titre" className="flex items-center gap-2 font-medium"><Sparkles aria-hidden size={16} className="text-brand" /> Écrire la légende avec l&apos;IA</h2>
              {format === "carrousel" ? (
                <div role="radiogroup" aria-label="Type de légende" className="grid gap-2 sm:grid-cols-2">
                  {([["courte", "Courte", "Quelques lignes et un appel à l'action."], ["histoire", "InspiBEEz'ness", "Raconter toute l'histoire, de l'origine au résultat."]] as const).map(([key, label, hint]) => (
                    <button key={key} type="button" role="radio" aria-checked={captionMode === key}
                      onClick={() => { setCaptionMode(key); setSuggestion(null); if (key === "histoire" && !keyword) edit(setKeyword)(INSPI_KEYWORD); }}
                      className={`rounded-xl border p-3 text-left text-sm transition ${captionMode === key ? "border-brand bg-white ring-2 ring-brand/30" : "border-line bg-white/60 hover:border-brand"}`}>
                      <span className="block font-semibold">{label}</span><span className="text-xs text-mut">{hint}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="block text-sm">{story ? "Sujet de l'histoire" : "De quoi parle ce post ?"}
                <textarea rows={2} maxLength={1000} value={brief} onChange={(e) => setBrief(e.target.value)} className={`${field} py-2`} placeholder={story ? "Ex. l'histoire du STABILO BOSS" : "Ex. la réunion du club de Lyon ce matin, trois nouveaux membres présentés"} />
              </label>
              {story ? (
                <label className="block text-sm">Texte des slides et sources <span className="text-mut">(l&apos;IA n&apos;utilise que ces faits)</span>
                  <textarea rows={6} maxLength={9000} value={facts} onChange={(e) => setFacts(e.target.value)} className={`${field} py-2`} placeholder={"Slide 1 : …\nSlide 2 : …\nSources : STABILO, 170 ans (schwan-stabilo.com) : …"} />
                  <span className="mt-1 block text-xs text-mut">Colle le texte de chaque slide et les faits vérifiés avec leur source. Le récit suit tes 9 étapes, 2 000 caractères au total ; l&apos;invitation « INSPI » et les hashtags sont ajoutés mot pour mot.</span>
                </label>
              ) : null}
              {story ? (
                <p className="flex flex-wrap items-center gap-2 text-xs text-mut">Créer les slides :
                  <button type="button" className="btn-ghost min-h-9" onClick={() => { void navigator.clipboard?.writeText(INSPIBEEZNESS_CAROUSEL_PROMPT).then(() => setPromptCopied(true)).catch(() => setError("Copie impossible dans ce navigateur.")); }}>{promptCopied ? "Prompt copié" : "Copier le prompt carrousel"}</button>
                  <span>(InspiBEEz&apos;ness, version du {new Date(INSPIBEEZNESS_PROMPT_VERSION).toLocaleDateString("fr-FR")})</span>
                </p>
              ) : null}
              <button type="button" className="btn-red min-h-11" disabled={!brief.trim() || (story && !facts.trim()) || working} onClick={propose}><Sparkles aria-hidden size={16} /> {busy === "ia" ? "Rédaction…" : caption.trim() ? "Proposer une nouvelle version" : "Proposer une légende"}</button>
              <p className="text-xs text-mut">L&apos;IA suit la charte BeeRecos et n&apos;invente ni chiffre ni témoignage. Relis toujours sa proposition.</p>
              {suggestion ? (
                <div className="space-y-2 rounded-lg bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-mut">Proposition de l&apos;IA</p>
                  <p className="whitespace-pre-wrap">{suggestion}</p>
                  {story ? (() => { const n = storyLength(suggestion); return <p className={`text-xs ${n.overBudget ? "text-amber-800" : "text-mut"}`}>{n.length} caractères{n.overBudget ? " : au-delà des 2 000 prévus, raccourcis avant de publier." : " (budget 2 000)."} Vérifie chaque date, nom et chiffre avec tes sources.</p>; })() : null}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-red min-h-10" onClick={() => { edit(setCaption)(suggestion.slice(0, CAPTION_MAX)); setSuggestion(null); }}>Utiliser cette légende</button>
                    <button type="button" className="btn-ghost min-h-10" onClick={() => setSuggestion(null)}>Ignorer</button>
                  </div>
                </div>
              ) : null}
            </section>
            <label className="block font-medium">Légende
              <textarea aria-label="Légende" rows={7} maxLength={CAPTION_MAX} value={caption} onChange={(e) => edit(setCaption)(e.target.value)} className={`${field} py-2`} placeholder="Ton texte, tes hashtags…" />
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
        {uploadProgress ? <p role="status" className="text-sm text-mut">{uploadProgress}</p> : null}
        {notice ? <p role="status" className="text-sm text-mut">{notice}</p> : null}
        {error && (current || !id) ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!locked ? <button type="button" className="btn-ghost min-h-11 text-red-700" disabled={working} onClick={remove}><Trash2 aria-hidden size={16} /> {current ? "Supprimer" : "Annuler"}</button> : <span />}
          <div className="flex flex-wrap items-center gap-2">
            {!locked ? <span className="text-xs text-mut">{dirty ? "Modifications non enregistrées" : current ? "Enregistré" : ""}</span> : null}
            {!locked ? <button type="button" className="btn-ghost min-h-11" disabled={working} onClick={saveDraft}>{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button> : null}
            <PublishButton prepare={save} current={current} connected={connected} onChange={setCurrent} disabled={working} extraBlockers={formatBlockers(format, photos.length)} />
          </div>
        </div>
      </footer>
    </div>
  );
}

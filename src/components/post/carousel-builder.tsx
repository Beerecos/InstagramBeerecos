"use client";
/**
 * Visuels du carrousel avec l'IA : photos du sujet (avec une courte description pour l'IA), sujet et faits fournis,
 * plan proposé par l'IA (modèle + textes + photo), réglage slide par slide, puis création des images 1080 × 1350
 * (rendues par la mise en page : charte, logo officiel et textes exacts, jamais générés).
 */
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { toJpeg } from "html-to-image";
import { ImagePlus, Move, RotateCcw, Search, Sparkles, Wand2, X } from "lucide-react";
import { LAYOUTS, removePhotoFromPlan, normalizePlan, parsePlan, planBrief, SLIDE_H, SLIDE_W, type Layout, type Slide } from "@/domain/instagram/carousel";
import { generateEditorialText, researchCarouselFacts } from "@/lib/social/editorial-api";
import { instagram, uploadJpeg } from "@/lib/instagram/api";
import { IMAGE_MODES } from "@/domain/instagram/visual-prompt";
import CarouselSlide from "./carousel-slide";

/** Photo source : gardée dans le navigateur (seules les slides finales sont envoyées), PNG transparent intact. */
type SourcePhoto = { id: string; url: string; label: string; ai?: boolean };
type Props = { subject: string; facts: string; onSubjectChange: (value: string) => void; onFactsChange: (value: string) => void; existingPhotos?: number; disabled?: boolean; onBusyChange?: (busy: boolean) => void; onDone: (slides: { path: string; url: string }[]) => void };

const PREVIEW = 0.3;
/** Grand aperçu de la slide choisie : on y fait glisser la photo pour la placer. */
const BIG = 0.34;
const ADJUST_RESET = { photoZoom: 1, photoX: 0, photoY: 0, photoTilt: 0, photoFit: "auto" } as const;
const FIELDS: { key: keyof Slide; label: string; layouts?: Layout[] }[] = [
  { key: "title", label: "Titre" },
  { key: "accent", label: "Mot en bleu (doit figurer dans le titre)" },
  { key: "text", label: "Texte" },
  { key: "number", label: "Date ou chiffre", layouts: ["date", "chiffre-bleu", "chiffre-noir"] },
  { key: "prefix", label: "Avant le chiffre (« Plus de »)", layouts: ["chiffre-bleu", "chiffre-noir"] },
  { key: "label", label: "Étiquette photo 1", layouts: ["deux-photos"] },
  { key: "label2", label: "Étiquette photo 2", layouts: ["deux-photos"] },
  { key: "source", label: "Source (pied de slide)" },
];

export default function CarouselBuilder({ subject, facts, onSubjectChange: setSubject, onFactsChange: setFacts, existingPhotos = 0, disabled, onBusyChange, onDone }: Props) {
  const [photos, setPhotosState] = useState<SourcePhoto[]>([]);
  // Copie synchrone : les numéros de photo restent justes quand plusieurs images arrivent à la suite.
  const photosRef = useRef<SourcePhoto[]>([]);
  const setPhotos = (fn: (all: SourcePhoto[]) => SourcePhoto[]) => { photosRef.current = fn(photosRef.current); setPhotosState(photosRef.current); };
  /** Ajoute des photos sources et renvoie le numéro (1, 2, …) de la première. */
  const pushPhotos = (items: SourcePhoto[]) => { const first = photosRef.current.length + 1; setPhotos((all) => [...all, ...items]); return first; };
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusyState] = useState<string | null>(null);
  const setBusy = (value: string | null) => { setBusyState(value); onBusyChange?.(Boolean(value)); };
  useEffect(() => () => { photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)); }, []);
  const removePhoto = (index: number) => {
    const photo = photosRef.current[index];
    if (!photo) return;
    setSlides((all) => removePhotoFromPlan(all, index + 1));
    setPhotos((all) => all.filter((item) => item.id !== photo.id));
    URL.revokeObjectURL(photo.url);
  };
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const urls = Object.fromEntries(photos.map((p, i) => [i + 1, p.url]));

  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  /**
   * Ajoute des photos sources, sans les envoyer ni les recadrer : elles servent seulement à composer les slides
   * (transparence des PNG détourés conservée). Renvoie le numéro de la première photo ajoutée.
   */
  const add = (files: FileList | null): number | null => {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, 30 - photosRef.current.length);
    setError(images.length || !files?.length ? null : "Choisis une image (JPEG, PNG ou WebP).");
    if (!images.length) return null;
    return pushPhotos(images.map((f) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(f), label: f.name.replace(/\.[^.]+$/, "") })));
  };
  /** Recherche web de l'histoire : faits datés et sourcés, ajoutés à « Faits et sources » pour relecture. */
  const research = async (): Promise<string | null> => {
    const r = await researchCarouselFacts(subject);
    if (!r.facts.length) { setError("Aucun fait fiable trouvé sur le web pour ce sujet. Précise le sujet (marque, produit, personne) ou colle tes faits."); return null; }
    const next = facts.trim() ? `${facts.trim()}\n${r.text}` : r.text;
    setFacts(next);
    setNotice(`${r.facts.length} fait${r.facts.length > 1 ? "s" : ""} trouvé${r.facts.length > 1 ? "s" : ""} sur le web, chacun avec sa source${r.dropped ? ` (${r.dropped} écarté${r.dropped > 1 ? "s" : ""} : source non vérifiable)` : ""}. Relis-les : seuls ces faits serviront aux slides.`);
    return next;
  };
  const searchOnly = async () => {
    setBusy("recherche"); setError(null); setNotice(null);
    try { await research(); } catch (e) { setError(e instanceof Error ? e.message : "La recherche n'a pas abouti."); } finally { setBusy(null); }
  };
  const propose = async () => {
    setBusy("plan"); setError(null); setNotice(null);
    try {
      let facts_ = facts;
      // Sans faits : l'IA cherche d'abord l'histoire sur le web, puis propose les slides avec ces faits sourcés.
      if (!facts_.trim()) { setBusy("recherche"); const found = await research(); if (!found) return; facts_ = found; setBusy("plan"); }
      const text = await generateEditorialText({ channel: "instagram", workspaceId: null, brief: planBrief(subject, facts_, photos.map((p) => p.label || "photo")) });
      setSlides(parsePlan(text, photos.length)); setSelected(0);
    } catch (e) { setError(e instanceof Error ? e.message : "La proposition n'a pas abouti."); } finally { setBusy(null); }
  };
  const patch = (i: number, p: Partial<Slide>) => setSlides((all) => normalizePlan(all.map((s, k) => (k === i ? { ...s, ...p } : s)), photosRef.current.length));
  /** Photo réaliste générée par OpenAI pour la slide i, posée aussitôt (objet : entier ; scène : plein cadre). */
  const generateFor = async (i: number, sl: Slide) => {
    const r = await instagram.image({ description: sl.visual, subject, mode: sl.visualMode });
    const bytes = Uint8Array.from(atob(r.b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
    const n = pushPhotos([{ id: crypto.randomUUID(), url, label: `Image IA — ${sl.visual.slice(0, 70)}`, ai: true }]);
    patch(i, { ...ADJUST_RESET, photo: n, photoFit: sl.visualMode === "produit" ? "entier" : "plein" });
  };
  const generateOne = async (i: number) => {
    const sl = slides[i];
    if (!sl?.visual.trim()) return;
    setBusy(`image-${i}`); setError(null);
    try { await generateFor(i, sl); } catch (e) { setError(e instanceof Error ? e.message : "Génération impossible."); } finally { setBusy(null); }
  };
  /** Toutes les slides qui ont une description de visuel et pas encore de photo, une par une. */
  const generateAll = async () => {
    const todo = slides.map((sl, i) => [sl, i] as const).filter(([sl]) => sl.visual.trim() && !sl.photo);
    setBusy("images-ia"); setError(null); setNotice(null);
    let done = 0;
    try {
      for (const [sl, i] of todo) { setNotice(`Image ${done + 1} sur ${todo.length} en cours…`); await generateFor(i, sl); done++; }
      setNotice(`${done} image${done > 1 ? "s" : ""} réaliste${done > 1 ? "s" : ""} générée${done > 1 ? "s" : ""} : règle-les slide par slide, puis crée les images du carrousel.`);
    } catch (e) { setError(`${done} sur ${todo.length} générées. ${e instanceof Error ? e.message : "Génération impossible."}`); } finally { setBusy(null); }
  };
  /** Photo ajoutée directement depuis la slide : envoyée puis posée sur cette slide. */
  const addToSlide = (files: FileList | null, key: "photo" | "photo2") => {
    const n = add(files);
    if (n) patch(selected, { [key]: n });
  };
  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    const cur = slides[selected];
    if (disabled || busy || !cur?.photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: cur.photoX, py: cur.photoY };
  };
  const moveDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (disabled || busy || !d) return;
    patch(selected, { photoX: Math.round(d.px + (e.clientX - d.x) / BIG), photoY: Math.round(d.py + (e.clientY - d.y) / BIG) });
  };
  const render = async () => {
    if (existingPhotos && !window.confirm(`Remplacer les ${existingPhotos} photo(s) du post par ces slides ?`)) return;
    setBusy("images"); setError(null);
    try {
      const out: { path: string; url: string }[] = [];
      for (let i = 0; i < slides.length; i++) {
        setNotice(`Création de la slide ${i + 1} sur ${slides.length}…`);
        const node = nodes.current[i];
        if (!node) throw new Error(`Slide ${i + 1} introuvable.`);
        const dataUrl = await toJpeg(node, { width: SLIDE_W, height: SLIDE_H, pixelRatio: 1, quality: 0.92, cacheBust: true });
        const blob = await (await fetch(dataUrl)).blob();
        out.push({ path: await uploadJpeg(blob), url: dataUrl });
      }
      onDone(out);
      setNotice(`${out.length} images créées : elles sont maintenant les photos du carrousel. Vérifie l'aperçu avant de publier.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Création des images impossible."); } finally { setBusy(null); }
  };

  const field = "mt-1 block w-full rounded-lg border border-line bg-white px-3 font-normal";
  const s = slides[selected];
  return (
    <fieldset disabled={disabled || Boolean(busy)} aria-labelledby="visuels-titre" className="min-w-0 space-y-3 rounded-xl border border-brand/20 bg-brand-soft/40 p-3 text-sm">
      <h2 id="visuels-titre" className="flex items-center gap-2 font-medium"><Sparkles aria-hidden size={16} className="text-brand" /> Créer les visuels avec l&apos;IA</h2>
      <p className="text-xs text-mut">L&apos;IA recherche l&apos;histoire sur le web (chaque fait avec sa source), puis propose les slides ; la charte BeeRecos, le logo officiel et la mise en page sont appliqués automatiquement. Tu peux aussi coller tes propres faits. Aucune photo n&apos;est inventée : sans photo, la slide devient typographique.</p>
      <label className="block">Sujet<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="L'histoire du STABILO BOSS" className={`${field} min-h-11`} /></label>
      <label className="block">Faits et sources
        <textarea rows={4} maxLength={9000} value={facts} onChange={(e) => setFacts(e.target.value)} className={`${field} py-2`} placeholder={"1971 : lancement du STABILO BOSS (STABILO)\nMai 2025 : plus de trois milliards vendus (Schwan-STABILO)"} />
      </label>
      <button type="button" className="btn-ghost inline-flex min-h-11 items-center gap-1 px-3" disabled={disabled || !subject.trim() || Boolean(busy)} onClick={searchOnly}>
        <Search aria-hidden size={16} /> {busy === "recherche" ? "Recherche de l'histoire sur le web…" : "Rechercher l'histoire avec l'IA"}
      </button>
      <div>
        <p className="font-medium">Photos du sujet <span className="font-normal text-mut">(produit, archives identifiées, rencontres)</span></p>
        <ul className="mt-2 space-y-2">
          {photos.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
              <img src={p.url} alt="" className="size-12 rounded object-cover" />
              <span className="w-16 shrink-0 text-xs text-mut">Photo {i + 1}</span>
              <input aria-label={`Description de la photo ${i + 1}`} value={p.label} onChange={(e) => setPhotos((all) => all.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} className={`${field} min-h-10 flex-1`} placeholder="Ex. surligneur jaune détouré (photo produit officielle)" />
              <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => removePhoto(i)} className="grid size-9 place-items-center rounded-lg hover:bg-black/[0.05]"><X aria-hidden size={14} /></button>
            </li>
          ))}
        </ul>
        <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-white px-3 text-mut hover:border-brand hover:text-brand">
          <ImagePlus aria-hidden size={16} /> Ajouter des photos du sujet
          <input type="file" accept="image/*" multiple className="sr-only" aria-label="Ajouter des photos du sujet" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <button type="button" className="btn-red min-h-11" disabled={disabled || !subject.trim() || Boolean(busy)} onClick={propose}><Sparkles aria-hidden size={16} /> {busy === "plan" ? "Préparation du plan…" : busy === "recherche" ? "Recherche de l'histoire sur le web…" : slides.length ? "Proposer un nouveau plan" : "Proposer les slides"}</button>

      {slides.length ? <>
        <ol aria-label="Slides du carrousel" className="flex gap-2 overflow-x-auto pb-2">
          {slides.map((sl, i) => (
            <li key={i} className="shrink-0">
              <button type="button" aria-label={`Slide ${i + 1}`} aria-pressed={i === selected} onClick={() => setSelected(i)} className={`block overflow-hidden rounded-lg border-2 ${i === selected ? "border-brand" : "border-transparent"}`} style={{ width: SLIDE_W * PREVIEW, height: SLIDE_H * PREVIEW }}>
                <div style={{ transform: `scale(${PREVIEW})`, transformOrigin: "top left", pointerEvents: "none" }}>
                  <CarouselSlide slide={sl} index={i} total={slides.length} photos={urls} />
                </div>
              </button>
            </li>
          ))}
        </ol>
        {slides.some((sl) => sl.visual.trim() && !sl.photo) ? (
          <button type="button" className="btn-ghost min-h-11" disabled={disabled || Boolean(busy)} onClick={generateAll}>
            <Wand2 aria-hidden size={16} /> {busy === "images-ia" ? "Génération des images…" : `Générer les images réalistes (${slides.filter((sl) => sl.visual.trim() && !sl.photo).length})`}
          </button>
        ) : null}
        {s ? (
          <div className="grid gap-3">
          <div className="space-y-2">
            <div
              aria-label={`Aperçu de la slide ${selected + 1}`}
              role="img"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              className={`overflow-hidden rounded-lg border border-line bg-white ${s.photo ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
              style={{ width: SLIDE_W * BIG, height: SLIDE_H * BIG, maxWidth: "100%" }}
            >
              <div style={{ transform: `scale(${BIG})`, transformOrigin: "top left", pointerEvents: "none" }}>
                <CarouselSlide slide={s} index={selected} total={slides.length} photos={urls} />
              </div>
            </div>
            {s.photo ? <p className="flex items-center gap-1 text-xs text-mut"><Move aria-hidden size={12} /> Fais glisser la photo pour la placer.</p> : null}
          </div>
          <div className="min-w-0 space-y-3">
          <fieldset className="min-w-0 space-y-2 rounded-lg bg-white p-3" aria-label={`Visuel de la slide ${selected + 1}`}>
            <legend className="font-medium">Visuel</legend>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block min-w-0 flex-1">Photo
                <select value={s.photo ?? ""} onChange={(e) => patch(selected, { photo: e.target.value ? Number(e.target.value) : null })} className={`${field} min-h-10`}>
                  <option value="">Aucune (composition typographique)</option>
                  {photos.map((p, i) => <option key={p.id} value={i + 1}>Photo {i + 1} — {p.label}</option>)}
                </select>
              </label>
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 text-mut hover:border-brand hover:text-brand">
                <ImagePlus aria-hidden size={16} /> Ajouter une photo ici
                <input type="file" accept="image/*" className="sr-only" aria-label={`Ajouter une photo à la slide ${selected + 1}`} onChange={(e) => { addToSlide(e.target.files, "photo"); e.target.value = ""; }} />
              </label>
            </div>
            <div className="space-y-2 rounded-lg border border-brand/20 bg-brand-soft/30 p-2">
              <p className="flex items-center gap-1 font-medium"><Wand2 aria-hidden size={14} className="text-brand" /> Photo réaliste générée par l&apos;IA</p>
              <label className="block">Décris l&apos;image
                <textarea rows={2} maxLength={300} value={s.visual} onChange={(e) => patch(selected, { visual: e.target.value })} className={`${field} py-2`} placeholder="Ex. étudiante qui surligne un cahier ouvert sur un bureau en bois, lumière du matin" />
              </label>
              <div role="radiogroup" aria-label="Type d'image" className="flex flex-wrap gap-2">
                {(Object.keys(IMAGE_MODES) as (keyof typeof IMAGE_MODES)[]).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={s.visualMode === m} onClick={() => patch(selected, { visualMode: m })} className={`min-h-9 rounded-lg border px-3 text-xs ${s.visualMode === m ? "border-brand bg-white text-brand" : "border-line bg-white text-mut"}`}>{IMAGE_MODES[m]}</button>
                ))}
              </div>
              <button type="button" className="btn-red min-h-10" disabled={disabled || Boolean(busy) || s.visual.trim().length < 8} onClick={() => generateOne(selected)}>
                <Wand2 aria-hidden size={16} /> {busy === `image-${selected}` ? "Génération… (jusqu'à 1 min)" : s.photo ? "Générer une autre image" : "Générer l'image"}
              </button>
              <p className="text-xs text-mut">Sans texte, logo ni marque, personnes anonymes : c&apos;est une illustration, jamais une photo d&apos;archive ni la photo réelle du produit. Pour le vrai produit, ajoute sa photo officielle.</p>
            </div>
            {s.photo ? <>
              <label className="block">Cadrage
                <select value={s.photoFit} onChange={(e) => patch(selected, { photoFit: e.target.value as Slide["photoFit"] })} className={`${field} min-h-10`}>
                  <option value="auto">Automatique (selon le modèle)</option>
                  <option value="entier">Photo entière (produit détouré, PNG transparent)</option>
                  <option value="plein">Recadrée, remplit le cadre (scène, portrait)</option>
                </select>
              </label>
              {([
                ["photoZoom", "Taille", 0.4, 2.5, 0.05],
                ["photoTilt", "Inclinaison", -45, 45, 1],
                ["photoX", "Gauche ↔ droite", -600, 600, 5],
                ["photoY", "Haut ↕ bas", -700, 700, 5],
              ] as const).map(([key, label, min, max, step]) => (
                <label key={key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0">{label}</span>
                  <input type="range" min={min} max={max} step={step} value={s[key]} onChange={(e) => patch(selected, { [key]: Number(e.target.value) })} className="min-w-0 flex-1 accent-[#2851FF]" />
                  <span className="w-12 text-right text-xs tabular-nums text-mut">{key === "photoZoom" ? `${Math.round(s[key] * 100)} %` : key === "photoTilt" ? `${s[key]}°` : s[key]}</span>
                </label>
              ))}
              <button type="button" onClick={() => patch(selected, ADJUST_RESET)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-mut hover:bg-black/[0.05]"><RotateCcw aria-hidden size={14} /> Réinitialiser la photo</button>
            </> : <p className="text-xs text-mut">Sans photo, la slide reste typographique. Une photo produit détourée (PNG transparent) rend comme dans la référence STABILO.</p>}
            {s.layout === "deux-photos" ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block min-w-0 flex-1">Deuxième photo
                  <select value={s.photo2 ?? ""} onChange={(e) => patch(selected, { photo2: e.target.value ? Number(e.target.value) : null })} className={`${field} min-h-10`}>
                    <option value="">Aucune</option>
                    {photos.map((p, i) => <option key={p.id} value={i + 1}>Photo {i + 1} — {p.label}</option>)}
                  </select>
                </label>
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 text-mut hover:border-brand hover:text-brand">
                  <ImagePlus aria-hidden size={16} /> Ajouter
                  <input type="file" accept="image/*" className="sr-only" aria-label={`Ajouter une deuxième photo à la slide ${selected + 1}`} onChange={(e) => { addToSlide(e.target.files, "photo2"); e.target.value = ""; }} />
                </label>
              </div>
            ) : null}
          </fieldset>
          <fieldset className="min-w-0 space-y-2 rounded-lg bg-white p-3" aria-label={`Réglages de la slide ${selected + 1}`}>
            <legend className="font-medium">Slide {selected + 1}</legend>
            {s.layout !== "invitation" ? <>
              <label className="block">Modèle
                <select value={s.layout} onChange={(e) => patch(selected, { layout: e.target.value as Layout })} className={`${field} min-h-11`}>
                  {(Object.keys(LAYOUTS) as Layout[]).filter((k) => k !== "invitation").map((k) => <option key={k} value={k}>{k} — {LAYOUTS[k].split(":")[0]}</option>)}
                </select>
              </label>
              {FIELDS.filter((f) => !f.layouts || f.layouts.includes(s.layout)).map((f) => (
                <label key={f.key} className="block">{f.label}
                  {f.key === "text" ? <textarea rows={2} maxLength={220} value={String(s[f.key] ?? "")} onChange={(e) => patch(selected, { [f.key]: e.target.value })} className={`${field} py-2`} />
                    : <input value={String(s[f.key] ?? "")} onChange={(e) => patch(selected, { [f.key]: e.target.value })} className={`${field} min-h-10`} />}
                </label>
              ))}
            </> : <p className="text-xs text-mut">Invitation finale officielle : texte exact, non modifiable.</p>}
          </fieldset>
          </div>
          </div>
        ) : null}
        <button type="button" className="btn-red min-h-11" disabled={disabled || Boolean(busy)} onClick={render}>{busy === "images" ? "Création des images…" : `Créer les ${slides.length} images du carrousel`}</button>
        {/* Slides à taille réelle, hors écran : source exacte des images exportées. */}
        <div aria-hidden style={{ position: "fixed", left: -20000, top: 0 }}>
          {slides.map((sl, i) => <CarouselSlide key={i} ref={(el) => { nodes.current[i] = el; }} slide={sl} index={i} total={slides.length} photos={urls} />)}
        </div>
      </> : null}
      {notice ? <p role="status" className="text-acid-dim">{notice}</p> : null}
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    </fieldset>
  );
}

"use client";
/**
 * Visuels du carrousel avec l'IA : photos du sujet (avec une courte description pour l'IA), sujet et faits fournis,
 * plan proposé par l'IA (modèle + textes + photo), réglage slide par slide, puis création des images 1080 × 1350
 * (rendues par la mise en page : charte, logo officiel et textes exacts, jamais générés).
 */
import { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { LAYOUTS, normalizePlan, parsePlan, planBrief, SLIDE_H, SLIDE_W, type Layout, type Slide } from "@/domain/instagram/carousel";
import { generateEditorialText } from "@/lib/social/editorial-api";
import { uploadJpeg, uploadPhoto } from "@/lib/instagram/api";
import CarouselSlide from "./carousel-slide";

type SourcePhoto = { path: string; url: string; label: string };
type Props = { subject: string; facts: string; disabled?: boolean; onDone: (slides: { path: string; url: string }[]) => void };

const PREVIEW = 0.3;
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

export default function CarouselBuilder({ subject: initialSubject, facts: initialFacts, disabled, onDone }: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [facts, setFacts] = useState(initialFacts);
  const [photos, setPhotos] = useState<SourcePhoto[]>([]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const urls = Object.fromEntries(photos.map((p, i) => [i + 1, p.url]));

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("photos"); setError(null);
    try {
      for (const file of Array.from(files).slice(0, 10 - photos.length)) {
        const r = await uploadPhoto(file);
        setPhotos((all) => [...all, { path: r.path, url: URL.createObjectURL(file), label: file.name.replace(/\.[^.]+$/, "") }]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible."); } finally { setBusy(null); }
  };
  const propose = async () => {
    setBusy("plan"); setError(null); setNotice(null);
    try {
      const text = await generateEditorialText({ channel: "instagram", workspaceId: null, brief: planBrief(subject, facts, photos.map((p) => p.label || "photo")) });
      setSlides(parsePlan(text, photos.length)); setSelected(0);
    } catch (e) { setError(e instanceof Error ? e.message : "La proposition n'a pas abouti."); } finally { setBusy(null); }
  };
  const patch = (i: number, p: Partial<Slide>) => setSlides((all) => normalizePlan(all.map((s, k) => (k === i ? { ...s, ...p } : s)), photos.length));
  const render = async () => {
    setBusy("images"); setError(null);
    try {
      const out: { path: string; url: string }[] = [];
      for (let i = 0; i < slides.length; i++) {
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
    <section aria-labelledby="visuels-titre" className="min-w-0 space-y-3 rounded-xl border border-brand/20 bg-brand-soft/40 p-3 text-sm">
      <h2 id="visuels-titre" className="flex items-center gap-2 font-medium"><Sparkles aria-hidden size={16} className="text-brand" /> Créer les visuels avec l&apos;IA</h2>
      <p className="text-xs text-mut">L&apos;IA propose le plan des slides à partir de tes faits ; la charte BeeRecos, le logo officiel et la mise en page sont appliqués automatiquement. Aucune photo n&apos;est inventée : sans photo, la slide devient typographique.</p>
      <label className="block">Sujet<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="L'histoire du STABILO BOSS" className={`${field} min-h-11`} /></label>
      <label className="block">Faits et sources
        <textarea rows={4} maxLength={9000} value={facts} onChange={(e) => setFacts(e.target.value)} className={`${field} py-2`} placeholder={"1971 : lancement du STABILO BOSS (STABILO)\nMai 2025 : plus de trois milliards vendus (Schwan-STABILO)"} />
      </label>
      <div>
        <p className="font-medium">Photos du sujet <span className="font-normal text-mut">(produit, archives identifiées, rencontres)</span></p>
        <ul className="mt-2 space-y-2">
          {photos.map((p, i) => (
            <li key={p.path} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
              <img src={p.url} alt="" className="size-12 rounded object-cover" />
              <span className="w-16 shrink-0 text-xs text-mut">Photo {i + 1}</span>
              <input aria-label={`Description de la photo ${i + 1}`} value={p.label} onChange={(e) => setPhotos((all) => all.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} className={`${field} min-h-10 flex-1`} placeholder="Ex. surligneur jaune détouré (photo produit officielle)" />
              <button type="button" aria-label={`Retirer la photo ${i + 1}`} onClick={() => setPhotos((all) => all.filter((x) => x.path !== p.path))} className="grid size-9 place-items-center rounded-lg hover:bg-black/[0.05]"><X aria-hidden size={14} /></button>
            </li>
          ))}
        </ul>
        <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-white px-3 text-mut hover:border-brand hover:text-brand">
          <ImagePlus aria-hidden size={16} /> {busy === "photos" ? "Envoi…" : "Ajouter des photos du sujet"}
          <input type="file" accept="image/*" multiple className="sr-only" aria-label="Ajouter des photos du sujet" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <button type="button" className="btn-red min-h-11" disabled={disabled || !subject.trim() || !facts.trim() || Boolean(busy)} onClick={propose}><Sparkles aria-hidden size={16} /> {busy === "plan" ? "Préparation du plan…" : slides.length ? "Proposer un nouveau plan" : "Proposer les slides"}</button>

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
        {s ? (
          <fieldset className="space-y-2 rounded-lg bg-white p-3" aria-label={`Réglages de la slide ${selected + 1}`}>
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
            <label className="block">Photo
              <select value={s.photo ?? ""} onChange={(e) => patch(selected, { photo: e.target.value ? Number(e.target.value) : null })} className={`${field} min-h-10`}>
                <option value="">Aucune (composition typographique)</option>
                {photos.map((p, i) => <option key={p.path} value={i + 1}>Photo {i + 1} — {p.label}</option>)}
              </select>
            </label>
            {s.layout === "deux-photos" ? (
              <label className="block">Deuxième photo
                <select value={s.photo2 ?? ""} onChange={(e) => patch(selected, { photo2: e.target.value ? Number(e.target.value) : null })} className={`${field} min-h-10`}>
                  <option value="">Aucune</option>
                  {photos.map((p, i) => <option key={p.path} value={i + 1}>Photo {i + 1} — {p.label}</option>)}
                </select>
              </label>
            ) : null}
          </fieldset>
        ) : null}
        <button type="button" className="btn-red min-h-11" disabled={disabled || Boolean(busy)} onClick={render}>{busy === "images" ? "Création des images…" : `Créer les ${slides.length} images du carrousel`}</button>
        {/* Slides à taille réelle, hors écran : source exacte des images exportées. */}
        <div aria-hidden style={{ position: "fixed", left: -20000, top: 0 }}>
          {slides.map((sl, i) => <CarouselSlide key={i} ref={(el) => { nodes.current[i] = el; }} slide={sl} index={i} total={slides.length} photos={urls} />)}
        </div>
      </> : null}
      {notice ? <p role="status" className="text-acid-dim">{notice}</p> : null}
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
    </section>
  );
}

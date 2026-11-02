"use client";
import { toPng } from "html-to-image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  accentsFor, BACKGROUNDS, BASELINE, cardItems, carouselChecks, emphasis, isBaseline, tabStyle, EXPORT_SCALE, fileName, FORMATS, isDark, newSlide, safeColor, SLIDE_TYPES,
  INK, starterCarousel, type Carousel, type Slide, type SlideType,
} from "@/domain/social/carousel";
import { useNavigate, useSearchParams } from "@/components/social/router";
import * as api from "@/lib/social/api";
import { visualPostChannel } from "@/components/social/visual-project";
import VisualProject, { type VisualProjectState } from "@/components/social/VisualProject";
import { useVisualTransfer } from "@/components/social/useVisualTransfer";
import { COLORS } from "@/domain/social/reel-story/brand";
import { textWidth } from "@/domain/social/reel-story/metrics";
import { SHAPES } from "@/domain/social/reel-story/shapes";

/**
 * STUDIO DE CARROUSELS — Réseaux sociaux → Carrousels. Slides aux couleurs de la charte BeeRecos 2026 (Poppins,
 * bleu #2851FF, noir et blanc, logos officiels non modifiés), design des maquettes du 2026-10-22, export PNG 2160 px.
 * Composition et export dans le navigateur ; transfert explicite vers le brouillon serveur.
 * Contrôles mesurés avant export (mots, marque, interdits, chiffres à sourcer, CTA). Rien n'est publié d'ici.
 */

const PREVIEW_WIDTH = 432;
const FONT_FILES = [
  ...[400, 600, 700, 800].map((w) => ({ family: "BeeRecos Poppins", w, url: `/hyperframes/fonts/poppins-latin-${w}-normal.woff2` })),
];
const FONT_FAMILY = "'BeeRecos Poppins', Poppins, sans-serif";
const fontFaceCss = (src: (url: string) => string) => FONT_FILES.map(({ family, w, url }) => `@font-face{font-family:'${family}';font-weight:${w};font-style:normal;font-display:block;src:url(${src(url)}) format('woff2');}`).join("");

let embedded: Promise<string> | null = null;
/** Polices intégrées à l'export (fichiers Poppins du site, même origine) : rendu identique à l'aperçu. La baseline est un fichier officiel. */
function embeddedFontCss(): Promise<string> {
  embedded ??= Promise.all(FONT_FILES.map(async ({ url }) => {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
  })).then((data) => fontFaceCss((url) => data[FONT_FILES.findIndex((f) => f.url === url)]));
  return embedded;
}

const BTN = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-sm font-semibold transition disabled:opacity-50";
const PRIMARY = `${BTN} bg-brand text-white hover:bg-brand-strong`;
const GHOST = `${BTN} border border-line text-fg hover:border-brand/50`;
const SEG = (on: boolean) => `min-h-[36px] rounded-lg px-3 text-xs font-semibold transition ${on ? "bg-[#1A1A1A] text-white" : "border border-line text-fg hover:border-brand/50"}`;
const INPUT = "mt-1 block w-full rounded-lg border border-line px-2 py-2 text-sm";
const LABEL = "block text-xs font-medium text-mut";

const blankVisual = (): Carousel => ({ format: "ig34", keyword: "", caption: "", slides: [newSlide("cover")] });

export default function CarouselStudio() {
  return <VisualProject>{(project) => <VisualEditor key={project.storageKey} project={project} />}</VisualProject>;
}

function VisualEditor({ project }: { project: VisualProjectState }) {
  const [c, setC] = useState<Carousel>(() => project.initial ?? blankVisual());
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const transfer = useVisualTransfer(project.storageKey, project.id, project.version);
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [storage, setStorage] = useState<"ok" | "sans-images" | "impossible">("ok");
  const exportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const format = FORMATS.find((f) => f.key === c.format) ?? FORMATS[0];
  const slide = c.slides[Math.min(index, c.slides.length - 1)];
  const checks = useMemo(() => carouselChecks(c), [c]);
  const blocking = checks.filter((x) => !x.ok && x.level === "bloquant");

  useEffect(() => {
    try { localStorage.setItem(project.storageKey, JSON.stringify({ ...c, serverVersion: project.version, sourceContext: project.context })); setStorage("ok"); }
    catch { setStorage("impossible"); }
  }, [c, project.storageKey, project.version, project.context]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2600); return () => clearTimeout(t); }, [toast]);

  const patch = useCallback((p: Partial<Slide>) => setC((cur) => ({ ...cur, slides: cur.slides.map((s, i) => (i === index ? { ...s, ...p } : s)) })), [index]);
  const add = () => { setC((cur) => ({ ...cur, slides: [...cur.slides.slice(0, index + 1), newSlide("plain"), ...cur.slides.slice(index + 1)] })); setIndex(index + 1); setToast("Slide ajoutée."); };
  const duplicate = () => { setC((cur) => ({ ...cur, slides: [...cur.slides.slice(0, index + 1), { ...cur.slides[index], id: newSlide().id }, ...cur.slides.slice(index + 1)] })); setIndex(index + 1); setToast("Slide dupliquée."); };
  const remove = () => {
    if (c.slides.length <= 1) return;
    setC((cur) => ({ ...cur, slides: cur.slides.filter((_, i) => i !== index) }));
    setIndex(Math.max(0, index - 1)); setToast("Slide supprimée.");
  };
  const move = (d: -1 | 1) => {
    const j = index + d;
    if (j < 0 || j >= c.slides.length) return;
    setC((cur) => { const s = [...cur.slides]; [s[index], s[j]] = [s[j], s[index]]; return { ...cur, slides: s }; });
    setIndex(j);
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { setToast("Image PNG, JPG ou WebP."); return; }
    if (file.size > 12 * 1024 * 1024) { setToast("Image de 12 Mo au plus."); return; }
    const r = new FileReader();
    r.onload = () => patch({ img: String(r.result) });
    r.readAsDataURL(file);
  };

  const exportSlides = async (which: number[]) => {
    setExporting(true);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await document.fonts.ready;
      const fontEmbedCSS = await embeddedFontCss();
      for (const i of which) {
        const node = exportRefs.current[i];
        if (!node) throw new Error("Slide introuvable pour l'export.");
        const url = await toPng(node, { width: format.width, height: format.height, pixelRatio: EXPORT_SCALE, fontEmbedCSS, cacheBust: false });
        const a = document.createElement("a");
        a.href = url; a.download = fileName(i); a.click();
        if (which.length > 1) await new Promise((r) => setTimeout(r, 350));
      }
      setToast(which.length > 1 ? `${which.length} slides exportées (${format.width * EXPORT_SCALE} × ${format.height * EXPORT_SCALE}).` : `Slide exportée (${format.width * EXPORT_SCALE} × ${format.height * EXPORT_SCALE}).`);
    } catch (e) {
      setToast(`Export impossible : ${(e as Error).message}`);
    } finally { setExporting(false); }
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(c.slides.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [c.slides.length]);

  if (!slide) return null;
  const t = slide.type;
  const contentFormat = c.slides.length > 1 ? "carousel" : "single";
  const returnParams = new URLSearchParams(params);
  returnParams.delete("vue");
  returnParams.delete("creation");
  returnParams.delete("montage");
  returnParams.delete("reel");
  returnParams.delete("tab");
  returnParams.delete("templates");
  returnParams.delete("sourceId");
  returnParams.delete("visual");
  returnParams.delete("postChannel");
  const openPost = (id: string) => {
    const next = new URLSearchParams(returnParams);
    next.set("edit", id);
    navigate(`/publication?${next}`);
  };
  const sendToPost = () => transfer.send({
    templateKey: "visual", channel: "instagram", title: c.slides[0].title || "Visuel sans titre",
    workspaceId: project.context?.workspaceId ?? null, eventId: project.context?.eventId ?? null,
    contactId: project.context?.contactId ?? null,
    caption: c.caption, cta: c.keyword, status: "brouillon",
    ratios: [c.format === "ig34" ? "3:4" : c.format === "li45" ? "4:5" : c.format === "sq" ? "1:1" : "9:16"],
    composition: { ...c, aspect: c.format, format: contentFormat },
  }, async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await document.fonts.ready;
    const fontEmbedCSS = await embeddedFontCss();
    const media = [];
    for (let i = 0; i < c.slides.length; i++) {
      const node = exportRefs.current[i];
      if (!node) throw new Error("Visuel introuvable pour la composition.");
      const png = await toPng(node, { width: format.width, height: format.height, pixelRatio: EXPORT_SCALE, fontEmbedCSS, cacheBust: false });
      const asset = await api.uploadMedia({ kind: "photo", source: "user", contentType: "image/png", base64: png.split(",")[1],
        workspaceId: project.context?.workspaceId ?? null, eventId: project.context?.eventId ?? null, contactId: project.context?.contactId ?? null,
        title: c.slides[i].title || `Visuel ${i + 1}`, altText: c.slides[i].title });
      media.push({ assetId: asset.id, storagePath: asset.storage_path, url: asset.url, type: "image" as const, alt: c.slides[i].title, slideId: c.slides[i].id });
    }
    return media;
  }, openPost, visualPostChannel(params.get("postChannel")));
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <style>{fontFaceCss((u) => u)}</style>
      <p className="kicker text-brand">Réseaux sociaux · Créer</p>
      <h1 className="font-display text-3xl">Éditeur de visuels</h1>
      <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-mut">Un visuel pour un post simple. Ajoute des visuels pour créer un carrousel, puis prépare ton post.</p>

      <p className="mt-3 text-sm font-semibold" role="status">{contentFormat === "single" ? "Post simple" : "Carrousel"} · {c.slides.length} visuel{c.slides.length > 1 ? "s" : ""}</p>
      <fieldset disabled={transfer.busy || exporting} className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
          <Section n="01" title="Format">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format">
              {FORMATS.map((f) => <button key={f.key} type="button" aria-pressed={c.format === f.key} className={SEG(c.format === f.key)} onClick={() => setC({ ...c, format: f.key })}>{f.label}</button>)}
            </div>
            <p className="mt-1.5 text-xs text-mut">Export : {format.width * EXPORT_SCALE} × {format.height * EXPORT_SCALE} px.</p>
          </Section>

          <Section n="02" title="Image de cette slide">
            <label
              className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line px-3 text-center text-xs text-mut hover:border-brand/50"
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickImage(e.dataTransfer.files[0]); }}>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Image de la slide" onChange={(e) => pickImage(e.target.files?.[0])} />
              {slide.img ? "Image chargée : glisser ou cliquer pour la remplacer" : "Glisser une image ici, ou cliquer"}
            </label>
            {slide.img ? (
              <div className="mt-2 space-y-2">
                <Range label="Échelle" value={slide.imgScale} min={100} max={220} unit="%" onChange={(v) => patch({ imgScale: v })} />
                <Range label="Position horizontale" value={slide.imgPosX} min={0} max={100} unit="%" onChange={(v) => patch({ imgPosX: v })} />
                <Range label="Position verticale" value={slide.imgPosY} min={0} max={100} unit="%" onChange={(v) => patch({ imgPosY: v })} />
                <button type="button" className="text-xs text-mut hover:text-fg" onClick={() => patch({ img: null })}>Retirer l'image</button>
              </div>
            ) : (
              <div className="mt-2"><span className={LABEL}>Fond sans image</span>
                <div className="mt-1 flex gap-1.5">{BACKGROUNDS.map((b) => (
                  <button key={b.key} type="button" aria-pressed={slide.background === b.key} aria-label={`Fond ${b.label}`} title={b.label}
                    className={`h-9 w-9 rounded-full border-2 ${slide.background === b.key ? "border-[#1A1A1A]" : "border-line"}`} style={{ background: b.color }}
                    onClick={() => patch({ background: b.key, accent: safeColor({ img: null, background: b.key }, slide.accent), labelColor: safeColor({ img: null, background: b.key }, slide.labelColor) })} />))}
                </div></div>
            )}
          </Section>

          <Section n="03" title="Mise en page et texte">
            <span className={LABEL}>Type de slide</span>
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Type de slide">
              {SLIDE_TYPES.map((x) => <button key={x.key} type="button" aria-pressed={t === x.key} className={SEG(t === x.key)} onClick={() => patch({ type: x.key as SlideType })}>{x.label}</button>)}
            </div>
            <span className={`${LABEL} mt-3`}>Position du texte</span>
            <div className="mt-1 flex gap-1.5" role="group" aria-label="Position du texte">
              {(["top", "center", "bottom"] as const).map((p) => <button key={p} type="button" aria-pressed={slide.textPos === p} className={SEG(slide.textPos === p)} onClick={() => patch({ textPos: p })}>{p === "top" ? "Haut" : p === "center" ? "Centre" : "Bas"}</button>)}
            </div>
            <div className="mt-3 space-y-2.5">
              {t !== "bignum" ? <Field label="Surtitre" value={slide.kicker} onChange={(v) => patch({ kicker: v })} /> : null}
              {t === "numbered" ? <Field label="Numéro" value={slide.num} onChange={(v) => patch({ num: v })} /> : null}
              {t === "bignum" ? (
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <Field label="Grand chiffre (sourcé)" value={slide.bignum} onChange={(v) => patch({ bignum: v })} />
                  <Field label="Exposant" value={slide.bigsuffix} onChange={(v) => patch({ bigsuffix: v })} />
                  <div className="col-span-2"><Field label="Légende du chiffre" value={slide.toplabel} onChange={(v) => patch({ toplabel: v })} /></div>
                </div>
              ) : null}
              <Field label="Titre (*mot* = mis en valeur)" value={slide.title} onChange={(v) => patch({ title: v })} multiline hint={t === "outro" ? `Le verbe ; le mot-clé (${c.keyword || "à définir en §05"}) s'affiche dans la bulle.` : undefined} />
              <Field label="Texte (facultatif, *mot* = en gras)" value={slide.body} onChange={(v) => patch({ body: v })} multiline />
              {t === "card" ? (
                <div className="space-y-2.5 rounded-lg bg-black/[0.03] p-2.5">
                  <Field label="Titre de la carte" value={slide.cardTitle} onChange={(v) => patch({ cardTitle: v })} />
                  <Field label="Sous-titre de la carte" value={slide.cardSub} onChange={(v) => patch({ cardSub: v })} />
                  <Field label="Pastille (facultatif)" value={slide.cardPill} onChange={(v) => patch({ cardPill: v })} />
                  <Field label="Étapes cochées (une par ligne, 5 au plus)" value={slide.items} onChange={(v) => patch({ items: v })} multiline />
                </div>
              ) : null}
              <Field label="Signature (bas de la slide)" value={slide.sig} onChange={(v) => patch({ sig: v })} hint={`Par défaut la baseline ${BASELINE} (fichier officiel manuscrit, seulement si elle est exacte) ; vide = aucune signature.`} />
            </div>
          </Section>

          <details><summary className="cursor-pointer py-2 text-sm font-semibold">Options avancées et export</summary>
            <button type="button" className={GHOST} onClick={() => {
              const next = new URLSearchParams(params); next.delete("postChannel"); next.delete("visual"); next.delete("vue"); next.set("tab", "studio"); next.set("templates", "1");
              navigate(`/publication?${next}`);
            }}>Ouvrir les modèles métier</button>
          <Section n="04" title="Style">
            <Swatches label="Accent (chiffres, surtitre, mot en valeur)" colors={accentsFor(slide)} value={safeColor(slide, slide.accent)} onChange={(v) => patch({ accent: v })} />
            <Swatches label="Couleur des titres" colors={accentsFor(slide)} value={safeColor(slide, slide.labelColor)} onChange={(v) => patch({ labelColor: v })} />
            <p className="mt-2 text-[11px] text-mut">Bleu, noir et blanc seulement, limités aux couleurs lisibles sur ce fond (charte BeeRecos).</p>
            {slide.img ? (
              <><span className={`${LABEL} mt-3`}>Dégradé de lisibilité</span>
                <div className="mt-1 flex gap-1.5" role="group" aria-label="Dégradé">
                  {(["bottom", "full", "none"] as const).map((v) => <button key={v} type="button" aria-pressed={slide.scrim === v} className={SEG(slide.scrim === v)} onClick={() => patch({ scrim: v })}>{v === "bottom" ? "Bas" : v === "full" ? "Plein" : "Aucun"}</button>)}
                </div></>
            ) : null}
          </Section>

          <Section n="05" title="Appel à l'action et légende">
            <Field label="Mot-clé à commenter (actif dans Manychat)" value={c.keyword} onChange={(v) => setC({ ...c, keyword: v.toUpperCase().replace(/[^A-ZÀ-ÖØ-Ý0-9]/gu, "").slice(0, 20) })} />
            <div className="mt-2.5"><Field label="Légende Instagram" value={c.caption} onChange={(v) => setC({ ...c, caption: v.slice(0, 2200) })} multiline /></div>
          </Section>

          <Section n="06" title="Contrôles avant export">
            <ul className="space-y-1 text-xs" data-testid="carousel-checks">
              {checks.map((x) => <li key={x.key} className={x.ok ? "text-emerald-700" : x.level === "bloquant" ? "text-red-700" : "text-amber-800"}>{x.ok ? "✓" : x.level === "bloquant" ? "✗" : "!"} {x.label} — <span className="text-mut">{x.proof}</span></li>)}
            </ul>
          </Section>

          <Section n="07" title="Export">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={GHOST} disabled={exporting} onClick={() => exportSlides([index])}>Cette slide en PNG</button>
              <button type="button" className={GHOST} disabled={exporting || blocking.length > 0} onClick={() => exportSlides(c.slides.map((_, i) => i))}>Exporter toutes les slides</button>
            </div>
            {blocking.length ? <p className="mt-2 text-xs text-red-700">Export complet bloqué : {blocking.map((b) => b.label.toLowerCase()).join(", ")}.</p> : null}
            <p className="mt-2 text-xs text-mut">Brouillon local sur ce poste. « Envoyer vers le post » enregistre la composition et les images sur le serveur. Sauvegarde locale{storage === "sans-images" ? " (sans les images, trop lourdes pour le navigateur)" : storage === "impossible" ? " : impossible ici (navigation privée ?)" : ""}.</p>
            <button type="button" className="mt-2 text-xs text-mut hover:text-fg" onClick={() => { if (window.confirm("Repartir du carrousel de départ ? Le brouillon actuel sera remplacé.")) { setC(starterCarousel()); setIndex(0); } }}>Repartir du modèle de départ</button>
          </Section>
          </details>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" aria-live="polite">Slide {index + 1} / {c.slides.length}</p>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button type="button" className={GHOST} aria-label="Slide précédente" disabled={index === 0} onClick={() => setIndex(index - 1)}>←</button>
              <button type="button" className={GHOST} aria-label="Slide suivante" disabled={index >= c.slides.length - 1} onClick={() => setIndex(index + 1)}>→</button>
              <button type="button" className={GHOST} aria-label="Déplacer avant" disabled={index === 0} onClick={() => move(-1)}>⇤</button>
              <button type="button" className={GHOST} aria-label="Déplacer après" disabled={index >= c.slides.length - 1} onClick={() => move(1)}>⇥</button>
              <button type="button" className={GHOST} onClick={add} disabled={c.slides.length >= 10}>Ajouter</button>
              <button type="button" className={GHOST} onClick={duplicate} disabled={c.slides.length >= 10}>Dupliquer</button>
              <button type="button" className={GHOST} onClick={remove} disabled={c.slides.length <= 1}>Supprimer</button>
            </div>
          </div>
          <div className="mt-3 flex justify-center rounded-2xl p-4" style={{ background: "repeating-conic-gradient(#f1f1f1 0% 25%, #fafafa 0% 50%) 50% / 24px 24px" }}>
            <div style={{ width: PREVIEW_WIDTH, maxWidth: "100%", aspectRatio: `${format.width} / ${format.height}` }} className="relative overflow-hidden rounded-lg shadow-lg" data-testid="carousel-preview">
              <Scaled width={format.width} height={format.height}><SlideView slide={slide} keyword={c.keyword} width={format.width} height={format.height} /></Scaled>
            </div>
          </div>
          <ol className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Toutes les slides">
            {c.slides.map((s, i) => (
              <li key={s.id} className="shrink-0">
                <button type="button" aria-label={`Slide ${i + 1}`} aria-current={i === index} onClick={() => setIndex(i)}
                  className={`block overflow-hidden rounded-md border-2 ${i === index ? "border-brand" : "border-line"}`} style={{ width: 72, aspectRatio: `${format.width} / ${format.height}` }}>
                  <Scaled width={format.width} height={format.height}><SlideView slide={s} keyword={c.keyword} width={format.width} height={format.height} /></Scaled>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </fieldset>
      <footer className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white p-4">
        <p className="text-xs text-mut" role="status">{transfer.notice || "Brouillon local · aucun post publié ni programmé."}</p>
        <div className="flex flex-wrap gap-2">
          <button className={GHOST} type="button" disabled={transfer.busy} onClick={() => navigate(`/publication?${returnParams}`)}>Revenir au tableau</button>
          <button className={PRIMARY} type="button" disabled={transfer.busy || exporting} onClick={sendToPost}>{transfer.busy ? "Enregistrement…" : "Envoyer vers le post"}</button>
        </div>
      </footer>

      {exporting || transfer.busy ? (
        <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }}>
          {c.slides.map((s, i) => (
            <div key={s.id} ref={(el) => { exportRefs.current[i] = el; }} style={{ width: format.width, height: format.height }}>
              <SlideView slide={s} keyword={c.keyword} width={format.width} height={format.height} />
            </div>
          ))}
        </div>
      ) : null}
      {toast ? <p role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#1A1A1A] px-4 py-2 text-sm text-white shadow-lg">{toast}</p> : null}
      <p className="mt-8 text-xs text-mut">BeeRecos · Poppins (SIL Open Font License) · logos officiels du brandguide 2026.</p>
    </div>
  );
}

/** Aperçu : la slide est mise en page à sa taille réelle puis réduite (même rendu que l'export). */
function Scaled({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="relative h-full w-full">
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }}>{children}</div>
    </div>
  );
}

/**
 * Fichiers officiels (jamais redessinés) : logo horizontal, baseline manuscrite seule (fichier fourni en noir, passé au
 * bleu de charte au même masque, comme sur les maquettes), pictogramme blanc.
 */
const LOGO = { file: "/hyperframes/brand/beerecos-logo-horizontal.webp", ratio: 390 / 1752 };
const BASELINE_IMG = { file: "/hyperframes/brand/beerecos-baseline-seule-bleu.webp", ratio: 101 / 1062 };
const PICTO_WHITE = "/brand/beerecos-pictogramme-blanc.svg";
/** Bleu de charte à 10 % sur blanc : formes de fond et pastilles. */
const TINT = "rgba(40,81,255,0.1)";
/** Largeur utile du texte (cqw) et chasse approximative de Poppins ExtraBold (Bold mesurée + 5 %). */
const TEXT_WIDTH = 85;
const fitCqw = (text: string, max: number, width = TEXT_WIDTH) =>
  Math.min(max, ...text.replace(/\*/g, "").split("\n").filter((l) => l.trim()).map((l) => width / (textWidth(l.trim(), 700, 1) * 1.05)));

/** *mot* : couleur d'accent ; si l'accent est la couleur du titre, le mot reste en gras (jamais de turquoise). */
function Title({ text, color, accent, size }: { text: string; color: string; accent: string; size: number }) {
  return (
    <h2 style={{ margin: 0, color, fontSize: `${size}cqw`, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.015em", whiteSpace: "pre-line" }}>
      {emphasis(text).map((p, i) => <span key={i} style={p.em ? { color: accent } : undefined}>{p.text}</span>)}
    </h2>
  );
}

/** Texte courant : *mot* en gras dans la couleur d'accent (« le lien de visite. », « aussi. »). */
function Body({ text, color, accent, size }: { text: string; color: string; accent: string; size: number }) {
  return (
    <p style={{ margin: "3.2cqw 0 0", color, fontSize: `${size}cqw`, fontWeight: 400, lineHeight: 1.22, whiteSpace: "pre-line" }}>
      {emphasis(text).map((p, i) => <span key={i} style={p.em ? { color: accent, fontWeight: 800 } : undefined}>{p.text}</span>)}
    </p>
  );
}

const Shape = ({ name, style, fill }: { name: keyof typeof SHAPES; style: CSSProperties; fill: string }) => {
  const sh = SHAPES[name];
  return <svg aria-hidden viewBox={sh.viewBox} style={{ position: "absolute", ...style }}><path d={sh.d} transform={sh.transform} fill={fill} /></svg>;
};
const CheckIcon = ({ color, size }: { color: string; size: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size, flex: "none" }}><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/**
 * Une slide, à sa taille réelle ; unités cqw/cqh pour que tout suive le format. Design des maquettes du 2026-10-22 :
 * fond blanc (logo officiel en haut, forme de la charte en bleu clair, baseline manuscrite en bas à gauche) ou fond bleu,
 * noir ou photo (logo dans un cartouche blanc, pictogramme en filigrane, baseline sur un bandeau blanc).
 */
export function SlideView({ slide: s, keyword, width, height }: { slide: Slide; keyword: string; width: number; height: number }) {
  const dark = isDark(s);
  const bg = BACKGROUNDS.find((b) => b.key === s.background)?.color ?? COLORS.blue;
  const ink = dark ? COLORS.white : INK;
  const soft = dark ? "rgba(255,255,255,0.9)" : INK;
  const titleColor = safeColor(s, s.labelColor);
  const accent = safeColor(s, s.accent);
  const shadow = s.img ? "0 0.4cqw 2cqw rgba(0,0,0,0.35)" : "none";
  const scrim = !s.img || s.scrim === "none" ? null
    : s.scrim === "full" ? "linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.6))"
    : "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.78) 100%)";
  const root: CSSProperties = { width, height, position: "relative", overflow: "hidden", containerType: "size", background: bg, fontFamily: FONT_FAMILY, color: ink };
  const sig = s.sig.trim();
  const band = dark && Boolean(sig);
  const titleSize = s.type === "outro" ? fitCqw(s.title, 16.5) : s.type === "cover" ? fitCqw(s.title, 13) : fitCqw(s.title, 12);
  const items = cardItems(s);
  const justify = s.textPos === "center" ? "center" : s.textPos === "bottom" ? "flex-end" : "flex-start";
  const kw = keyword.trim().toUpperCase() || "MOT";
  const pad = "0 7.5cqw";
  return (
    <div style={root}>
      {s.img ? (
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${s.img})`, backgroundSize: "cover", backgroundPosition: `${s.imgPosX}% ${s.imgPosY}%`,
          transform: `scale(${s.imgScale / 100})`, transformOrigin: `${s.imgPosX}% ${s.imgPosY}%` }} />
      ) : null}
      {scrim ? <div style={{ position: "absolute", inset: 0, background: scrim }} /> : null}
      {/* Formes de la charte : forme organique bleu clair sur blanc, pictogramme officiel en filigrane sur fond bleu ou noir. */}
      {!s.img && !dark ? (s.type === "outro"
        ? <Shape name="organique-haute" fill={TINT} style={{ right: "-9cqw", bottom: "-2cqh", width: "36cqw" }} />
        : <Shape name="organique-haute" fill={TINT} style={{ right: "-10cqw", top: "5cqh", width: "42cqw" }} />) : null}
      {!s.img && dark ? <img src={PICTO_WHITE} alt="" aria-hidden style={{ position: "absolute", right: "-4cqw", bottom: band ? "12cqh" : "-2cqh", height: "38cqh", width: "auto", opacity: 0.35 }} /> : null}

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: pad, marginTop: "8.5cqw" }}>
          {dark ? (
            <div style={{ display: "inline-block", background: COLORS.white, borderRadius: "3cqw", padding: "3cqw 4cqw" }}>
              <img src={LOGO.file} alt="BeeRecos" style={{ display: "block", width: "42cqw", height: `${42 * LOGO.ratio}cqw` }} />
            </div>
          ) : <img src={LOGO.file} alt="BeeRecos" style={{ display: "block", width: s.type === "outro" ? "43cqw" : "38cqw", height: `${(s.type === "outro" ? 43 : 38) * LOGO.ratio}cqw` }} />}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: justify, padding: `8cqw 7.5cqw 3cqw`, textShadow: shadow }}>
          {s.type === "bignum" ? (
            <div style={{ marginBottom: "3cqw" }}>
              <div style={{ fontSize: "26cqw", fontWeight: 800, lineHeight: 0.9, color: accent, letterSpacing: "-0.03em" }}>
                {s.bignum || "—"}{s.bigsuffix ? <sup style={{ fontSize: "0.38em", verticalAlign: "super", marginLeft: "0.04em" }}>{s.bigsuffix}</sup> : null}
              </div>
              {s.toplabel ? <p style={{ margin: "2cqw 0 0", fontSize: "3.8cqw", fontWeight: 600, color: soft }}>{s.toplabel}</p> : null}
            </div>
          ) : null}
          {s.type === "numbered" && s.num ? <div style={{ fontSize: "13cqw", fontWeight: 800, lineHeight: 1, color: accent, marginBottom: "2cqw" }}>{s.num}</div> : null}
          {s.kicker && s.type !== "bignum" ? <Tab text={s.kicker} dark={dark} /> : null}
          {s.title ? <Title text={s.title} color={titleColor} accent={accent} size={titleSize} /> : null}

          {s.type === "outro" ? (
            // Bulle de commentaire du mot-clé (celui du §05, actif dans le moteur de DM).
            <div style={{ position: "relative", margin: "4.5cqw 0 7cqw", background: dark ? COLORS.white : COLORS.blue, borderRadius: "9cqw", padding: "5.5cqw 4cqw", textAlign: "center", textShadow: "none" }}>
              <span style={{ display: "block", color: dark ? COLORS.blue : COLORS.white, fontSize: `${fitCqw(kw, 27, 72)}cqw`, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.01em" }}>{kw}</span>
              <svg aria-hidden viewBox="0 0 100 70" style={{ position: "absolute", left: "3.5cqw", bottom: "-5.8cqw", width: "10.5cqw", height: "7.4cqw" }}>
                <path d="M18 0 L100 0 L4 66 Q0 69 2 63 Z" fill={dark ? COLORS.white : COLORS.blue} />
              </svg>
            </div>
          ) : null}
          {s.body ? <Body text={s.body} color={soft} accent={accent} size={s.type === "outro" ? 6.6 : 5.8} /> : null}

          {s.type === "card" && (s.cardTitle || items.length) ? (
            <div style={{ marginTop: "6cqw", background: COLORS.white, color: INK, borderRadius: "4cqw", padding: "5cqw 5cqw 4.4cqw", boxShadow: "0 2cqw 6cqw rgba(0,0,0,0.08), 0 0 0 0.15cqw rgba(0,0,0,0.06)", textShadow: "none" }}>
              {s.cardTitle || s.cardSub || s.cardPill ? (
                <div style={{ display: "flex", alignItems: "center", gap: "2.6cqw" }}>
                  <svg aria-hidden viewBox={SHAPES.hexagone.viewBox} style={{ width: "7.4cqw", flex: "none" }}><path d={SHAPES.hexagone.d} transform={SHAPES.hexagone.transform} fill={COLORS.blue} /></svg>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {s.cardTitle ? <p style={{ margin: 0, fontSize: "4.2cqw", fontWeight: 800, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.cardTitle}</p> : null}
                    {s.cardSub ? <p style={{ margin: "0.8cqw 0 0", fontSize: "3cqw", fontWeight: 400, color: "#666666", whiteSpace: "nowrap" }}>{s.cardSub}</p> : null}
                  </div>
                  {s.cardPill ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "1.2cqw", flex: "none", background: TINT, color: COLORS.blue, borderRadius: "99cqw", padding: "1.4cqw 2.6cqw", fontSize: "2.9cqw", fontWeight: 700 }}>
                      <CheckIcon color={COLORS.blue} size="3cqw" />{s.cardPill}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {items.map((it, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "3cqw", marginTop: i === 0 && (s.cardTitle || s.cardSub) ? "5.2cqw" : "3cqw" }}>
                  <span style={{ display: "grid", placeItems: "center", width: "6.6cqw", height: "6.6cqw", borderRadius: "50%", background: COLORS.blue, flex: "none" }}><CheckIcon color={COLORS.white} size="3.7cqw" /></span>
                  <span style={{ fontSize: "4.5cqw", fontWeight: 800 }}>{it}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Signature : baseline officielle manuscrite (fichier), sinon le texte saisi ; bandeau blanc sur fond sombre. */}
        {sig ? (
          <div style={band ? { background: COLORS.white, height: "12cqh", display: "flex", alignItems: "center", justifyContent: "center" } : { padding: pad, marginBottom: "6cqh" }}>
            {isBaseline(sig)
              ? <img src={BASELINE_IMG.file} alt={BASELINE} style={{ display: "block", width: band ? "56cqw" : "46cqw", height: `${(band ? 56 : 46) * BASELINE_IMG.ratio}cqw` }} />
              : <p style={{ margin: 0, fontSize: "3.4cqw", fontWeight: 600, color: band ? COLORS.blue : accent }}>{sig}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Onglet graphique (cartouche à angles légèrement arrondis) : identifie l'idée de la slide. */
function Tab({ text, dark }: { text: string; dark: boolean }) {
  const t = tabStyle(dark);
  return <p style={{ display: "inline-block", margin: "0 0 2.6cqw", padding: "1.1cqw 2.4cqw", borderRadius: "1.4cqw", background: t.background, color: t.color,
    borderLeft: t.accent ? `1cqw solid ${t.accent}` : undefined, fontSize: "2.9cqw", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textShadow: "none" }}>{text}</p>;
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="card p-4" aria-label={title}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mut"><span className="text-brand">§{n}</span> {title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, multiline = false, hint }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string }) {
  return (
    <label className={LABEL}>{label}
      {multiline ? <textarea aria-label={label} className={INPUT} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input aria-label={label} className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} />}
      {hint ? <span className="mt-1 block text-[11px] font-normal">{hint}</span> : null}
    </label>
  );
}

function Range({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className={LABEL}>{label} <span className="text-fg">{value}{unit}</span>
      <input type="range" min={min} max={max} value={value} className="mt-1 block w-full accent-[#2851FF]" onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (v: string) => void }) {
  const names: Record<string, string> = { [COLORS.blue]: "Bleu", [COLORS.white]: "Blanc", [INK]: "Noir" };
  return (
    <div className="mt-2 first:mt-0"><span className={LABEL}>{label}</span>
      <div className="mt-1 flex gap-1.5" role="group" aria-label={label}>{colors.map((col) => (
        <button key={col} type="button" aria-pressed={value === col} aria-label={names[col]} title={names[col]}
          className={`h-9 w-9 rounded-full border-2 ${value === col ? "border-[#1A1A1A]" : "border-line"}`} style={{ background: col }} onClick={() => onChange(col)} />))}
      </div>
    </div>
  );
}

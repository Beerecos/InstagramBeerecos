"use client";
/**
 * Réglages d'une animation (refonte 2026-11-10 : « plus intuitif à remplir, adapté et dopé à l'IA »).
 * 1. Les textes d'abord, avec des libellés en français et un bouton « ✨ Proposer avec l'IA » (textes tirés de ce qui
 *    est dit à ce moment, sans chiffre inventé) ;
 * 2. le moment (début, durée) ;
 * 3. les options de style (facultatives) et le placement, repliés, avec des curseurs.
 */
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import { PlacementSchema, type CaptionWord, type Range } from "@/domain/social/montage/edit";
import { fieldsOf, type CustomAnimation } from "@/domain/social/montage/suggest";
import { animationOutputRange, retimeAnimation } from "@/domain/social/montage/placement";
import { animationAiBrief, parseAnimationAi, spokenAround } from "@/domain/social/montage/animation-ai";
import { generateEditorialText } from "@/lib/social/editorial-api";

/** Libellés des choix fermés (couleur, position, entrée) ; la valeur technique reste celle de l'animation. */
const CHOICES: Record<string, string> = {
  haut: "Derrière la tête", milieu: "Derrière les épaules", blanc: "Blanc", bleu: "Bleu BeeRecos", noir: "Noir", flou: "Fondu flou",
  rebond: "Agrandissement avec rebond", verticale: "Entrée verticale", laterale: "Entrée latérale", encart: "Encart", plein: "Plein écran", mix: "Mélangé",
};
/** Libellés et aides des champs, en français (jamais le nom technique). */
const FIELD: Record<string, { label: string; hint?: string; placeholder?: string }> = {
  texte: { label: "Texte principal", placeholder: "Ex. TON RÉSEAU" },
  detail: { label: "Deuxième ligne", placeholder: "Ex. vaut de l'or" },
  remplacement: { label: "La deuxième ligne devient…", hint: "Facultatif : elle change à mi-parcours pour montrer une progression." },
  mot: { label: "Mot-clé à commenter", hint: "Le mot actif dans le moteur de DM, en majuscules." },
  valeur: { label: "Nombre dit dans la vidéo" }, legende: { label: "Légende", hint: "Ce que représente le nombre." },
  avant: { label: "Avant le nombre", placeholder: "Ex. +" }, apres: { label: "Après le nombre", placeholder: "Ex. %" }, decimales: { label: "Chiffres après la virgule" },
  titre: { label: "Titre" }, items: { label: "Éléments", hint: "Un élément par ligne, 2 à 4 mots chacun." },
  recto: { label: "Face avant" }, verso: { label: "Face arrière (après retournement)" },
  icones: { label: "Icônes", hint: "Une par ligne." }, centre: { label: "Texte au centre" },
  fichier: { label: "Image de la bibliothèque" }, mode: { label: "Affichage" },
  position: { label: "Position" }, couleur: { label: "Couleur" }, entree: { label: "Apparition" }, variante: { label: "Couleur" },
  angle: { label: "Inclinaison" }, etages: { label: "Nombre d'étages" }, feuillage: { label: "Feuillage" },
  fond: { label: "Fond coloré" }, baseline: { label: "Baseline #MonReseauCestTonReseau" },
  x: { label: "Position horizontale (px)" }, y: { label: "Position verticale (px)" },
};
/** Curseurs des réglages chiffrés connus (bornes de l'animation). */
const SLIDERS: Record<string, { min: number; max: number; step: number; unit?: string }> = {
  angle: { min: -12, max: 12, step: 1, unit: "°" }, etages: { min: 4, max: 8, step: 1 }, decimales: { min: 0, max: 2, step: 1 },
};
const STYLE_KEYS = new Set(["position", "couleur", "entree", "variante", "angle", "etages", "feuillage", "fond", "baseline", "x", "y", "mode", "decimales"]);
const field = "mt-1 min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
const sec = (ms: number) => (ms / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

type Props = { animation: CustomAnimation | null; ranges: Range[]; words?: CaptionWord[]; disabled: boolean; onChange: (a: CustomAnimation) => void; onRemove: () => void; onTest: () => void };

export default function StudioInspector({ animation, ranges, words = [], disabled, onChange, onRemove, onTest }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<"idle" | "busy">("idle");
  const [aiNote, setAiNote] = useState<string | null>(null);
  if (!animation) return <section aria-label="Réglages de l’animation" className="space-y-3"><h3 className="font-semibold">Réglages</h3><p className="text-sm text-mut">Clique sur une animation pour régler son texte, son moment et sa position.</p></section>;
  const a = animation, p = PlacementSchema.parse(a.placement ?? {}), span = animationOutputRange(a, ranges), def = ANIMATIONS[a.name];
  const example = (def?.example ?? {}) as Record<string, unknown>;
  const fields = def ? fieldsOf(def) : [];
  const content = fields.filter((f) => !STYLE_KEYS.has(f.key));
  const style = fields.filter((f) => STYLE_KEYS.has(f.key));
  const set = (key: string, value: unknown) => onChange({ ...a, props: { ...a.props, [key]: value } });
  const move = (key: string, value: unknown) => onChange({ ...a, placement: { ...p, [key]: value } });
  const timing = (from: number, to: number) => { try { onChange(retimeAnimation(a, ranges, from, to)); setError(null); } catch (e) { setError((e as Error).message); } };
  const spoken = spokenAround(words, a);
  const canAi = content.some((f) => f.kind === "text" || f.kind === "list") && Boolean(spoken);
  const suggest = async () => {
    setAi("busy"); setAiNote(null); setError(null);
    try {
      const raw = await generateEditorialText({ channel: "instagram", workspaceId: null, brief: animationAiBrief(a.name, spoken) });
      const r = parseAnimationAi(raw, a, spoken);
      if ("error" in r) setError(r.error); else { onChange({ ...a, props: r.props }); setAiNote("Textes proposés par l'IA à partir de ce que tu dis : modifie-les librement."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Proposition indisponible."); } finally { setAi("idle"); }
  };

  const input = (f: (typeof fields)[number]) => {
    const meta = FIELD[f.key] ?? { label: f.key };
    const value = a.props[f.key];
    const label = <>{meta.label}{f.optional && !STYLE_KEYS.has(f.key) ? <span className="font-normal text-mut"> (facultatif)</span> : null}</>;
    if (typeof example[f.key] === "boolean" || typeof value === "boolean")
      return <label key={f.key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={value !== false} onChange={(e) => set(f.key, e.target.checked)} />{meta.label}</label>;
    if (f.kind === "choice")
      return <label key={f.key} className="block text-xs font-medium">{label}<select className={field} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value || undefined)}>{f.optional ? <option value="">Par défaut</option> : null}{(f.options ?? []).map((o) => <option key={o} value={o}>{CHOICES[o] ?? o}</option>)}</select></label>;
    if (f.kind === "number" && SLIDERS[f.key]) {
      const sl = SLIDERS[f.key], n = typeof value === "number" ? value : typeof example[f.key] === "number" ? (example[f.key] as number) : sl.min;
      return <label key={f.key} className="block text-xs font-medium">{label} : {n}{sl.unit ?? ""}<input className="mt-2 w-full" type="range" min={sl.min} max={sl.max} step={sl.step} value={n} aria-valuetext={`${n}${sl.unit ?? ""}`} onChange={(e) => set(f.key, Number(e.target.value))} /></label>;
    }
    if (f.kind === "list")
      return <label key={f.key} className="block text-xs font-medium">{label}<textarea rows={3} className={field} value={Array.isArray(value) ? (value as unknown[]).join("\n") : String(value ?? "")} onChange={(e) => set(f.key, e.target.value.split("\n"))} />{meta.hint ? <span className="mt-1 block font-normal text-mut">{meta.hint}</span> : null}</label>;
    return <label key={f.key} className="block text-xs font-medium">{label}<input className={field} type={f.kind === "number" ? "number" : "text"} placeholder={meta.placeholder} value={String(value ?? "")} onChange={(e) => set(f.key, f.kind === "number" ? Number(e.target.value) : e.target.value)} />{meta.hint ? <span className="mt-1 block font-normal text-mut">{meta.hint}</span> : null}</label>;
  };

  return <section aria-label="Réglages de l’animation" className="space-y-3">
    <div>
      <h3 className="font-semibold">{def?.label ?? a.name}</h3>
      {def?.description ? <p className="text-xs text-mut">{def.description}</p> : null}
    </div>
    <fieldset disabled={disabled} className="space-y-3 disabled:opacity-60">
      {content.length ? <div className="space-y-2">
        {canAi ? <button type="button" className="btn-ghost inline-flex min-h-11 w-full items-center justify-center gap-1.5 text-sm" disabled={ai === "busy"} onClick={() => void suggest()}>
          <Sparkles aria-hidden size={16} className="text-brand" /> {ai === "busy" ? "L'IA écrit les textes…" : "Proposer avec l'IA"}
        </button> : null}
        {spoken ? <p className="text-xs text-mut">Dit à ce moment : « {spoken.length > 120 ? `${spoken.slice(0, 120)}…` : spoken} »</p> : null}
        {aiNote ? <p role="status" className="text-xs text-brand">{aiNote}</p> : null}
        {content.map(input)}
      </div> : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium">Début (s)<input className={field} type="number" min="0" step="0.1" value={sec(span.fromMs).replace(",", ".")} onChange={(e) => timing(Number(e.target.value) * 1000, span.toMs)} /></label>
        <label className="text-xs font-medium">Durée (s)<input className={field} type="number" min="0.5" step="0.1" value={sec(span.toMs - span.fromMs).replace(",", ".")} onChange={(e) => timing(span.fromMs, span.fromMs + Number(e.target.value) * 1000)} /></label>
      </div>
      {style.length ? <details className="rounded-xl border border-line px-3 py-1"><summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium">Style de l&apos;animation</summary><div className="space-y-3 pb-3">{style.map(input)}</div></details> : null}
      <details className="rounded-xl border border-line px-3 py-1">
        <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium">Position, taille et mouvement</summary>
        <div className="space-y-3 pb-3">
          {([["x", "Décalage horizontal", -540, 540, 10, "px"], ["y", "Décalage vertical", -960, 960, 10, "px"], ["scale", "Taille", 0.25, 2, 0.05, "%"], ["opacity", "Opacité", 0, 1, 0.05, "%"]] as const).map(([key, label, min, max, step, unit]) => {
            const v = p[key];
            const shown = unit === "%" ? `${Math.round(v * 100)} %` : `${v} px`;
            return <label key={key} className="block text-xs font-medium">{label} : {shown}<input className="mt-2 w-full" type="range" min={min} max={max} step={step} value={v} aria-valuetext={shown} onChange={(e) => move(key, Number(e.target.value))} /></label>;
          })}
          <label className="block text-xs font-medium">Apparition<select className={field} value={p.enter} onChange={(e) => move("enter", e.target.value)}><option value="native">Mouvement de l’animation</option><option value="fade">Apparition douce</option>{a.name !== "logo-fin" ? <option value="slide">Glissement</option> : null}</select></label>
          <label className="block text-xs font-medium">Disparition<select className={field} value={p.exit} onChange={(e) => move("exit", e.target.value)}><option value="none">Mouvement de l’animation</option><option value="fade">Disparition douce</option></select></label>
          <button type="button" className="btn-ghost min-h-11 w-full text-sm" onClick={() => onChange({ ...a, placement: undefined })}>Revenir à la position d&apos;origine</button>
        </div>
      </details>
      <div className="flex flex-wrap gap-2"><button className="btn-ghost min-h-[44px]" type="button" onClick={onTest}>▶ Voir l&apos;animation</button><button className="btn-ghost min-h-[44px] text-red-700" type="button" onClick={onRemove}>Supprimer l&apos;animation</button></div>
    </fieldset>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </section>;
}

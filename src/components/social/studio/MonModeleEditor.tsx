"use client";
import { useMemo, useState } from "react";
import ReelPreview from "@/components/social/ReelPreview";
import { buildAnimationPreview } from "@/domain/social/montage/edit-composition";
import { montage } from "@/lib/social/montage-api";
import {
  AUTO_ANIMATIONS, AUTO_LABEL, BIG_WORD_COLORS, BIG_WORD_ENTRIES, BIG_WORD_POSITIONS, COLOR_LABEL, ENTRY_LABEL, POSITION_LABEL,
  parseTemplate, STANDARD_TEMPLATE, templateWarnings, type AnimationTemplate, type BigWordStyle,
} from "@/domain/social/montage/template";

/**
 * « MON MODÈLE » (demande de Cédric, 2026-11-09) : la base d'animation du montage, réglée ici une fois pour toutes.
 * Les choix sont ceux de la charte (positions, couleurs, entrées validées) ; l'aperçu montre le grand mot tel qu'il sera
 * posé. « Appliquer » se fait dans le montage (bouton « Appliquer mon modèle ») : rien n'est rendu ni publié d'ici.
 */

const field = "mt-1 block min-h-[44px] w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
const sec = (ms: number) => `${(ms / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`;

function StyleFields({ legend, value, onChange }: { legend: string; value: BigWordStyle; onChange: (v: BigWordStyle) => void }) {
  return (
    <fieldset className="space-y-2 rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-sm">Position
          <select className={field} value={value.position} onChange={(e) => onChange({ ...value, position: e.target.value as BigWordStyle["position"] })}>
            {BIG_WORD_POSITIONS.map((p) => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="block text-sm">Couleur
          <select className={field} value={value.couleur} onChange={(e) => onChange({ ...value, couleur: e.target.value as BigWordStyle["couleur"] })}>
            {BIG_WORD_COLORS.map((c) => <option key={c} value={c}>{COLOR_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="block text-sm">Entrée
          <select className={field} value={value.entree} onChange={(e) => onChange({ ...value, entree: e.target.value as BigWordStyle["entree"] })}>
            {BIG_WORD_ENTRIES.map((x) => <option key={x} value={x}>{ENTRY_LABEL[x]}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

export default function MonModeleEditor({ saved, onSaved }: { saved: AnimationTemplate | null; onSaved: (t: AnimationTemplate | null) => void }) {
  const [t, setT] = useState<AnimationTemplate>(() => saved ?? { ...STANDARD_TEMPLATE, name: "Mon modèle" });
  const [show, setShow] = useState<"hook" | "takeaway">("hook");
  const [sample, setSample] = useState("RÉSEAU");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const valid = parseTemplate(t);
  const warnings = valid ? templateWarnings(valid) : [];
  const unchanged = saved !== null && JSON.stringify(saved) === JSON.stringify(t);
  const base = `${typeof window !== "undefined" ? window.location.origin : ""}/hyperframes`;
  const style = show === "hook" ? t.hook : t.takeaway;
  // Aperçu du grand mot : derrière la personne si le modèle en prévoit, sinon tel qu'il apparaît devant (onglet).
  const preview = useMemo(() => {
    const texte = sample.trim().slice(0, 48) || "RÉSEAU";
    return t.maxBehind > 0
      ? buildAnimationPreview("titre-derriere", { texte, ...style }, { assetBase: base, preview: true })
      : buildAnimationPreview("onglet", { texte, variante: "blanc" }, { assetBase: base, preview: true });
  }, [sample, style, t.maxBehind, base]);

  const save = async (next: AnimationTemplate | null) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await montage.saveTemplate(next);
      onSaved(r.template);
      if (!r.template) setT({ ...STANDARD_TEMPLATE, name: "Mon modèle" });
      setNotice(r.template ? "Mon modèle est enregistré. Dans un montage : « Appliquer mon modèle ». Les montages déjà enregistrés ne changent pas." : "Retour au Standard BeeRecos v1.");
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="mon-modele" className="card space-y-4 p-5">
      <div>
        <h2 id="mon-modele" className="font-display text-lg">Mon modèle d’animation</h2>
        <p className="text-sm text-mut">Ta base d’animation pour tous tes montages : style des grands mots, durée, rythme et animations posées automatiquement. Les mots affichés viennent toujours de ce que tu dis.</p>
        <p className="mt-1 text-xs text-mut">{saved ? `Modèle enregistré : « ${saved.name} ».` : "Aucun modèle enregistré : le Standard BeeRecos v1 s’applique."}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <label className="block text-sm">Nom du modèle<input className={field} maxLength={60} value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></label>
          <StyleFields legend="Accroche (premier grand mot)" value={t.hook} onChange={(hook) => { setT({ ...t, hook }); setShow("hook"); }} />
          <StyleFields legend="À retenir (dernier grand mot)" value={t.takeaway} onChange={(takeaway) => { setT({ ...t, takeaway }); setShow("takeaway"); }} />
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-sm">Grands mots derrière moi
              <select className={field} value={t.maxBehind} onChange={(e) => setT({ ...t, maxBehind: Number(e.target.value) })}>
                <option value={0}>Aucun (toujours devant)</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </select>
            </label>
            <label className="block text-sm">Durée d’un grand mot : {sec(t.overlayMs)}
              <input className="mt-3 w-full" type="range" min={1500} max={4000} step={250} value={t.overlayMs} onChange={(e) => setT({ ...t, overlayMs: Number(e.target.value) })} aria-valuetext={sec(t.overlayMs)} />
            </label>
            <label className="block text-sm">Écart entre animations : {sec(t.minSpacingMs)}
              <input className="mt-3 w-full" type="range" min={2000} max={8000} step={500} value={t.minSpacingMs} onChange={(e) => setT({ ...t, minSpacingMs: Number(e.target.value) })} aria-valuetext={sec(t.minSpacingMs)} />
            </label>
          </div>
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-medium">Animations posées automatiquement</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {AUTO_ANIMATIONS.map((a) => (
                <label key={a} className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input type="checkbox" checked={t.auto[a]} onChange={(e) => setT({ ...t, auto: { ...t.auto, [a]: e.target.checked } })} /> {AUTO_LABEL[a]}
                </label>
              ))}
            </div>
          </fieldset>
          {t.maxBehind > 0 && <p className="text-xs text-mut">Un grand mot passe derrière toi seulement si la prise est détourée (carte Détourage du montage) ; sinon il s’affiche devant.</p>}
          {warnings.map((w) => <p key={w} className="text-sm text-amber-800">{w}</p>)}
          {!valid && <p role="alert" className="text-sm text-red-700">Réglages incomplets : donne un nom au modèle.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-red min-h-[44px] px-4 text-sm" disabled={busy || !valid || unchanged} onClick={() => valid && save(valid)}>{busy ? "Enregistrement…" : "Enregistrer mon modèle"}</button>
            <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" disabled={busy} onClick={() => setT({ ...STANDARD_TEMPLATE, name: t.name })}>Repartir du Standard</button>
            {saved && <button type="button" className="btn-ghost min-h-[44px] px-3 text-sm" disabled={busy} onClick={() => { if (window.confirm("Supprimer ton modèle et revenir au Standard BeeRecos v1 ? Les montages déjà enregistrés ne changent pas.")) void save(null); }}>Revenir au Standard BeeRecos v1</button>}
          </div>
          {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex gap-1" role="tablist" aria-label="Grand mot affiché dans l’aperçu">
            {(["hook", "takeaway"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={show === k} className={`min-h-[40px] flex-1 rounded-lg border px-2 text-xs ${show === k ? "border-brand bg-brand text-white" : "border-line"}`} onClick={() => setShow(k)}>{k === "hook" ? "Accroche" : "À retenir"}</button>
            ))}
          </div>
          <div className="aspect-[9/16] overflow-hidden rounded-xl bg-black/80" data-testid="mon-modele-apercu">
            <ReelPreview key={preview} html={preview} title="Aperçu de mon modèle" />
          </div>
          <label className="block text-xs text-mut">Mot d’exemple (aperçu seulement)<input className={field} maxLength={48} value={sample} onChange={(e) => setSample(e.target.value)} /></label>
          <p className="text-xs text-mut">Aperçu sans personne : dans le montage, ta silhouette passe devant le mot quand la prise est détourée.</p>
        </div>
      </div>
    </section>
  );
}

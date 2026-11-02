"use client";
import { useMemo, useState } from "react";
import type { MontageDetail } from "@/lib/social/montage-api";
import type { KeptMotion, SceneIntent } from "@/domain/social/montage/beemotion";
import { hasMattes, matteAt } from "@/domain/social/montage/matte";
import { analyzeScenes, intensityWarnings, sceneCandidates, sceneCardCandidate, type Candidate, type Scene } from "@/domain/social/montage/scenes";
import { keptWords, type CustomAnimation } from "@/domain/social/montage/suggest";
import { ANIMATIONS } from "@/domain/social/montage/registry";
import BeeMotionLibrary, { ANIMATION_DRAG_INDEX, MOTION_DRAG_TYPE } from "@/components/social/studio/BeeMotionLibrary";

/** Bibliothèque réelle → carte choisie → scène. Tout reste dans le brouillon à prévisualiser et enregistrer. */
const INTENT_LABEL: Record<SceneIntent, string> = {
  HOOK: "Accroche", PROBLEM: "Problème", EXPLAIN: "Explication", DEMONSTRATION: "Démonstration", PROOF: "Preuve", STAT: "Chiffre",
  QUOTE: "Citation", LIST: "Liste", EMPHASIS: "Insistance", TRANSITION: "Transition", CTA: "Appel à l'action", BRAND: "Marque",
};
const sec = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
type Props = {
  compact?: boolean; activeScene?: Scene;
  m: MontageDetail; draft: CustomAnimation[]; kept: KeptMotion[]; usage: Record<string, number>; choices: string[]; disabled: boolean;
  onChoose: (id: string) => void; onPlace: (c: Candidate, scene: Scene, fromIndex?: number) => void;
  onRemove: (index: number) => void; onEdit: (index: number) => void; onTest: (sourceMs: number) => void; onUse: (c: Candidate) => void;
};

export default function StudioScenes({ m, draft, kept, usage, choices, disabled, onChoose, onPlace, onRemove, onEdit, onTest, onUse, compact = false, activeScene }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyword = m.reel?.keyword ?? null;
  const scenes = useMemo(() => (m.edit ? analyzeScenes(keptWords(m.captions, m.edit.ranges), { keyword }) : []), [m.captions, m.edit, keyword]);
  const rhythm = intensityWarnings(draft);
  const candidate = (name: string, scene: Scene) => sceneCardCandidate(name, scene, { kept, keyword, canBehind: Boolean(m.edit && matteAt(m.edit, scene.startMs)) });
  const place = (name: string, scene: Scene, index?: number) => {
    if (disabled) return;
    const c = candidate(name, scene);
    if (!c || (index !== undefined && draft[index]?.name !== name)) { setError("Cette carte n’est pas disponible sur cette scène. Un titre derrière le sujet exige le détourage de cette prise."); return; }
    setError(null); setSelected(name); onPlace(c, scene, index);
  };

  if (compact) return <section aria-label="Animations de la séquence" className="space-y-3">
    <p className="text-sm font-semibold">{activeScene ? `Séquence ${activeScene.index + 1} sélectionnée` : "Sélectionnez une séquence dans la timeline"}</p>
    {activeScene ? <p className="line-clamp-3 text-xs text-mut">{activeScene.text || "Vidéo sans transcription : les textes sont à renseigner."}</p> : null}
    <BeeMotionLibrary compact kept={kept} usage={usage} sceneComposer selected={selected} disabled={disabled || !activeScene} canBehind={Boolean(m.edit && activeScene && matteAt(m.edit, activeScene.startMs))}
      actionLabel={activeScene ? `Ajouter à la séquence ${activeScene.index + 1}` : "Choisir une séquence"}
      onUse={name => { if (activeScene) place(name, activeScene); }} />
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </section>;

  return (
    <section aria-label="Composer les animations par scène" className="grid min-w-0 gap-3 xl:grid-cols-2">
      <details className="min-w-0 rounded-xl border border-line p-3" open>
        <summary className="min-h-[36px] cursor-pointer text-sm font-medium">1. Choisir dans la bibliothèque d’animations</summary>
        <div className="mt-3 max-h-[32rem] overflow-y-auto">
          <BeeMotionLibrary kept={kept} usage={usage} sceneComposer selected={selected} disabled={disabled} canBehind={Boolean(m.edit && hasMattes(m.edit))}
            onUse={(name) => { setSelected(name); onChoose(name); setError(null); }} />
        </div>
      </details>
      <div className="min-w-0 space-y-2">
        <h4 className="text-sm font-medium">2. Placer les cartes sur les scènes</h4>
        <p className="text-xs text-mut">Glissez une carte sur une scène. Sur mobile ou au clavier, choisissez la carte puis utilisez « Ajouter à la scène ». Vous pouvez aussi déplacer une carte déjà posée. Les réglages incomplets s’ouvrent dans le formulaire.</p>
        {selected ? <p role="status" className="text-xs text-brand">Carte choisie : {ANIMATIONS[selected]?.label ?? selected}</p> : null}
        {!scenes.length ? <p className="text-sm text-mut">Transcrivez d’abord la prise pour composer scène par scène. Le formulaire manuel reste disponible ci-dessous.</p> : null}
        {rhythm.map((w) => <p key={w} role="status" className="rounded-xl bg-amber-400/10 p-2 text-xs text-amber-800">{w}</p>)}
        <ol className="max-h-[32rem] space-y-2 overflow-y-auto" aria-label="Scènes du clip">
          {scenes.map((s) => {
            const assigned = draft.map((c, index) => ({ c, index })).filter(({ c }) => c.fromMs >= s.startMs && c.fromMs < s.endMs);
            const candidates = sceneCandidates(s, { kept, keyword, canBehind: Boolean(m.edit && matteAt(m.edit, s.startMs)), allowedNames: choices });
            return (
              <li key={s.index} className={`space-y-2 rounded-xl border p-3 ${over === s.index ? "border-brand bg-brand/5" : "border-line"}`} data-testid={`scene-${s.index}`}
                onDragOver={(e) => { if (!disabled && e.dataTransfer.types.includes(MOTION_DRAG_TYPE)) { e.preventDefault(); setOver(s.index); } }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault(); setOver(null);
                  const id = e.dataTransfer.getData(MOTION_DRAG_TYPE);
                  const rawIndex = e.dataTransfer.getData(ANIMATION_DRAG_INDEX);
                  if (rawIndex && !/^\d+$/.test(rawIndex)) return;
                  place(id, s, rawIndex === "" ? undefined : Number(rawIndex));
                }}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <strong>Scène {s.index + 1}</strong>
                  <span className="tabular-nums text-mut">{sec(s.startMs)} → {sec(s.endMs)}</span>
                  <span className="pill bg-brand/10 text-brand">{INTENT_LABEL[s.intent]}</span>
                </div>
                <p className="line-clamp-2 text-sm">{s.text}</p>
                <button type="button" className="btn-ghost min-h-[44px] text-xs" disabled={disabled || !selected || !candidate(selected, s)} onClick={() => { if (selected) place(selected, s); }}>Ajouter à la scène {s.index + 1}</button>
                {assigned.length ? <ul className="space-y-2" aria-label={`Cartes de la scène ${s.index + 1}`}>
                  {assigned.map(({ c, index }) => <li key={`${c.name}-${c.fromMs}`} className="cursor-grab rounded-lg border border-brand/30 bg-brand/5 p-2 text-xs active:cursor-grabbing" draggable={!disabled}
                    onDragStart={(e) => { if (disabled) { e.preventDefault(); return; } e.dataTransfer.setData(MOTION_DRAG_TYPE, c.name); e.dataTransfer.setData(ANIMATION_DRAG_INDEX, String(index)); e.dataTransfer.effectAllowed = "move"; }}>
                    <p className="font-medium"><span aria-hidden>⠿ </span>{ANIMATIONS[c.name]?.label ?? c.name} · {sec(c.fromMs)}</p>
                    <p className="line-clamp-2">{Object.values(c.props).map((v) => Array.isArray(v) ? v.join(" · ") : String(v)).join(" — ")}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost min-h-[36px] text-xs" disabled={disabled} onClick={() => onTest(c.fromMs)}>Tester la carte</button>
                      <button type="button" className="btn-ghost min-h-[36px] text-xs" disabled={disabled} onClick={() => onEdit(index)}>Modifier la carte</button>
                      <button type="button" className="btn-ghost min-h-[36px] text-xs" disabled={disabled} onClick={() => onRemove(index)}>Retirer de la scène</button>
                    </div>
                    <label className="mt-1 block text-xs">Déplacer la carte
                      <select aria-label={`Déplacer ${ANIMATIONS[c.name]?.label ?? c.name} depuis la scène ${s.index + 1}`} value={s.index} disabled={disabled} className="ml-2 min-h-[36px] rounded border border-line bg-white px-2"
                        onChange={(e) => { const destination = scenes.find((scene) => scene.index === Number(e.target.value)); if (destination) place(c.name, destination, index); }}>
                        {scenes.map((scene) => <option key={scene.index} value={scene.index} disabled={!candidate(c.name, scene)}>Scène {scene.index + 1}</option>)}
                      </select>
                    </label>
                  </li>)}
                </ul> : <p className="text-xs text-mut">Déposez votre carte ici. Aucune animation posée.</p>}
                {candidates.length ? <details className="text-xs">
                  <summary className="min-h-[32px] cursor-pointer text-mut">Suggestions de placement parmi mes choix</summary>
                  <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label={`Motions proposés pour la scène ${s.index + 1}`}>
                    {candidates.map((c) => <button key={c.motion.id} type="button" disabled={disabled} onClick={() => onUse(c)} title={c.note ?? c.motion.recommendedFor} className="btn-ghost min-h-[44px] text-xs">{c.motion.name}</button>)}
                  </div>
                </details> : null}
              </li>
            );
          })}
        </ol>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      </div>
    </section>
  );
}
